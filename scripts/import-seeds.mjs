import { openStore, importSeeds } from "../store.mjs";

const { db } = openStore(process.env.DATA_DIR || "./data", { seed: false });
try {
  const { added, updated } = importSeeds(db, {
    updateTags: process.argv.includes("--update-tags"),
  });
  console.log(
    `Added ${added} curated games. Updated tags on ${updated} existing curated games. Votes and moderation state are unchanged.`,
  );
} finally {
  db.close();
}
