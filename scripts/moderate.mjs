import { openStore } from "../store.mjs";
const [action, rawId] = process.argv.slice(2);
const id = Number(rawId);
if (
  !["list", "hide", "restore"].includes(action) ||
  (action !== "list" && (!Number.isSafeInteger(id) || id < 1))
) {
  console.error("Usage: npm run moderate -- list | hide <id> | restore <id>");
  process.exit(1);
}
const { db } = openStore(process.env.DATA_DIR || "./data");
if (action === "list")
  console.table(
    db
      .prepare("SELECT id,title,url,author,hidden FROM games ORDER BY id DESC")
      .all(),
  );
else {
  const result = db
    .prepare("UPDATE games SET hidden=? WHERE id=?")
    .run(action === "hide" ? 1 : 0, id);
  if (!result.changes) {
    console.error("Game not found.");
    process.exitCode = 1;
  } else
    console.log(`${action === "hide" ? "Hidden" : "Restored"} game ${id}.`);
}
db.close();
