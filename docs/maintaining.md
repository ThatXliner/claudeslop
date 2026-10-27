# Maintain Claudeslop

## Configure an instance

| Variable      | Default     | Purpose                                                                                 |
| ------------- | ----------- | --------------------------------------------------------------------------------------- |
| `PORT`        | `4317`      | HTTP port.                                                                              |
| `HOST`        | `127.0.0.1` | Bind address. Docker uses `0.0.0.0` inside the container.                               |
| `DATA_DIR`    | `./data`    | Database and session-signing secret. Docker uses `/data`.                               |
| `APP_URL`     | Unset       | Public origin for origin checks and Secure cookies on HTTPS.                            |
| `TRUST_PROXY` | Unset       | Set to `true` only behind Cloudflare to trust its connecting-IP header for rate limits. |
| `SEED`        | Enabled     | Set to `false` to skip initial curated entries.                                         |

Keep the data directory and signing secret private. Clearing cookies creates a new anonymous voting identity. Comment drafts stay in browser memory until the page reloads.

## Run with Docker

Set `APP_URL` in [compose.yaml](../compose.yaml) to your instance's public origin. The checked-in Compose configuration expects Cloudflare in front of a loopback-only port; adjust `TRUST_PROXY` for your setup.

```sh
docker compose up -d --build
docker compose ps
curl -fsS http://127.0.0.1:4317/health
```

After pulling an update, rerun `docker compose up -d --build`. The named data volume preserves submissions, votes, comments, and the signing secret across rebuilds. `docker compose down -v` deletes that volume.

Back up the data volume before database changes. Use SQLite's backup API for a running instance, or stop the app before copying the complete data directory. Preserve the signing secret alongside the database. Restore data while the app is stopped.

## Curate games

Add entries to [seeds.json](../seeds.json) with a playable browser link, preview, creator credit, and a primary source for the creator's AI claim. Check that the game starts. An HTTP 200 alone does not prove it works. Record discovery sources and checks in `docs/`.

```sh
npm run import-seeds
```

For a Docker instance:

```sh
docker compose exec web npm run import-seeds
```

The import inserts missing URLs in one transaction. Rerunning it preserves existing listings, votes, timestamps, and moderation state. Curated additions start with zero votes; the feed timestamp records when they were added to the directory.

To update only game-type and play-style tags on existing curated entries:

```sh
npm run import-seeds -- --update-tags
```

In Docker, prefix that command with `docker compose exec web`. Updates require a matching URL and nonempty creator source. Community submissions are preserved.

The available genres, game types, and play styles live in [taxonomy.mjs](../taxonomy.mjs). Curated classifications are editorial descriptions, separate from creator AI claims.

## Moderate games and comments

Submissions and comments appear immediately. Reports go to GitHub issues.

```sh
npm run moderate -- list
npm run moderate -- hide 5
npm run moderate -- restore 5

npm run moderate-comments -- list
npm run moderate-comments -- list 15
npm run moderate-comments -- hide 123
npm run moderate-comments -- restore 123
```

`moderate-comments -- list 15` lists comments on game 15. Hide and restore commands take a comment ID. In Docker, prefix these commands with `docker compose exec web`.

Hiding a game removes it from feeds and disables votes and thread access. Hiding a comment removes it from threads and counts. Both actions preserve the underlying records for review.

## Comment behavior and limits

Comments display Anonymous, a timestamp, and plain text. Threads load the latest 50 comments in chronological order, with earlier pages available through Older comments. Internal IDs support storage and moderation. Retrying a saved post does not duplicate it.

| Action        | Browser limit     | Network limit     |
| ------------- | ----------------- | ----------------- |
| Submit a game | 3 per hour        | 3 per hour        |
| Comment       | 10 per 10 minutes | 30 per 10 minutes |
| Vote          | —                 | 90 per 10 minutes |

Comments are limited to 2,000 characters. A signed, HttpOnly browser cookie and temporary hashed network identifiers support these limits. No commenter-name fields or accounts are stored.

Submitted text is rendered literally. The server validates links, never fetches submitted URLs, and uses parameterized SQL. Preview images load from their hosts; games open on the creator's site. The app has no analytics or third-party script dependencies.

## Check the desktop layout

With an instance running, use the optional browser check to verify that the cabinet fits the viewport and the game list scrolls independently:

```sh
node scripts/check-layout.mjs http://127.0.0.1:4317
```

This check requires Playwright and its browser. Set `PLAYWRIGHT_MODULE` to reuse an installation outside the repository, or `BROWSER_CHANNEL=chrome` to use an installed Chrome. It checks every loaded game's details at common desktop sizes, including 1280 × 720.
