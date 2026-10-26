import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

export function openStore(
  directory,
  { seed = process.env.SEED !== "false" } = {},
) {
  mkdirSync(directory, { recursive: true });
  const secretPath = join(directory, "session-secret");
  if (!existsSync(secretPath))
    writeFileSync(secretPath, randomBytes(32).toString("hex"), {
      mode: 0o600,
      flag: "wx",
    });
  const secret = readFileSync(secretPath, "utf8");
  const db = new DatabaseSync(join(directory, "claudeslop.sqlite"));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY, title TEXT NOT NULL, url TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL, author TEXT NOT NULL, image TEXT NOT NULL DEFAULT '',
      genre TEXT NOT NULL, play_style TEXT NOT NULL, game_type TEXT NOT NULL DEFAULT 'Not specified', ai_note TEXT NOT NULL,
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
  const columns = db
    .prepare("PRAGMA table_info(games)")
    .all()
    .map((column) => column.name);
  db.exec("BEGIN IMMEDIATE");
  try {
    if (columns.includes("duration")) {
      db.exec("ALTER TABLE games RENAME COLUMN duration TO play_style");
      db.exec(
        "UPDATE games SET play_style = CASE play_style WHEN '5–15 min' THEN 'Short session (5–15 min)' WHEN '15+ min' THEN 'Longer session (15+ min)' ELSE play_style END",
      );
    }
    if (!columns.includes("game_type"))
      db.exec(
        "ALTER TABLE games ADD COLUMN game_type TEXT NOT NULL DEFAULT 'Not specified'",
      );
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  if (seed && !db.prepare("SELECT 1 FROM games LIMIT 1").get()) importSeeds(db);
  return { db, secret };
}

export function importSeeds(db, { updateTags = false } = {}) {
  const seeds = JSON.parse(
    readFileSync(new URL("./seeds.json", import.meta.url), "utf8"),
  );
  const insert = db.prepare(
    "INSERT INTO games (title,url,description,author,image,genre,play_style,game_type,ai_note,source,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(url) DO NOTHING",
  );
  const update = db.prepare(
    "UPDATE games SET game_type=?,play_style=? WHERE url=? AND source=? AND source<>'' AND (game_type<>? OR play_style<>?)",
  );
  let added = 0;
  let updated = 0;
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const game of seeds) {
      added += insert.run(
        game.title,
        game.url,
        game.description,
        game.author,
        game.image || "",
        game.genre,
        game.play_style,
        game.game_type,
        game.ai_note,
        game.source || "",
        Date.now(),
      ).changes;
      if (updateTags)
        updated += update.run(
          game.game_type,
          game.play_style,
          game.url,
          game.source,
          game.game_type,
          game.play_style,
        ).changes;
    }
    db.exec("COMMIT");
    return { added, updated };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
