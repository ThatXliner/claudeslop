# Claudeslop

A small directory of games made with AI. Browse Hot or New, open a game, vote, and submit a playable link. No account required.

Live at **https://claudeslop.bryanhu.com**.

## Run locally

Use Node 22.13 or later. Production uses Node 24 in Docker. There are no runtime npm dependencies.

```sh
npm start
```

Open http://127.0.0.1:4317. SQLite data and a session-signing secret are created in `data/`. The four curated games in `seeds.json` load only when the database has no games. Set `SEED=false` to start empty.

```sh
npm test
```

The integration test uses a temporary database and checks submission validation, duplicate detection, vote toggling, independent browser identities, persistence after restart, CSRF protection, and submission rate limits.

## Deploy on big-mac

The checkout lives at `/Users/bhu/Developer/claudeslop`. The Docker container listens on host loopback port 4317. The existing Cloudflare Tunnel maps `claudeslop.bryanhu.com` to that port.

```sh
ssh big-mac
cd ~/Developer/claudeslop
git pull --ff-only
docker compose up -d --build
docker compose ps
curl -fsS http://127.0.0.1:4317/health
```

The named Docker volume `claudeslop_claudeslop-data` holds the SQLite database and cookie secret. Container rebuilds preserve it. `docker compose down -v` deletes it, so do not use that command to update the app.

Cloudflare Tunnel configuration is in `/Users/bhu/.cloudflared/config.yml`. Its launch agent is `com.bryanhu.cloudflared`. The tunnel is shared with other services. Preserve their ingress entries when changing it.

## Moderate submissions

Submissions appear immediately. List games, then hide or restore an ID:

```sh
docker compose exec web npm run moderate -- list
docker compose exec web npm run moderate -- hide 5
docker compose exec web npm run moderate -- restore 5
```

Game reports go to this repository's issue form. Hiding a game removes it from feeds and disables votes; it preserves its submission and votes for review.

## Back up data

Create a consistent SQLite backup with Node's SQLite backup API, then copy it and the signing secret out of the container:

```sh
docker compose exec web node --input-type=module -e 'import {DatabaseSync,backup} from "node:sqlite"; const db=new DatabaseSync("/data/claudeslop.sqlite"); await backup(db,"/data/backup.sqlite"); db.close();'
mkdir -p ~/Backups/claudeslop
docker cp claudeslop:/data/backup.sqlite ~/Backups/claudeslop/claudeslop.sqlite
docker cp claudeslop:/data/session-secret ~/Backups/claudeslop/session-secret
```

Keep backups private. To restore, stop the app, replace the database and secret in its data volume, remove any stale `-wal` and `-shm` files from the stopped database, and start the container.

## Configuration

- `PORT`: 4317 by default.
- `HOST`: 127.0.0.1 by default; Docker uses 0.0.0.0 inside its container.
- `DATA_DIR`: `./data` locally; `/data` in Docker.
- `APP_URL`: canonical public origin. Set in Compose; enables Secure cookies and origin checks.
- `TRUST_PROXY`: trust Cloudflare's connecting-IP header only when `true`. Compose enables it because the port is loopback-only behind the tunnel. Leave it off for an exposed direct server.
- `SEED`: set to `false` to disable initial curated entries.

Votes use a signed, HttpOnly browser cookie. Clearing cookies creates a new voting identity. Submission limits allow three posts per hour per browser and network identifier; votes allow 90 requests per ten minutes per network identifier. This is basic prototype spam protection, not a replacement for accounts or stronger abuse controls.

Submissions are plain text; the browser renders them with `textContent`. The server validates links, never fetches submitted URLs, and uses parameterized SQL. Preview images load directly from their hosts. Submitted games open externally. There are no analytics or third-party script dependencies.

Interface research and creator attribution are recorded in [docs/design.md](docs/design.md).
