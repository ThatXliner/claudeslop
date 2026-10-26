import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

export function openStore(directory) {
  mkdirSync(directory, { recursive: true });
  const secretPath = join(directory, 'session-secret');
  if (!existsSync(secretPath)) writeFileSync(secretPath, randomBytes(32).toString('hex'), { mode: 0o600, flag: 'wx' });
  const secret = readFileSync(secretPath, 'utf8');
  const db = new DatabaseSync(join(directory, 'claudeslop.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY, title TEXT NOT NULL, url TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL, author TEXT NOT NULL, image TEXT NOT NULL DEFAULT '',
      genre TEXT NOT NULL, duration TEXT NOT NULL, ai_note TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL,
      hidden INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS votes (
      game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      voter TEXT NOT NULL, PRIMARY KEY(game_id, voter)
    );
    CREATE TABLE IF NOT EXISTS limits (
      bucket TEXT NOT NULL, at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS limits_bucket ON limits(bucket, at);
  `);
  if (!db.prepare('SELECT 1 FROM games LIMIT 1').get() && process.env.SEED !== 'false') {
    const seeds = JSON.parse(readFileSync(new URL('./seeds.json', import.meta.url), 'utf8'));
    const insert = db.prepare('INSERT INTO games (title,url,description,author,image,genre,duration,ai_note,source,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)');
    for (const game of seeds) insert.run(game.title, game.url, game.description, game.author, game.image || '', game.genre, game.duration, game.ai_note, game.source || '', Date.now());
  }
  return { db, secret };
}
