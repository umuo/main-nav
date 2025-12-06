import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

// db.sqlite will be created in the project root
// db.sqlite will be created in the project root
// In Vercel/Serverless, root is read-only. We must use /tmp.
const dbPath = process.env.VERCEL || process.env.NODE_ENV === 'production'
  ? path.join('/tmp', 'sentinel.db')
  : path.join(process.cwd(), 'sentinel.db');

let dbInstance: Database | null = null;

export async function getDb() {
  if (dbInstance) return dbInstance;

  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS websites (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      description TEXT,
      iconUrl TEXT,
      status TEXT DEFAULT 'unknown',
      lastChecked INTEGER DEFAULT 0,
      latency INTEGER
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  return dbInstance;
}
