import { setupComments } from "/comments.js?v=2";

const feed = document.querySelector("#feed");
const detail = document.querySelector("#detail");
const startPlay = document.querySelector("#start-play");
const stick = document.querySelector("#stick");
const dialog = document.querySelector("#submit-dialog");
const form = document.querySelector("#submit-form");
const about = document.querySelector("#about-dialog");
let session;
let games = [];
let selected;
let sort = location.hash === "#new" ? "new" : "hot";
let loading = false;
let toastTimer;
let tiltTimer;
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
function toast(message) {
  const node = document.querySelector("#toast");
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (node.hidden = true), 5000);
}
async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { "X-CSRF-Token": session.csrf } : {}),
      ...options.headers,
    },
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Could not save. Please try again.");
  return data;
}
function age(timestamp) {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}
function externalLink(url, className, text) {
  const link = el("a", className, text);
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}
const points = (game) =>
  `${game.points} ${game.points === 1 ? "point" : "points"}`;
const commentButton = setupComments(api, () => Boolean(session));

// A game can appear in the list, its phone card, and the selected-game
// screen at once, so vote state is painted onto every copy.
function paintVotes(game) {
  for (const vote of document.querySelectorAll(
    `[data-vote-game="${game.id}"]`,
  )) {
    vote.setAttribute("aria-pressed", String(Boolean(game.voted)));
    vote.setAttribute(
      "aria-label",
      `${game.voted ? "Remove vote for" : "Upvote"} ${game.title}, ${points(game)}`,
    );
    vote.querySelector("span").textContent = game.points;
  }
  for (const node of document.querySelectorAll(
    `[data-points-game="${game.id}"]`,
  ))
    node.textContent = points(game);
}
function voteButton(game) {
  const vote = el("button", "vote");
  vote.type = "button";
  vote.dataset.voteGame = game.id;
  vote.innerHTML =
    '<svg viewBox="0 0 10 6" aria-hidden="true"><path d="M4 0h2v1h1v1h1v1h1v1h1v2H0V4h1V3h1V2h1V1h1z"/></svg>';
  vote.append(el("span", "", String(game.points)));
  vote.setAttribute("aria-pressed", String(Boolean(game.voted)));
  vote.setAttribute(
    "aria-label",
    `${game.voted ? "Remove vote for" : "Upvote"} ${game.title}, ${points(game)}`,
  );
  vote.addEventListener("click", async () => {
    if (!session)
      return toast("Still connecting. Please try again in a moment.");
    const copies = document.querySelectorAll(`[data-vote-game="${game.id}"]`);
    copies.forEach((node) => (node.disabled = true));
    try {
      Object.assign(
        game,
        await api(`/api/games/${game.id}/vote`, {
          method: "PUT",
          body: JSON.stringify({ voted: !game.voted }),
        }),
      );
      paintVotes(game);
      toast(game.voted ? `Voted for ${game.title}.` : "Vote removed.");
    } catch (error) {
      toast(error.message);
    } finally {
      document
        .querySelectorAll(`[data-vote-game="${game.id}"]`)
        .forEach((node) => (node.disabled = false));
    }
  });
  return vote;
}
function previewImage(game, width, height) {
  const fallback = () => el("span", "no-preview", "No preview yet");
  if (!game.image) return fallback();
  const image = el("img");
  image.src = game.image;
  image.alt = `${game.title} preview`;
  image.loading = "lazy";
  image.width = width;
  image.height = height;
  image.referrerPolicy = "no-referrer";
  image.addEventListener("error", () => image.replaceWith(fallback()), {
    once: true,
  });
  return image;
}
function renderCard(game, tag, className) {
  const card = el(tag, className);
  const preview = externalLink(game.url, "preview");
  preview.setAttribute("aria-label", `Play ${game.title} (opens in a new tab)`);
  preview.append(previewImage(game, 640, 360));
  const press = el("span", "press-start", "Press start");
  press.setAttribute("aria-hidden", "true");
  preview.append(press);
  const body = el("div", "card-body");
  const heading = el("h3", "game-heading");
  heading.append(externalLink(game.url, "game-title", game.title));
  const description = el("p", "description", game.description);
  const tags = el("ul", "tags");
  tags.setAttribute("aria-label", "Tags");
  const labels = [game.genre, game.play_style];
  if (game.game_type && game.game_type !== "Not specified")
    labels.splice(1, 0, game.game_type);
  labels.forEach((label, i) => tags.append(el("li", i ? "" : "genre", label)));
  const byline = el("p", "byline");
  const time = el("time", "", age(game.created_at));
  time.dateTime = new Date(game.created_at).toISOString();
  time.title = new Date(game.created_at).toLocaleString();
  const parts = [el("span", "", `by ${game.author}`), time];
  if (game.source) parts.push(el("span", "", "Curated"));
  parts.forEach((node, i) => {
    if (i) {
      const separator = el("span", "separator", "·");
      separator.setAttribute("aria-hidden", "true");
      byline.append(separator);
    }
    byline.append(node);
  });
  const details = el("details", "ai-details");
  details.append(el("summary", "", "AI details"));
  const note = el("p", "", game.ai_note);
  if (game.source)
    note.append(" ", externalLink(game.source, "", "Creator source ↗"));
  details.append(note);
  const actions = el("div", "card-actions");
  const play = externalLink(game.url, "play", "Play ↗");
  play.setAttribute("aria-label", `Play ${game.title} (opens in a new tab)`);
  actions.append(voteButton(game), commentButton(game), play);
  body.append(heading, description, tags, byline, actions, details);
  card.append(preview, body);
  return card;
}
function renderGame(game, index) {
  const row = el("article", "game");
  row.id = `game-${game.id}`;
  row.dataset.game = game.id;
  // Wide screens list games as a game-select menu; the selected one fills
  // the screen beside it. Phones skip the menu and show each card.
  const slot = el("button", "slot");
  slot.type = "button";
  slot.tabIndex = -1;
  const number = el("span", "slot-number", String(index + 1).padStart(2, "0"));
  number.setAttribute("aria-hidden", "true");
  const thumb = el("span", "slot-thumb");
  thumb.append(previewImage(game, 80, 50));
  const text = el("span", "slot-text");
  const sub = el("span", "slot-sub");
  const count = el("span", "", points(game));
  count.dataset.pointsGame = game.id;
  sub.append(`${game.genre} · `, count);
  text.append(el("span", "slot-title", game.title), sub);
  slot.append(number, thumb, text);
  slot.addEventListener("click", () => select(game.id));
  row.append(slot, renderCard(game, "div", "card"));
  return row;
}
function attract(title, text) {
  const screen = el("div", "attract");
  screen.append(el("strong", "", title));
  if (text) screen.append(el("p", "", text));
  detail.replaceChildren(screen);
  startPlay.setAttribute("aria-disabled", "true");
  startPlay.setAttribute("aria-label", "Play selected game");
  startPlay.href = "/";
}
function select(id, { scroll = false, focus = false } = {}) {
  const game = games.find((item) => String(item.id) === String(id));
  if (!game) return;
  selected = game.id;
  let current;
  // One tab stop for the whole menu; arrow keys move between games.
  for (const slot of feed.querySelectorAll(".slot")) {
    const isCurrent = slot.parentElement.dataset.game === String(game.id);
    slot.tabIndex = isCurrent ? 0 : -1;
    if (isCurrent) {
      slot.setAttribute("aria-current", "true");
      current = slot;
    } else slot.removeAttribute("aria-current");
  }
  detail.replaceChildren(renderCard(game, "article", "detail-card"));
  startPlay.href = game.url;
  startPlay.removeAttribute("aria-disabled");
  startPlay.setAttribute(
    "aria-label",
    `Play ${game.title} (opens in a new tab)`,
  );
  if (focus) current?.focus({ preventScroll: true });
  if (scroll || focus) current?.scrollIntoView({ block: "nearest" });
}
const position = () => games.findIndex((game) => game.id === selected);
function show(index, focus) {
  if (!games.length) return;
  const next = Math.min(games.length - 1, Math.max(0, index));
  select(games[next].id, { scroll: true, focus });
}
function tilt(direction) {
  stick.dataset.tilt = direction;
  clearTimeout(tiltTimer);
  tiltTimer = setTimeout(() => delete stick.dataset.tilt, 180);
}
async function load(append = false) {
  if (loading) return;
  loading = true;
  const requestedSort = sort;
  feed.setAttribute("aria-busy", "true");
  const moreButton = document.querySelector("#load-more");
  moreButton.disabled = true;
  document.querySelector("#feed-error").hidden = true;
  document
    .querySelectorAll("[data-sort]")
    .forEach((node) =>
      node.dataset.sort === sort
        ? node.setAttribute("aria-current", "page")
        : node.removeAttribute("aria-current"),
    );
  document.querySelector("#feed-title").textContent =
    sort === "new" ? "New games" : "Hot games";
  document.querySelector("#sort-explanation").textContent =
    sort === "new"
      ? "Fresh out of the prompt box."
      : "Fresh games and community favorites.";
  try {
    const data = await api(
      `/api/games?sort=${requestedSort}&offset=${append ? games.length : 0}`,
    );
    if (requestedSort !== sort) return;
    if (!append) {
      games = [];
      feed.replaceChildren();
    }
    const offset = games.length;
    games.push(...data.games);
    data.games.forEach((game, i) => feed.append(renderGame(game, offset + i)));
    const counter = document.querySelector("#game-count");
    counter.textContent = `${games.length}${data.more ? "+" : ""} in 1`;
    counter.hidden = !games.length;
    if (!games.length) {
      const empty = el("div", "empty");
      empty.append(
        el("strong", "", "The first game could be yours."),
        el("p", "", "Made something weird with AI? Give it a home here."),
      );
      const submit = el("button", "secondary", "Submit a game");
      submit.addEventListener("click", () => dialog.showModal());
      empty.append(submit);
      feed.append(empty);
      attract("Insert coin", "No games yet. Submit the first one.");
    } else if (!append) select(games[0].id);
    moreButton.hidden = !data.more;
  } catch (error) {
    if (!append && !games.length) {
      feed.replaceChildren();
      attract("Signal lost", "The game list didn't load.");
    }
    document.querySelector("#feed-error-text").textContent = error.message;
    document.querySelector("#feed-error").hidden = false;
  } finally {
    loading = false;
    feed.setAttribute("aria-busy", "false");
    moreButton.disabled = false;
    if (requestedSort !== sort) load();
  }
}
feed.addEventListener("keydown", (event) => {
  if (!event.target.classList.contains("slot")) return;
  const next = {
    ArrowDown: position() + 1,
    ArrowUp: position() - 1,
    Home: 0,
    End: games.length - 1,
  }[event.key];
  if (next === undefined) return;
  event.preventDefault();
  show(next, true);
});
document.querySelector("#stick-up").addEventListener("click", () => {
  tilt("up");
  show(position() - 1);
});
document.querySelector("#stick-down").addEventListener("click", () => {
  tilt("down");
  show(position() + 1);
});
startPlay.addEventListener("click", (event) => {
  if (startPlay.getAttribute("aria-disabled") === "true")
    event.preventDefault();
});
attract("Loading", "Warming up the tubes…");
document
  .querySelector("#open-submit")
  .addEventListener("click", () => dialog.showModal());
for (const id of ["#open-about", "#open-about-footer", "#form-guidelines"])
  document.querySelector(id).addEventListener("click", () => about.showModal());
document
  .querySelectorAll("[data-close]")
  .forEach((button) =>
    button.addEventListener("click", () => button.closest("dialog").close()),
  );
document
  .querySelector("#load-more")
  .addEventListener("click", () => load(true));
document.querySelector("#retry").addEventListener("click", () => load());
window.addEventListener("hashchange", () => {
  const next = location.hash === "#new" ? "new" : "hot";
  if (next !== sort) {
    sort = next;
    load();
  }
});
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("[type=submit]");
  const errorNode = document.querySelector("#form-error");
  errorNode.hidden = true;
  if (!session) {
    errorNode.textContent =
      "Could not connect. Refresh the page and try again.";
    errorNode.hidden = false;
    return;
  }
  button.disabled = true;
  button.textContent = "Submitting…";
  try {
    const result = await api("/api/games", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    dialog.close();
    form.reset();
    sort = "new";
    history.replaceState(null, "", "#new");
    await load();
    select(result.id, { scroll: true });
    const saved = document.querySelector(`#game-${result.id}`);
    saved?.classList.add("new-game");
    saved?.scrollIntoView({ behavior: "instant", block: "center" });
    toast("Your game is live. Thanks for sharing your slop.");
  } catch (error) {
    errorNode.textContent = error.message;
    errorNode.hidden = false;
    errorNode.scrollIntoView({ block: "nearest" });
  } finally {
    button.disabled = false;
    button.textContent = "Submit game ↗";
  }
});
async function start() {
  try {
    session = await api("/api/session");
    for (const [name, choices] of [
      ["genre", session.genres],
      ["game_type", session.gameTypes],
      ["play_style", session.playStyles],
    ]) {
      for (const choice of choices) {
        const option = el("option", "", choice);
        option.value = choice;
        form.elements[name].append(option);
      }
    }
  } catch {
    toast("Could not connect. Refresh to enable voting and submissions.");
  }
  await load();
}
start();
