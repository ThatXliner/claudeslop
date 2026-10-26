const feed = document.querySelector('#feed');
const dialog = document.querySelector('#submit-dialog');
const form = document.querySelector('#submit-form');
const about = document.querySelector('#about-dialog');
let session;
let games = [];
let sort = location.hash === '#new' ? 'new' : 'hot';
let loading = false;
let toastTimer;
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
function toast(message) {
  const node = document.querySelector('#toast');
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.hidden = true, 5000);
}
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(session ? { 'X-CSRF-Token': session.csrf } : {}), ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not save. Please try again.');
  return data;
}
function age(timestamp) {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}
function externalLink(url, className, text) {
  const link = el('a', className, text);
  link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
  return link;
}
function renderGame(game) {
  const row = el('article', 'game');
  row.id = `game-${game.id}`;
  const vote = el('button', 'vote');
  vote.type = 'button';
  vote.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 10 5-5 5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const count = el('span', '', String(game.points));
  vote.append(count);
  const updateVote = () => { vote.setAttribute('aria-pressed', String(Boolean(game.voted))); vote.setAttribute('aria-label', `${game.voted ? 'Remove vote for' : 'Upvote'} ${game.title}, ${game.points} ${game.points === 1 ? 'point' : 'points'}`); count.textContent = game.points; };
  updateVote();
  vote.addEventListener('click', async () => {
    if (!session) return toast('Still connecting. Please try again in a moment.');
    vote.disabled = true;
    try { Object.assign(game, await api(`/api/games/${game.id}/vote`, { method: 'PUT', body: JSON.stringify({ voted: !game.voted }) })); updateVote(); toast(game.voted ? `Voted for ${game.title}.` : 'Vote removed.'); }
    catch (error) { toast(error.message); }
    finally { vote.disabled = false; }
  });
  const preview = externalLink(game.url, 'preview');
  preview.setAttribute('aria-label', `Play ${game.title} (opens in a new tab)`);
  const fallback = () => { preview.replaceChildren(el('span', 'no-preview', 'No preview yet')); };
  if (game.image) {
    const image = el('img'); image.src = game.image; image.alt = `${game.title} preview`; image.loading = 'lazy'; image.width = 168; image.height = 105; image.referrerPolicy = 'no-referrer';
    image.addEventListener('error', fallback, { once: true }); preview.append(image);
  } else fallback();
  const content = el('div', 'game-content');
  const title = externalLink(game.url, 'game-title', game.title);
  const heading = el('h3'); heading.style.margin = '0'; heading.append(title);
  const description = el('p', 'description', game.description);
  const meta = el('div', 'meta');
  const metadata = [el('span', 'genre', game.genre), el('span', '', game.duration), el('span', '', `by ${game.author}`), el('time', '', age(game.created_at))];
  metadata[3].dateTime = new Date(game.created_at).toISOString();
  metadata[3].title = new Date(game.created_at).toLocaleString();
  const details = el('details', 'ai-details'); details.append(el('summary', '', 'AI details'));
  const note = el('p', '', game.ai_note);
  if (game.source) { note.append(' ', externalLink(game.source, '', 'Creator source ↗')); }
  details.append(note); metadata.push(details);
  if (game.source) metadata.push(el('span', '', 'Curated'));
  metadata.forEach((node, i) => { if (i) { const separator = el('span', 'separator', '·'); separator.setAttribute('aria-hidden', 'true'); meta.append(separator); } meta.append(node); });
  content.append(heading, description, meta);
  const play = externalLink(game.url, 'play', 'Play ↗');
  play.setAttribute('aria-label', `Play ${game.title} (opens in a new tab)`);
  row.append(vote, preview, content, play);
  return row;
}
async function load(append = false) {
  if (loading) return;
  loading = true; const requestedSort = sort; feed.setAttribute('aria-busy', 'true');
  const moreButton = document.querySelector('#load-more');
  moreButton.disabled = true;
  document.querySelector('#feed-error').hidden = true;
  document.querySelectorAll('[data-sort]').forEach(node => node.dataset.sort === sort ? node.setAttribute('aria-current', 'page') : node.removeAttribute('aria-current'));
  document.querySelector('#feed-title').textContent = sort === 'new' ? 'New games' : 'Hot games';
  document.querySelector('#sort-explanation').textContent = sort === 'new' ? 'Fresh out of the prompt box.' : 'Fresh games and community favorites.';
  try {
    const data = await api(`/api/games?sort=${requestedSort}&offset=${append ? games.length : 0}`);
    if (requestedSort !== sort) return;
    if (!append) { games = []; feed.replaceChildren(); }
    games.push(...data.games);
    for (const game of data.games) feed.append(renderGame(game));
    if (!games.length) {
      const empty = el('div', 'empty'); empty.append(el('strong', '', 'The first game could be yours.'), el('p', '', 'Made something weird with AI? Give it a home here.'));
      const submit = el('button', 'secondary', 'Submit a game'); submit.addEventListener('click', () => dialog.showModal()); empty.append(submit); feed.append(empty);
    }
    moreButton.hidden = !data.more;
  } catch (error) {
    if (!append && !games.length) feed.replaceChildren();
    document.querySelector('#feed-error-text').textContent = error.message;
    document.querySelector('#feed-error').hidden = false;
  } finally { loading = false; feed.setAttribute('aria-busy', 'false'); moreButton.disabled = false; if (requestedSort !== sort) load(); }
}
document.querySelector('#open-submit').addEventListener('click', () => dialog.showModal());
document.querySelector('#open-about').addEventListener('click', () => about.showModal());
document.querySelector('#form-guidelines').addEventListener('click', () => about.showModal());
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelector('#load-more').addEventListener('click', () => load(true));
document.querySelector('#retry').addEventListener('click', () => load());
window.addEventListener('hashchange', () => { const next = location.hash === '#new' ? 'new' : 'hot'; if (next !== sort) { sort = next; load(); } });
form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = form.querySelector('[type=submit]');
  const errorNode = document.querySelector('#form-error');
  errorNode.hidden = true;
  if (!session) { errorNode.textContent = 'Could not connect. Refresh the page and try again.'; errorNode.hidden = false; return; }
  button.disabled = true; button.textContent = 'Submitting…';
  try {
    const result = await api('/api/games', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    dialog.close(); form.reset(); sort = 'new'; history.replaceState(null, '', '#new');
    await load();
    const saved = document.querySelector(`#game-${result.id}`);
    saved?.classList.add('new-game'); saved?.scrollIntoView({ behavior: 'instant', block: 'center' });
    toast('Your game is live. Thanks for sharing your slop.');
  } catch (error) { errorNode.textContent = error.message; errorNode.hidden = false; errorNode.scrollIntoView({ block: 'nearest' }); }
  finally { button.disabled = false; button.textContent = 'Submit game ↗'; }
});
async function start() {
  try {
    session = await api('/api/session');
    for (const [name, choices] of [['genre', session.genres], ['duration', session.durations]]) {
      for (const choice of choices) { const option = el('option', '', choice); option.value = choice; form.elements[name].append(option); }
    }
  } catch { toast('Could not connect. Refresh to enable voting and submissions.'); }
  await load();
}
start();
