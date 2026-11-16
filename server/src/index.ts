import { createApp } from './app.js';
import { openDatabase } from './db.js';

const port = Number(process.env.PORT ?? 8787);
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  console.error('PORT must be an integer from 1 to 65535');
  process.exit(1);
}

const db = openDatabase();
const app = createApp(db);
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Relay API listening on http://127.0.0.1:${port}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
