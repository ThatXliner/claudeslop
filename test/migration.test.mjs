import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStore, importSeeds } from "../store.mjs";

test("upgrading existing data preserves submissions and votes across repeated starts", () => {
  const directory = mkdtempSync(join(tmpdir(), "claudeslop-migration-"));
  const legacy = new DatabaseSync(join(directory, "claudeslop.sqlite"));
  legacy.exec(`CREATE TABLE games (id INTEGER PRIMARY KEY,title TEXT NOT NULL,url TEXT NOT NULL UNIQUE,description TEXT NOT NULL,author TEXT NOT NULL,image TEXT NOT NULL DEFAULT '',genre TEXT NOT NULL,duration TEXT NOT NULL,ai_note TEXT NOT NULL,source TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL,hidden INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE votes (game_id INTEGER NOT NULL REFERENCES games(id),voter TEXT NOT NULL,PRIMARY KEY(game_id,voter));
  INSERT INTO games (id,title,url,description,author,genre,duration,ai_note,created_at,hidden) VALUES (1,'Existing game','https://example.com/','Keep this text','Creator','Puzzle','5–15 min','AI note',12345,1);
  INSERT INTO votes VALUES (1,'voter');`);
  legacy.close();
  try {
    for (let i = 0; i < 2; i++) {
      const { db } = openStore(directory, { seed: false });
      const game = db.prepare("SELECT * FROM games WHERE id=1").get();
      assert.equal(game.play_style, "Short session (5–15 min)");
      assert.equal(game.game_type, "Not specified");
      assert.equal(game.description, "Keep this text");
      assert.equal(game.created_at, 12345);
      assert.equal(game.hidden, 1);
      assert.equal(db.prepare("SELECT count(*) AS n FROM votes").get().n, 1);
      assert.ok(!Object.hasOwn(game, "duration"));
      db.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("curated tag updates preserve community tags, votes, hides, and timestamps", () => {
  const directory = mkdtempSync(join(tmpdir(), "claudeslop-tags-"));
  const { db } = openStore(directory);
  try {
    const curated = db
      .prepare("SELECT * FROM games WHERE source<>'' LIMIT 1")
      .get();
    db.prepare(
      "UPDATE games SET game_type='Not specified',play_style='Quick play',hidden=1 WHERE id=?",
    ).run(curated.id);
    db.prepare("INSERT INTO votes VALUES (?,?)").run(curated.id, "voter");
    const community = db
      .prepare("SELECT * FROM games WHERE id<>? LIMIT 1")
      .get(curated.id);
    db.prepare(
      "UPDATE games SET source='',game_type='Fan game',play_style='Quick play' WHERE id=?",
    ).run(community.id);
    assert.equal(importSeeds(db, { updateTags: true }).updated, 1);
    const updated = db
      .prepare("SELECT * FROM games WHERE id=?")
      .get(curated.id);
    assert.equal(updated.game_type, curated.game_type);
    assert.equal(updated.play_style, curated.play_style);
    assert.equal(updated.hidden, 1);
    assert.equal(updated.created_at, curated.created_at);
    assert.equal(db.prepare("SELECT count(*) AS n FROM votes").get().n, 1);
    assert.equal(
      db.prepare("SELECT game_type FROM games WHERE id=?").get(community.id)
        .game_type,
      "Fan game",
    );
    assert.equal(importSeeds(db, { updateTags: true }).updated, 0);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
