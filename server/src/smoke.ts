import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { createApp } from './app.js';
import { openDatabase } from './db.js';
import type { Handoff } from './types.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function listen(app: ReturnType<typeof createApp>): Promise<{ server: Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1');
    server.once('error', reject);
    server.once('listening', () => {
      const address = server.address() as AddressInfo | null;
      if (!address || typeof address === 'string') {
        reject(new Error('Expected a TCP port'));
        return;
      }
      resolve({ server, port: address.port });
    });
  });
}

async function call(url: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  const body: unknown = text ? JSON.parse(text) : null;
  return { status: response.status, body };
}

function handoffOf(body: unknown): Handoff {
  assert(body && typeof body === 'object' && 'handoff' in body, 'missing handoff');
  return (body as { handoff: Handoff }).handoff;
}

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-api-'));
  const db = openDatabase(path.join(dir, 'relay.sqlite'));
  const app = createApp(db);
  const { server, port } = await listen(app);
  const base = `http://127.0.0.1:${port}`;

  try {
    const health = await call(`${base}/health`);
    assert(health.status === 200, 'health status');
    assert(
      health.body && typeof health.body === 'object' && (health.body as { ok?: boolean }).ok === true,
      'health body',
    );

    const list = await call(`${base}/api/handoffs`);
    assert(list.status === 200, 'list status');
    const seeded = (list.body as { handoffs: Handoff[] }).handoffs;
    assert(seeded.length === 4, `expected 4 seeds, got ${seeded.length}`);
    assert(seeded[0]?.service === 'edge-proxy', 'newest seed should lead the list');

    const detail = await call(`${base}/api/handoffs/22222222-2222-4222-8222-222222222222`);
    assert(detail.status === 200, 'detail status');
    assert(handoffOf(detail.body).severity === 'critical', 'detail severity');

    const createdAt = new Date().toISOString();
    const draft: Handoff = {
      id: '55555555-5555-4555-8555-555555555555',
      title: 'Auth token refresh is slow',
      notes: 'Refresh p99 is 900ms since 05:40.\nI have not failed over.',
      severity: 'high',
      status: 'open',
      service: 'auth',
      author: 'mina',
      photoKind: 'dashboard',
      createdAt,
      updatedAt: createdAt,
    };

    const created = await call(`${base}/api/handoffs`, { method: 'POST', body: JSON.stringify(draft) });
    assert(created.status === 201, `create status ${created.status}`);
    assert((created.body as { created?: boolean }).created === true, 'created flag');
    assert(handoffOf(created.body).notes.includes('\n'), 'newline notes survived');

    const replay = await call(`${base}/api/handoffs`, {
      method: 'POST',
      body: JSON.stringify({ ...draft, title: 'rewritten by a retry', status: 'acknowledged' }),
    });
    assert(replay.status === 200, 'replay status');
    assert((replay.body as { created?: boolean }).created === false, 'replay is not a second row');
    assert(handoffOf(replay.body).title === draft.title, 'replay must not rewrite the note');
    assert(handoffOf(replay.body).status === 'acknowledged', 'replay may move status forward');

    const downgrade = await call(`${base}/api/handoffs`, {
      method: 'POST',
      body: JSON.stringify({ ...draft, status: 'open' }),
    });
    assert(handoffOf(downgrade.body).status === 'acknowledged', 'replay must not rewind status');

    const after = await call(`${base}/api/handoffs`);
    const rows = (after.body as { handoffs: Handoff[] }).handoffs;
    assert(rows.filter((row) => row.id === draft.id).length === 1, 'one row for the client id');
    assert(rows[0]?.id === draft.id, 'new handoff sorts first');

    const resolved = await call(`${base}/api/handoffs/${draft.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'resolved' }),
    });
    assert(resolved.status === 200, 'resolve status');
    assert(handoffOf(resolved.body).status === 'resolved', 'resolved');

    const backward = await call(`${base}/api/handoffs/${draft.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'acknowledged' }),
    });
    assert(backward.status === 409, 'backward status');

    const invalid = await call(`${base}/api/handoffs`, {
      method: 'POST',
      body: JSON.stringify({ ...draft, id: 'not-a-uuid' }),
    });
    assert(invalid.status === 400, 'invalid id');

    const missing = await call(`${base}/api/handoffs/66666666-6666-4666-8666-666666666666`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'acknowledged' }),
    });
    assert(missing.status === 404, 'missing patch');

    console.log('smoke ok');
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
