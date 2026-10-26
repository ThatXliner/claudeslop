import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStore } from "../store.mjs";

test("curated import adds new games once and preserves existing submissions, votes, and hides", () => {
  const directory = mkdtempSync(join(tmpdir(), "claudeslop-import-"));
  const { db } = openStore(directory, { seed: false });
  try {
    const seeds = JSON.parse(
      readFileSync(new URL("../seeds.json", import.meta.url), "utf8"),
    );
    const first = seeds[0];
    db.prepare(
      "INSERT INTO games (title,url,description,author,genre,duration,ai_note,created_at,hidden) VALUES (?,?,?,?,?,?,?,?,1)",
    ).run(
      "Existing community submission",
      first.url,
      "Community description",
      "Original submitter",
      first.genre,
      first.duration,
      "Original AI note",
      12345,
    );
    const existing = db
      .prepare("SELECT * FROM games WHERE url=?")
      .get(first.url);
    db.prepare("INSERT INTO votes VALUES (?,?)").run(
      existing.id,
      "existing-voter",
    );
    const run = () =>
      execFileSync(process.execPath, ["scripts/import-seeds.mjs"], {
        env: { ...process.env, DATA_DIR: directory },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    assert.match(run(), new RegExp(`Added ${seeds.length - 1} curated games`));
    assert.equal(
      db.prepare("SELECT count(*) AS n FROM games").get().n,
      seeds.length,
    );
    assert.deepEqual(
      db.prepare("SELECT * FROM games WHERE id=?").get(existing.id),
      existing,
    );
    assert.equal(
      db
        .prepare("SELECT count(*) AS n FROM votes WHERE game_id=?")
        .get(existing.id).n,
      1,
    );
    assert.match(run(), /Added 0 curated games/);
    assert.equal(
      db.prepare("SELECT count(*) AS n FROM games").get().n,
      seeds.length,
    );
    assert.deepEqual(
      db.prepare("SELECT * FROM games WHERE id=?").get(existing.id),
      existing,
    );
    assert.equal(
      db
        .prepare("SELECT count(*) AS n FROM votes WHERE game_id=?")
        .get(existing.id).n,
      1,
    );
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
