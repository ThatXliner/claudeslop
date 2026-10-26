const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export function setupComments(api, isReady) {
  const dialog = document.querySelector("#comments-dialog");
  const title = document.querySelector("#comments-title");
  const list = document.querySelector("#comments-list");
  const scroll = document.querySelector("#comments-scroll");
  const status = document.querySelector("#comments-status");
  const older = document.querySelector("#comments-older");
  const retry = document.querySelector("#comments-retry");
  const form = document.querySelector("#comment-form");
  const input = form.elements.body;
  const submit = form.querySelector("[type=submit]");
  const error = document.querySelector("#comment-error");
  const drafts = new Map();
  let active;
  let comments = [];
  let generation = 0;
  let fetching = false;
  let retryOlder = false;
  const stateFor = (id) => {
    if (!drafts.has(id))
      drafts.set(id, {
        text: "",
        requestId: crypto.randomUUID(),
        posting: false,
      });
    return drafts.get(id);
  };
  function updateCount(game, count) {
    game.comment_count = count;
    for (const button of document.querySelectorAll(
      `[data-comments-game="${game.id}"]`,
    )) {
      button.textContent = `${count} ${count === 1 ? "comment" : "comments"}`;
      button.setAttribute(
        "aria-label",
        `${count} ${count === 1 ? "comment" : "comments"} on ${game.title}`,
      );
    }
  }
  function controls() {
    const posting = active && stateFor(active.id).posting;
    input.disabled = Boolean(posting);
    submit.disabled = Boolean(posting) || !isReady();
    submit.textContent = posting ? "Posting…" : "Post comment";
  }
  function saveDraft() {
    if (!active) return;
    const state = stateFor(active.id);
    state.text = input.value;
    state.requestId = crypto.randomUUID();
  }
  input.addEventListener("input", saveDraft);
  function reference(id) {
    const target = document.querySelector(`#comment-${id}`);
    if (!target) return;
    target.scrollIntoView({ block: "nearest" });
    target.focus({ preventScroll: true });
    target.classList.add("referenced");
    setTimeout(() => target.classList.remove("referenced"), 1500);
  }
  function render() {
    const ids = new Set(comments.map((c) => c.id));
    list.replaceChildren();
    for (const comment of comments) {
      const row = element("article", "comment");
      row.id = `comment-${comment.id}`;
      row.tabIndex = -1;
      const meta = element("div", "comment-meta");
      const number = element(
        "button",
        "inline-button comment-number",
        `No.${comment.id}`,
      );
      number.type = "button";
      number.setAttribute("aria-label", `Quote comment ${comment.id}`);
      const reply = () => {
        if (stateFor(active.id).posting) return;
        input.value = `${input.value.trimEnd()}${input.value.trim() ? "\n" : ""}>>${comment.id}\n`;
        saveDraft();
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      };
      number.addEventListener("click", reply);
      const time = element(
        "time",
        "",
        new Date(comment.created_at).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
      );
      time.dateTime = new Date(comment.created_at).toISOString();
      meta.append(element("strong", "", "Anonymous"), number, time);
      const body = element("p", "comment-body");
      for (const [index, line] of comment.body.split("\n").entries()) {
        if (index) body.append("\n");
        const container = element(
          "span",
          line.startsWith(">") && !line.startsWith(">>") ? "quoted-line" : "",
        );
        let end = 0;
        for (const match of line.matchAll(/>>([1-9]\d{0,14})\b/g)) {
          const id = Number(match[1]);
          container.append(line.slice(end, match.index));
          if (ids.has(id)) {
            const link = element("button", "quote-ref", match[0]);
            link.type = "button";
            link.setAttribute("aria-label", `Go to comment ${id}`);
            link.addEventListener("click", () => reference(id));
            container.append(link);
          } else container.append(match[0]);
          end = match.index + match[0].length;
        }
        container.append(line.slice(end));
        body.append(container);
      }
      const actions = element("div", "comment-actions");
      const replyButton = element("button", "inline-button", "Reply");
      replyButton.type = "button";
      replyButton.setAttribute("aria-label", `Reply to comment ${comment.id}`);
      replyButton.addEventListener("click", reply);
      const report = element("a", "", "Report");
      const reportUrl = new URL(
        "https://github.com/ThatXliner/claudeslop/issues/new",
      );
      reportUrl.searchParams.set("template", "report.yml");
      reportUrl.searchParams.set("game", `${active.title} — ${active.url}`);
      reportUrl.searchParams.set("reason", `Comment No.${comment.id}:\n`);
      report.href = reportUrl.href;
      report.target = "_blank";
      report.rel = "noopener noreferrer";
      report.setAttribute(
        "aria-label",
        `Report comment ${comment.id} on GitHub (opens in a new tab)`,
      );
      actions.append(replyButton, report);
      row.append(meta, body, actions);
      list.append(row);
    }
  }
  async function load(loadOlder = false) {
    if (!active || fetching) return;
    const game = active;
    const current = ++generation;
    fetching = true;
    list.setAttribute("aria-busy", "true");
    older.disabled = true;
    retry.hidden = true;
    status.hidden = false;
    status.textContent = "Loading comments…";
    const height = scroll.scrollHeight;
    const top = scroll.scrollTop;
    try {
      const before =
        loadOlder && comments.length ? `?before=${comments[0].id}` : "";
      const data = await api(`/api/games/${game.id}/comments${before}`);
      if (current !== generation) return;
      comments = loadOlder ? [...data.comments, ...comments] : data.comments;
      render();
      older.hidden = !data.more;
      updateCount(game, data.count);
      status.textContent = comments.length
        ? ""
        : "No comments yet. Start the thread.";
      status.hidden = comments.length > 0;
      if (loadOlder) scroll.scrollTop = top + scroll.scrollHeight - height;
      else scroll.scrollTop = 0;
      return true;
    } catch (problem) {
      if (current !== generation) return;
      status.textContent = problem.message;
      retry.hidden = false;
      retryOlder = loadOlder;
    } finally {
      if (current === generation) {
        fetching = false;
        older.disabled = false;
        list.setAttribute("aria-busy", "false");
      }
    }
  }
  older.addEventListener("click", () => load(true));
  retry.addEventListener("click", () => load(retryOlder));
  dialog.addEventListener("close", () => {
    generation++;
    fetching = false;
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!active || stateFor(active.id).posting) return;
    if (!isReady()) {
      error.textContent = "Please refresh the page and try again.";
      error.hidden = false;
      return;
    }
    const game = active;
    const state = stateFor(game.id);
    state.posting = true;
    error.hidden = true;
    controls();
    try {
      const data = await api(`/api/games/${game.id}/comments`, {
        method: "POST",
        body: JSON.stringify({
          body: state.text,
          request_id: state.requestId,
          website: form.elements.website.value,
        }),
      });
      state.text = "";
      state.requestId = crypto.randomUUID();
      updateCount(game, data.count);
      if (dialog.open && active.id === game.id) {
        input.value = "";
        // Invalidate any older-page request before refreshing the saved comment.
        generation++;
        fetching = false;
        if (!comments.some((comment) => comment.id === data.comment.id))
          comments.push(data.comment);
        render();
        const refreshed = await load();
        reference(data.comment.id);
        if (refreshed) {
          status.textContent = "Comment posted.";
          status.hidden = false;
        }
      }
    } catch (problem) {
      if (dialog.open && active.id === game.id) {
        error.textContent = problem.message;
        error.hidden = false;
      }
    } finally {
      state.posting = false;
      if (active?.id === game.id) controls();
    }
  });
  return (game) => {
    const button = element("button", "comment-count");
    button.type = "button";
    button.dataset.commentsGame = game.id;
    const count = game.comment_count || 0;
    button.textContent = `${count} ${count === 1 ? "comment" : "comments"}`;
    button.setAttribute(
      "aria-label",
      `${count} ${count === 1 ? "comment" : "comments"} on ${game.title}`,
    );
    button.addEventListener("click", () => {
      active = game;
      generation++;
      fetching = false;
      comments = [];
      title.textContent = `Comments on ${game.title}`;
      list.replaceChildren();
      older.hidden = true;
      retry.hidden = true;
      error.hidden = true;
      input.value = stateFor(game.id).text;
      form.elements.website.value = "";
      controls();
      dialog.showModal();
      title.focus();
      load();
    });
    return button;
  };
}
