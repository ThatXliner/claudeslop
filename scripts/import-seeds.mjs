import { openStore, importSeeds } from "../store.mjs";

const { db } = openStore(process.env.DATA_DIR || "./data", { seed: false });
try {
  const added = importSeeds(db);
  console.log(
    `Added ${added} curated games. Existing listings, votes, and moderation state are unchanged.`,
  );
} finally {
  db.close();
}
