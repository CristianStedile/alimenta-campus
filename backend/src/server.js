import 'dotenv/config';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { createDatabase } from './database.js';

const backendDirectory = path.dirname(fileURLToPath(import.meta.url));
const databasePath = path.resolve(process.env.DATABASE_PATH ?? path.join(backendDirectory, '../data/alimenta-campus.sqlite'));
mkdirSync(path.dirname(databasePath), { recursive: true });

const db = createDatabase(databasePath);
const app = createApp({
  db,
  jwtSecret: process.env.JWT_SECRET,
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
});
const port = Number(process.env.PORT ?? 3000);
const server = app.listen(port, () => {
  console.log(`API do Alimenta Campus disponível na porta ${port}.`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
