# Curated games discovered on October 26, 2026

Searched recent Hacker News stories through the HN Algolia API, starting September 1, and searched public X posts. Direct X pages returned 403. X's official public oEmbed endpoint returned the original post text, creator, and publication date for the three X entries below. Discovery directories helped find those post URLs; the AI claims in the listings come from the primary posts.

| Game          | Creator credit            | Original post                                                       | Evidence for AI use                                                                          |
| ------------- | ------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Sillage       | Denis Hovart, HN `denzen` | [HN, October 23](https://news.ycombinator.com/item?id=50214466)     | Creator explains using LLMs for game implementation and shaders. No specific model is named. |
| Tiberava      | HN `cayodister`           | [HN, October 22](https://news.ycombinator.com/item?id=50200570)     | Creator explicitly calls it their vibe-coded game. Tool unspecified.                         |
| Mine Rogue    | HN `aeonfr`               | [HN, October 21](https://news.ycombinator.com/item?id=50183694)     | Creator's launch comment names Claude Opus 5.5 and describes the development process.        |
| Daily Pipes   | HN `jkelle`               | [HN, October 21](https://news.ycombinator.com/item?id=50180014)     | Creator says Claude implemented almost all of the code.                                      |
| Haiku Harbour | Chong-U, `@chongdashu`    | [X, October 8](https://x.com/chongdashu/status/2108195439606681975) | Creator credits Claude Haiku 5.5; the linked game page repeats the attribution.              |
| Netherspace   | esha, `@eshpvt`           | [X, September 23](https://x.com/eshpvt/status/2102727230510289034)  | Creator names Claude Opus 5.5 in the launch post.                                            |
| Arkenfall     | Leon Lin, `@LexnLin`      | [X, September 23](https://x.com/LexnLin/status/2102834362530079093) | Creator credits Claude Opus 5.5 for the implementation and procedural content.               |

These are creator claims, not an independent audit of how much code an AI wrote. Descriptions are our own short summaries. Play times are approximate browsing guidance. All entries are marked curated, with no fabricated votes or creator submissions.

## Checks

All seven game pages returned HTTP 200 and were opened in a real Chromium browser. Sillage rendered its swimming world; Mine Rogue started a run; Daily Pipes rendered today's puzzle; Tiberava offered city creation; Netherspace opened its sector selector; Haiku Harbour loaded its embedded game; Arkenfall reached its Ready / Begin screen after loading. These are startup checks, not complete playthroughs. Multiplayer availability and ongoing uptime are not guaranteed.

Most preview images use the creator's own social-preview assets. Mine Rogue and Tiberava use captures from their browser games, credited to their respective creators. No source game code or downloadable game assets were copied into the directory.

Pawnrush was a promising [October 21 Claude Code submission](https://news.ycombinator.com/item?id=50176936), but remained on Connecting during the browser check. It was not added. Games without a clear AI claim were also omitted.

## Recheck primary posts

HN exposes complete story and comment data through `https://hn.algolia.com/api/v1/items/ITEM_ID`. X exposes a public embed through `https://publish.twitter.com/oembed?url=ENCODED_POST_URL&omit_script=true`.

The repeatable import command is documented in the repository README. Original post dates stay in this record; database timestamps record the actual import date.
