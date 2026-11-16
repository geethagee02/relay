import cors from 'cors';
import express, { type ErrorRequestHandler, type Express } from 'express';

import type { RelayDb } from './db.js';
import { isUuid, parseCreate, parseStatus } from './validate.js';

function routeId(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : '';
}

export function createApp(db: RelayDb): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '64kb' }));
  app.use((req, res, next) => {
    const started = Date.now();
    res.on('finish', () => {
      console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms`);
    });
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'relay-api' });
  });

  app.get('/api/handoffs', (_req, res) => {
    res.json({ handoffs: db.list() });
  });

  app.post('/api/handoffs', (req, res) => {
    const parsed = parseCreate(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const result = db.saveCreate(parsed.value);
    res.status(result.created ? 201 : 200).json(result);
  });

  app.get('/api/handoffs/:id', (req, res) => {
    const id = routeId(req.params.id);
    if (!isUuid(id)) {
      res.status(404).json({ error: 'No handoff with that id' });
      return;
    }
    const handoff = db.get(id);
    if (!handoff) {
      res.status(404).json({ error: 'No handoff with that id' });
      return;
    }
    res.json({ handoff });
  });

  app.patch('/api/handoffs/:id', (req, res) => {
    const id = routeId(req.params.id);
    if (!isUuid(id)) {
      res.status(404).json({ error: 'No handoff with that id' });
      return;
    }
    const parsed = parseStatus(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const result = db.advanceStatus(id, parsed.value);
    if (result.kind === 'missing') {
      res.status(404).json({ error: 'No handoff with that id' });
      return;
    }
    if (result.kind === 'conflict') {
      res.status(409).json({ error: 'Status cannot move backward', handoff: result.handoff });
      return;
    }
    res.json({ handoff: result.handoff });
  });

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof SyntaxError) {
      res.status(400).json({ error: 'Request body must be JSON' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  };
  app.use(onError);

  return app;
}
