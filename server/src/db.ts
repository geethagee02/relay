import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import { canAdvance, isHandoff, type Handoff, type Status } from './types.js';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultPath = path.join(serverDir, 'data', 'relay.sqlite');

export type RelayDb = {
  list: () => Handoff[];
  get: (id: string) => Handoff | null;
  saveCreate: (handoff: Handoff) => { handoff: Handoff; created: boolean };
  advanceStatus: (
    id: string,
    status: Status,
  ) => { kind: 'ok'; handoff: Handoff } | { kind: 'missing' } | { kind: 'conflict'; handoff: Handoff };
  close: () => void;
};

type Sql = {
  exec: (sql: string) => void;
  prepare: (sql: string) => {
    run: (...params: Array<string | null>) => unknown;
    get: (...params: Array<string | null>) => unknown;
    all: (...params: Array<string | null>) => unknown;
  };
  close: () => void;
};

export function openDatabase(file = process.env.RELAY_DB || defaultPath): RelayDb {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file) as unknown as Sql;
  // DELETE, not WAL. WAL's sidecar files fail on some network and FUSE disks.
  // This API is a single writer, so the simpler journal is enough.
  db.exec('PRAGMA journal_mode = DELETE');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 3000');
  db.exec(`
    CREATE TABLE IF NOT EXISTS handoffs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      notes TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL,
      service TEXT NOT NULL,
      author TEXT NOT NULL,
      photo_kind TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_handoffs_created_at ON handoffs (created_at);
  `);
  seed(db);

  const listStmt = db.prepare(`
    SELECT id, title, notes, severity, status, service, author, photo_kind, created_at, updated_at
    FROM handoffs
    ORDER BY created_at DESC
  `);
  const getStmt = db.prepare(`
    SELECT id, title, notes, severity, status, service, author, photo_kind, created_at, updated_at
    FROM handoffs
    WHERE id = ?
  `);
  const insertStmt = db.prepare(`
    INSERT INTO handoffs (
      id, title, notes, severity, status, service, author, photo_kind, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateStatusStmt = db.prepare(`UPDATE handoffs SET status = ?, updated_at = ? WHERE id = ?`);

  function transaction<T>(fn: () => T): T {
    db.exec('BEGIN IMMEDIATE');
    try {
      const value = fn();
      db.exec('COMMIT');
      return value;
    } catch (error) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // The original error is the one that matters.
      }
      throw error;
    }
  }

  function bind(handoff: Handoff): Array<string | null> {
    return [
      handoff.id,
      handoff.title,
      handoff.notes,
      handoff.severity,
      handoff.status,
      handoff.service,
      handoff.author,
      handoff.photoKind,
      handoff.createdAt,
      handoff.updatedAt,
    ];
  }

  return {
    list() {
      return readRows(listStmt.all());
    },
    get(id) {
      return readRow(getStmt.get(id));
    },
    saveCreate(handoff) {
      return transaction(() => {
        const existing = readRow(getStmt.get(handoff.id));
        if (!existing) {
          insertStmt.run(...bind(handoff));
          return { handoff, created: true };
        }
        if (canAdvance(existing.status, handoff.status)) {
          const updated: Handoff = { ...existing, status: handoff.status, updatedAt: handoff.updatedAt };
          updateStatusStmt.run(updated.status, updated.updatedAt, updated.id);
          return { handoff: updated, created: false };
        }
        return { handoff: existing, created: false };
      });
    },
    advanceStatus(id, status) {
      return transaction(() => {
        const existing = readRow(getStmt.get(id));
        if (!existing) return { kind: 'missing' as const };
        if (!canAdvance(existing.status, status)) return { kind: 'conflict' as const, handoff: existing };
        const updated: Handoff = { ...existing, status, updatedAt: new Date().toISOString() };
        updateStatusStmt.run(updated.status, updated.updatedAt, updated.id);
        return { kind: 'ok' as const, handoff: updated };
      });
    },
    close() {
      db.close();
    },
  };
}

function readRows(value: unknown): Handoff[] {
  if (!Array.isArray(value)) return [];
  const handoffs: Handoff[] = [];
  for (const row of value) {
    const handoff = readRow(row);
    if (handoff) handoffs.push(handoff);
  }
  return handoffs;
}

function readRow(value: unknown): Handoff | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const candidate = {
    id: row.id,
    title: row.title,
    notes: row.notes,
    severity: row.severity,
    status: row.status,
    service: row.service,
    author: row.author,
    photoKind: row.photo_kind ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  return isHandoff(candidate) ? candidate : null;
}

function seed(db: Sql): void {
  const countRow = db.prepare('SELECT COUNT(*) AS n FROM handoffs').get() as { n?: number | bigint } | undefined;
  const count = typeof countRow?.n === 'bigint' ? Number(countRow.n) : Number(countRow?.n ?? 0);
  if (count > 0) return;

  const hour = 60 * 60 * 1000;
  const now = Date.now();
  const samples: Handoff[] = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      title: 'Checkout p99 jumped after the 02:10 deploy',
      notes:
        'p99 on POST /v1/charges climbed from 240ms to 1.8s at 02:14 UTC, one minute after payments-api build 1842. I rolled shard B back to build 1839 and p99 fell to 400ms, still above the 300ms budget. Canary shard A is still on 1842 and looks flat. If this pages again, compare charge-auth spans on A vs B before rolling A back — the regression may be the new vault timeout, not the deploy as a whole.',
      severity: 'high',
      status: 'open',
      service: 'payments-api',
      author: 'mina',
      photoKind: 'graph',
      createdAt: new Date(now - 2 * hour).toISOString(),
      updatedAt: new Date(now - 2 * hour).toISOString(),
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      title: 'Edge proxy pods are restarting on memory',
      notes:
        'edge-proxy in us-east-1 has been restarting since 04:02. Three pods are in CrashLoopBackOff. I raised memory from 512Mi to 1Gi on the canary and that pod held, but the rest of the fleet is still on 512Mi. Do not roll that change wide until you look at request size — partner-481 is retrying a 400KB header and may be the leak. I have not blocked them.',
      severity: 'critical',
      status: 'open',
      service: 'edge-proxy',
      author: 'jordan',
      photoKind: 'pager',
      createdAt: new Date(now - 40 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 40 * 60 * 1000).toISOString(),
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      title: 'SMS provider is rate-limiting the top of each hour',
      notes:
        'The SMS provider returns 429s in bursts around :00. Queue depth peaked at 12k and drained in nine minutes. I acknowledged the page and left vendor ticket 88421 open. If depth crosses 20k, fail over to the backup provider using the sms-failover runbook. Do not raise the send rate — that is what tripped the 429s.',
      severity: 'medium',
      status: 'acknowledged',
      service: 'notifications',
      author: 'ravi',
      photoKind: 'runbook',
      createdAt: new Date(now - 6 * hour).toISOString(),
      updatedAt: new Date(now - 5 * hour).toISOString(),
    },
    {
      id: '44444444-4444-4444-8444-444444444444',
      title: 'Nightly warehouse load finished late',
      notes:
        'The nightly warehouse load finished 38 minutes late because the orders extract waited on a manual backfill. The load completed, and row counts match yesterday within 0.4%. Marking resolved. No follow-up unless finance asks about the late dashboard.',
      severity: 'low',
      status: 'resolved',
      service: 'data-pipeline',
      author: 'mina',
      photoKind: null,
      createdAt: new Date(now - 20 * hour).toISOString(),
      updatedAt: new Date(now - 18 * hour).toISOString(),
    },
  ];

  const insert = db.prepare(`
    INSERT INTO handoffs (
      id, title, notes, severity, status, service, author, photo_kind, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const sample of samples) {
      insert.run(
        sample.id,
        sample.title,
        sample.notes,
        sample.severity,
        sample.status,
        sample.service,
        sample.author,
        sample.photoKind,
        sample.createdAt,
        sample.updatedAt,
      );
    }
    db.exec('COMMIT');
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // Surface the original failure.
    }
    throw error;
  }
}
