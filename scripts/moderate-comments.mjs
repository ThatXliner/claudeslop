import { openStore } from "../store.mjs";
const [action, rawId] = process.argv.slice(2);
const id = Number(rawId);
if (
  !["list", "hide", "restore"].includes(action) ||
  (rawId !== undefined && (!Number.isSafeInteger(id) || id < 1)) ||
  (action !== "list" && !rawId)
) {
  console.error(
    "Usage: npm run moderate-comments -- list [game-id] | hide <comment-id> | restore <comment-id>",
  );
  process.exit(1);
}
const { db } = openStore(process.env.DATA_DIR || "./data", { seed: false });
try {
  if (action === "list") {
    const rows = rawId
      ? db
          .prepare(
            "SELECT id,game_id,body,created_at,hidden FROM comments WHERE game_id=? ORDER BY id DESC LIMIT 100",
          )
          .all(id)
      : db
          .prepare(
            "SELECT id,game_id,body,created_at,hidden FROM comments ORDER BY id DESC LIMIT 100",
          )
          .all();
    console.table(rows);
  } else {
    const result = db
      .prepare("UPDATE comments SET hidden=? WHERE id=?")
      .run(action === "hide" ? 1 : 0, id);
    if (!result.changes) {
      console.error("Comment not found.");
      process.exitCode = 1;
    } else
      console.log(
        `${action === "hide" ? "Hidden" : "Restored"} comment ${id}.`,
      );
  }
} finally {
  db.close();
}
