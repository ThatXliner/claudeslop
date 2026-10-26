import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { openStore } from "../store.mjs";
import { launch } from "../test-support/server.mjs";

test("anonymous comments persist, isolate threads, paginate, moderate and enforce request limits", async () => {
  const directory = mkdtempSync(join(tmpdir(), "claudeslop-comments-"));
  const { db } = openStore(directory);
  const ids = db
    .prepare("SELECT id FROM games ORDER BY id LIMIT 2")
    .all()
    .map((g) => g.id);
  const [id, otherId] = ids;
  let app = await launch(directory);
  try {
    async function client() {
      const response = await fetch(`${app.base}/api/session`);
      const cookie = response.headers.get("set-cookie").split(";")[0];
      const { csrf } = await response.json();
      return (path, method = "GET", payload, headers = {}) =>
        fetch(`${app.base}${path}`, {
          method,
          headers: {
            cookie,
            "content-type": "application/json",
            "x-csrf-token": csrf,
            ...headers,
          },
          body: payload === undefined ? undefined : JSON.stringify(payload),
        });
    }
    const request = await client();
    const second = await client();
    const path = `/api/games/${id}/comments`;
    let response = await request(path);
    assert.deepEqual(await response.json(), {
      comments: [],
      more: false,
      count: 0,
    });
    assert.equal((await request("/api/games/99999/comments")).status, 404);
    assert.equal((await request(`${path}?before=invalid`)).status, 400);
    const first = {
      body: "<img src=x onerror=alert(1)>\nA real opinion.",
      request_id: randomUUID(),
    };
    assert.equal(
      (await request(path, "POST", first, { "x-csrf-token": "invalid" }))
        .status,
      403,
    );
    assert.equal(
      (await request(path, "POST", first, { origin: "https://evil.example" }))
        .status,
      403,
    );
    assert.equal(
      (await request(path, "POST", { ...first, body: "  " })).status,
      400,
    );
    assert.equal(
      (await request(path, "POST", { ...first, body: "a".repeat(2001) }))
        .status,
      400,
    );
    assert.equal(
      (await request(path, "POST", { ...first, website: "spam" })).status,
      400,
    );
    assert.equal(
      (await request(path, "POST", { ...first, request_id: "invalid" })).status,
      400,
    );
    response = await request(path, "POST", first);
    assert.equal(response.status, 201);
    const created = await response.json();
    assert.equal(created.comment.body, first.body);
    assert.deepEqual(Object.keys(created.comment).sort(), [
      "body",
      "created_at",
      "id",
    ]);
    response = await request(path, "POST", first);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).comment.id, created.comment.id);
    assert.equal(
      (await request(path, "POST", { ...first, body: "Changed" })).status,
      409,
    );
    response = await second(path, "POST", {
      body: `>>${created.comment.id}\nI agree.`,
      request_id: randomUUID(),
    });
    assert.equal(response.status, 201);
    const reply = await response.json();
    assert.equal(reply.count, 2);
    assert.equal(
      (await (await request(`/api/games/${otherId}/comments`)).json()).count,
      0,
    );
    db.prepare("INSERT INTO votes VALUES (?,?)").run(id, "voter-one");
    db.prepare("INSERT INTO votes VALUES (?,?)").run(id, "voter-two");
    const feed = await (await request("/api/games")).json();
    const game = feed.games.find((g) => g.id === id);
    assert.equal(game.comment_count, 2);
    assert.equal(game.points, 2);
    await app.stop();
    app = await launch(directory);
    response = await request(path);
    const persisted = await response.json();
    assert.equal(persisted.count, 2);
    assert.deepEqual(
      persisted.comments.map((c) => c.id),
      [created.comment.id, reply.comment.id],
    );
    const moderate = (...args) =>
      execFileSync(
        process.execPath,
        ["scripts/moderate-comments.mjs", ...args],
        { env: { ...process.env, DATA_DIR: directory }, stdio: "pipe" },
      );
    moderate("hide", String(created.comment.id));
    response = await request(path);
    const hidden = await response.json();
    assert.equal(hidden.count, 1);
    assert.equal(hidden.comments[0].id, reply.comment.id);
    assert.equal((await request(path, "POST", first)).status, 409);
    moderate("restore", String(created.comment.id));
    assert.equal((await (await request(path)).json()).count, 2);
    const insert = db.prepare(
      "INSERT INTO comments (game_id,body,created_at,request_key) VALUES (?,?,?,?)",
    );
    for (let i = 0; i < 65; i++)
      insert.run(id, `Fixture ${i}`, Date.now(), randomUUID());
    const latest = await (await request(path)).json();
    assert.equal(latest.comments.length, 50);
    assert.equal(latest.more, true);
    assert.equal(latest.count, 67);
    const earlier = await (
      await request(`${path}?before=${latest.comments[0].id}`)
    ).json();
    assert.equal(earlier.comments.length, 17);
    assert.equal(earlier.more, false);
    assert.ok(earlier.comments.at(-1).id < latest.comments[0].id);
    for (let i = 0; i < 9; i++)
      assert.equal(
        (
          await request(path, "POST", {
            body: `Extra ${i}`,
            request_id: randomUUID(),
          })
        ).status,
        201,
      );
    assert.equal(
      (
        await request(path, "POST", {
          body: "Too fast",
          request_id: randomUUID(),
        })
      ).status,
      429,
    );
    // A lost-response retry remains safe even after the posting limit is reached.
    assert.equal((await request(path, "POST", first)).status, 200);
    db.prepare("UPDATE games SET hidden=1 WHERE id=?").run(id);
    assert.equal((await request(path)).status, 404);
    assert.equal(
      (
        await request(path, "POST", {
          body: "Hidden thread",
          request_id: randomUUID(),
        })
      ).status,
      404,
    );
  } finally {
    await app.stop();
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
