import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { openStore } from "./store.mjs";
import { genres, gameTypes, playStyles } from "./taxonomy.mjs";

const { db, secret } = openStore(process.env.DATA_DIR || "./data");
const appOrigin = process.env.APP_URL
  ? new URL(process.env.APP_URL).origin
  : null;
const sign = (value) =>
  createHmac("sha256", secret).update(value).digest("hex");
const equal = (a, b) =>
  typeof a === "string" &&
  typeof b === "string" &&
  a.length === b.length &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
const json = (res, code, value) => {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(value));
};
function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
function session(req, res) {
  const cookie =
    /(?:^|;\s*)slop_session=([^;]+)/.exec(req.headers.cookie || "")?.[1] || "";
  const [id, signature] = cookie.split(".");
  if (id && /^[a-f0-9-]{36}$/.test(id) && equal(signature, sign(id))) return id;
  const fresh = randomUUID();
  res.setHeader(
    "Set-Cookie",
    `slop_session=${fresh}.${sign(fresh)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${appOrigin?.startsWith("https:") ? "; Secure" : ""}`,
  );
  return fresh;
}
function limit(bucket, maximum, window) {
  const since = Date.now() - window;
  if (
    db
      .prepare("SELECT count(*) AS n FROM limits WHERE bucket=? AND at>?")
      .get(bucket, since).n >= maximum
  )
    fail(429, "A little too fast. Please try again later.");
  db.prepare("INSERT INTO limits VALUES (?,?)").run(bucket, Date.now());
  db.prepare("DELETE FROM limits WHERE at<?").run(Date.now() - 86400000);
}
async function body(req) {
  if (!req.headers["content-type"]?.startsWith("application/json"))
    fail(415, "Please send JSON.");
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 12000) fail(413, "That submission is too long.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    fail(400, "Could not read that submission.");
  }
}
function text(value, label, min, max) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max
  )
    fail(400, `${label} must be ${min}–${max} characters.`);
  return value.trim();
}
function webUrl(value, label, optional = false) {
  if (optional && !value) return "";
  let url;
  try {
    url = new URL(text(value, label, 8, 1500));
  } catch (error) {
    if (error.status) throw error;
    fail(400, `${label} needs a full https:// address.`);
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    !url.hostname.includes(".") ||
    /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(
      url.hostname,
    ) ||
    url.hostname.endsWith(".local")
  )
    fail(400, `${label} must point to a public website.`);
  if (label === "Preview image" && url.protocol !== "https:")
    fail(400, "Preview images need an https:// address.");
  return url.href;
}
const assets = new Map([
  ["/", "index.html"],
  ["/app.js", "app.js"],
  ["/style.css", "style.css"],
  ["/favicon.svg", "favicon.svg"],
]);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
};
const server = createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'",
  );
  try {
    const url = new URL(req.url, "http://localhost");
    if (req.method === "GET" && url.pathname === "/health")
      return json(res, 200, { ok: true });
    if (url.pathname.startsWith("/api/")) {
      const voter = session(req, res);
      const csrf = sign(`csrf:${voter}`);
      if (req.method === "GET" && url.pathname === "/api/session")
        return json(res, 200, { csrf, genres, gameTypes, playStyles });
      if (req.method !== "GET") {
        if (!equal(req.headers["x-csrf-token"], csrf))
          fail(403, "Please refresh the page and try again.");
        if (
          req.headers.origin &&
          req.headers.origin !== (appOrigin || `http://${req.headers.host}`)
        )
          fail(403, "Please submit from this website.");
      }
      if (req.method === "GET" && url.pathname === "/api/games") {
        const sort = url.searchParams.get("sort") === "new" ? "new" : "hot";
        const offset = Math.min(
          100000,
          Math.max(
            0,
            Number.parseInt(url.searchParams.get("offset") || "0", 10) || 0,
          ),
        );
        const order =
          sort === "new"
            ? "g.created_at DESC, g.id DESC"
            : "((count(v.voter)+1.0) / pow((max(0, (? - g.created_at)/3600000.0)+2),1.35)) DESC, g.id DESC";
        const query = `SELECT g.*,count(v.voter) AS points, max(CASE WHEN v.voter=? THEN 1 ELSE 0 END) AS voted FROM games g LEFT JOIN votes v ON v.game_id=g.id WHERE g.hidden=0 GROUP BY g.id ORDER BY ${order} LIMIT 31 OFFSET ?`;
        const rows = db
          .prepare(query)
          .all(
            ...(sort === "new" ? [voter, offset] : [voter, Date.now(), offset]),
          );
        return json(res, 200, {
          games: rows.slice(0, 30),
          more: rows.length > 30,
        });
      }
      const ip = sign(
        `ip:${process.env.TRUST_PROXY === "true" ? req.headers["cf-connecting-ip"] || req.socket.remoteAddress : req.socket.remoteAddress}`,
      );
      if (req.method === "POST" && url.pathname === "/api/games") {
        const data = await body(req);
        if (!data || typeof data !== "object")
          fail(400, "Please fill in the form.");
        if (data.website) fail(400, "Could not accept that submission.");
        const game = {
          title: text(data.title, "Title", 2, 80),
          url: webUrl(data.url, "Game link"),
          description: text(data.description, "Description", 10, 240),
          author: text(data.author || "anonymous", "Name", 2, 40),
          image: webUrl(data.image, "Preview image", true),
          genre: data.genre,
          play_style: data.play_style,
          game_type: data.game_type,
          ai_note: text(data.ai_note, "AI details", 5, 280),
        };
        if (
          !genres.includes(game.genre) ||
          !playStyles.includes(game.play_style) ||
          !gameTypes.includes(game.game_type)
        )
          fail(400, "Choose a genre, game type, and play style.");
        if (db.prepare("SELECT id FROM games WHERE url=?").get(game.url))
          fail(409, "This game is already in the directory.");
        limit(`submit:${ip}`, 3, 3600000);
        limit(`submit:${voter}`, 3, 3600000);
        const result = db
          .prepare(
            "INSERT INTO games (title,url,description,author,image,genre,play_style,game_type,ai_note,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
          )
          .run(
            game.title,
            game.url,
            game.description,
            game.author,
            game.image,
            game.genre,
            game.play_style,
            game.game_type,
            game.ai_note,
            Date.now(),
          );
        return json(res, 201, { id: Number(result.lastInsertRowid) });
      }
      const match = /^\/api\/games\/(\d+)\/vote$/.exec(url.pathname);
      if (req.method === "PUT" && match) {
        const data = await body(req);
        if (typeof data?.voted !== "boolean")
          fail(400, "Choose whether to vote.");
        const id = Number(match[1]);
        if (!db.prepare("SELECT id FROM games WHERE id=? AND hidden=0").get(id))
          fail(404, "This game is no longer listed.");
        limit(`vote:${ip}`, 90, 600000);
        if (data.voted)
          db.prepare("INSERT OR IGNORE INTO votes VALUES (?,?)").run(id, voter);
        else
          db.prepare("DELETE FROM votes WHERE game_id=? AND voter=?").run(
            id,
            voter,
          );
        return json(res, 200, {
          points: db
            .prepare("SELECT count(*) AS n FROM votes WHERE game_id=?")
            .get(id).n,
          voted: data.voted,
        });
      }
      return json(res, 404, { error: "Not found." });
    }
    if (!["GET", "HEAD"].includes(req.method))
      return json(res, 405, { error: "Method not allowed." });
    let asset = assets.get(url.pathname);
    if (/^\/previews\/[a-z0-9-]+\.(webp|png|jpg)$/.test(url.pathname))
      asset = url.pathname.slice(1);
    if (!asset) return json(res, 404, { error: "Not found." });
    let contents;
    try {
      contents = await readFile(resolve("public", asset));
    } catch (error) {
      if (error.code === "ENOENT") fail(404, "Not found.");
      throw error;
    }
    res.writeHead(200, {
      "Content-Type": types[extname(asset)],
      "Cache-Control": [".html", ".js", ".css"].includes(extname(asset))
        ? "no-cache"
        : "public, max-age=3600",
    });
    res.end(req.method === "HEAD" ? undefined : contents);
  } catch (error) {
    if (!error.status) console.error(error);
    json(res, error.status || 500, {
      error: error.status
        ? error.message
        : "Something went wrong. Please try again.",
    });
  }
});
server.listen(
  Number(process.env.PORT || 4317),
  process.env.HOST || "127.0.0.1",
  () =>
    console.log(
      `Claudeslop listening on ${process.env.HOST || "127.0.0.1"}:${server.address().port}`,
    ),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () =>
    server.close(() => {
      db.close();
      process.exit(0);
    }),
  );
