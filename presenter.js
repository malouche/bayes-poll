// presenter.js — the projector screen and the controls that drive every phone.
//
// Keyboard: J join screen · O open · C close · R reveal · N next (opens it)
//           P previous · L leaderboard · H hide control bar · F full screen
import { createBackend, SESSION, IS_LOCAL } from "./backend.js";
import { QUESTIONS, byId } from "./questions.js";
import { KEY } from "./key.js";
import { leaderboard, pointsFor } from "./scoring.js";
import { PUBLIC_URL } from "./firebase-config.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const LETTERS = ["A", "B", "C", "D", "E", "F"];
const COLORS = ["var(--opt-0)", "var(--opt-1)", "var(--opt-2)", "var(--opt-3)"];

let be, data = {}, lastRenderKey = "";

// Address students use. In local rehearsal it points at this same server.
const studentUrl = (() => {
  if (IS_LOCAL) {
    const u = new URL("index.html", location.href);
    u.search = `?local=1&s=${SESSION}`;
    return u.href;
  }
  return SESSION === "live" ? PUBLIC_URL : `${PUBLIC_URL}?s=${SESSION}`;
})();
$("joinUrl").textContent = studentUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

// ── question selector ──────────────────────────────────────────────────────
$("sel").innerHTML = QUESTIONS.map((q, i) =>
  `<option value="${q.id}">${i + 1}. [${q.slide}] ${esc(q.text.slice(0, 50))}${q.text.length > 50 ? "…" : ""}</option>`).join("");
const selected = () => $("sel").value;

// ── start-up / sign-in ─────────────────────────────────────────────────────
async function start() {
  be = await createBackend();
  if (be.kind === "firebase") {
    $("main").innerHTML = `
      <h1 class="stage-q">Presenter sign-in</h1>
      <p class="stage-meta">Only the presenter's Google account can run the session.</p>
      <p><button class="btn" style="max-width:360px" id="signin">Sign in with Google</button></p>
      <p class="stage-meta" id="err"></p>`;
    $("signin").onclick = async () => {
      try { $("who").textContent = await be.ensurePresenter(); go(); }
      catch (e) { $("err").textContent = e.message; }
    };
  } else {
    $("who").textContent = `local rehearsal · session “${SESSION}”`;
    go();
  }
}

function go() {
  be.onSession((d) => { data = d; if (d.state && d.state.q && byId[d.state.q]) $("sel").value = d.state.q; render(); });
  wireControls();
  setInterval(tickTimer, 250);
}

// ── actions ────────────────────────────────────────────────────────────────
const act = {
  join: () => be.setPhase(null, "lobby"),
  open: (qid = selected()) => be.open(qid, !!(data.opened && data.opened[qid])),
  close: () => data.state && data.state.q && be.setPhase(data.state.q, "closed"),
  async reveal() {
    const qid = (data.state && data.state.q) || selected();
    const q = byId[qid];
    if (q && q.scored && KEY[qid]) {
      await be.reveal(qid, KEY[qid]);
      await publishBoard(qid, KEY[qid]);
    } else {
      await be.setPhase(qid, "reveal");
    }
  },
  next() {
    const i = QUESTIONS.findIndex((q) => q.id === selected());
    const nxt = QUESTIONS[Math.min(QUESTIONS.length - 1, i + 1)];
    $("sel").value = nxt.id;
    return act.open(nxt.id);
  },
  prev() {
    const i = QUESTIONS.findIndex((q) => q.id === selected());
    $("sel").value = QUESTIONS[Math.max(0, i - 1)].id;
  },
  async board() { await publishBoard(); await be.setPhase(null, "leaderboard"); },
  async reset() {
    if (!confirm(`Delete ALL players and answers in session “${SESSION}”?`)) return;
    await be.reset();
    try { localStorage.removeItem(`bp-mine:${SESSION}`); } catch {}
  },
};

// Totals + ranks, pushed to phones so every phone shows the same number the
// projector shows. `extraQ` is included even if the reveal write is still in flight.
async function publishBoard(extraQ, extraKey) {
  const d = structuredClone(data);
  if (extraQ) { d.reveals = d.reveals || {}; d.reveals[extraQ] = extraKey; }
  const rows = leaderboard(d);
  const board = {};
  for (const r of rows) {
    const entry = { total: r.total, rank: r.rank, of: rows.length };
    if (extraQ) {
      const a = d.answers && d.answers[extraQ] && d.answers[extraQ][r.uid];
      entry.last = { q: extraQ, pts: pointsFor(extraQ, a, extraKey, d.opened && d.opened[extraQ]) };
    }
    board[r.uid] = entry;
  }
  await be.writeBoard(board);
}

function wireControls() {
  const wrap = (f) => async () => { try { await f(); } catch (e) { console.error(e); alertBar(e.message); } };
  $("bJoin").onclick = wrap(act.join);
  $("bOpen").onclick = wrap(() => act.open());
  $("bClose").onclick = wrap(act.close);
  $("bReveal").onclick = wrap(act.reveal);
  $("bNext").onclick = wrap(act.next);
  $("bBoard").onclick = wrap(act.board);
  $("bReset").onclick = wrap(act.reset);
  $("bHide").onclick = () => document.body.classList.toggle("clean");
  $("bFull").onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "SELECT" || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    const map = { j: act.join, o: () => act.open(), c: act.close, r: act.reveal, n: act.next, p: act.prev,
                  l: act.board, h: () => document.body.classList.toggle("clean"), f: () => $("bFull").click() };
    if (map[k]) { e.preventDefault(); wrap(map[k])(); }
  });
}

function alertBar(msg) { $("who").textContent = "⚠ " + msg; }

// ── rendering ──────────────────────────────────────────────────────────────
function render() {
  const players = data.players || {};
  const n = Object.keys(players).length;
  $("count").textContent = `${n} player${n === 1 ? "" : "s"}`;

  const st = data.state || { phase: "lobby" };
  const q = st.q && byId[st.q];
  const answers = (q && data.answers && data.answers[q.id]) || {};
  $("phaseTag").textContent = q ? `${q.slide} · ${st.phase}` : "";

  // Skip identical re-renders (keeps bar animations smooth).
  const key = JSON.stringify([st, n, q && Object.keys(answers).length, st.phase === "lobby" && Object.keys(players),
                              st.phase === "leaderboard" && leaderboard(data).map((r) => r.total)]);
  if (key === lastRenderKey) return;
  lastRenderKey = key;

  if (st.phase === "leaderboard") return renderBoard();
  if (!q || st.phase === "lobby") return renderJoin(players);
  if (st.phase === "open") return renderOpen(q, answers, n);
  return renderResults(q, answers, st.phase === "reveal");
}

function renderJoin(players) {
  const names = Object.values(players).sort((a, b) => (a.joined || 0) - (b.joined || 0));
  $("main").innerHTML = `
    <div class="join-grid">
      <div class="qr-box" id="qr"></div>
      <div>
        <h1 class="stage-q">Take out your phone 📱</h1>
        <p class="stage-meta" style="font-size:1.5rem">Scan the code, type your name, and play along.<br>
          Fast <b>and</b> correct answers earn more points.</p>
        <p class="stage-meta" style="font-size:1.3rem">${esc(studentUrl)}</p>
        <div class="names">${names.map((p) => `<span class="name-chip">${esc(p.name)}</span>`).join("")}</div>
      </div>
    </div>`;
  drawQR($("qr"), studentUrl);
}

function drawQR(el, text) {
  if (window.QRCode) new window.QRCode(el, { text, width: 480, height: 480, correctLevel: window.QRCode.CorrectLevel.M });
  else el.innerHTML = `<p style="font-size:1.6rem;max-width:320px">${esc(text)}</p>`;
}

function optionList(q) {
  return `<div class="bars">${q.options.map((o, i) => `
    <div class="bar-row"><div class="bar-label" style="grid-column:1 / -1">
      <span class="letter" style="background:${COLORS[i % 4]}">${LETTERS[i]}</span>${esc(o)}</div></div>`).join("")}</div>`;
}

function renderOpen(q, answers, nPlayers) {
  const k = Object.keys(answers).length;
  $("main").innerHTML = `
    <p class="stage-meta">${q.scored ? "⭐ Points: be fast and correct" : "Just for fun · no points"}</p>
    <h1 class="stage-q">${esc(q.text)}</h1>
    ${q.type === "choice" ? optionList(q) : `<p class="waiting">Type a number from ${q.min} to ${q.max}${esc(q.unit || "")} on your phone.</p>`}
    <div style="display:flex;align-items:end;gap:24px;margin-top:auto">
      <div class="answer-count" id="ansCount">${k}</div>
      <div class="waiting">answers${nPlayers ? ` of ${nPlayers}` : ""}</div>
      <div style="flex:1"><div class="timer"><div id="timer"></div></div><div class="stage-meta" id="timerTxt"></div></div>
    </div>`;
  tickTimer();
}

function tickTimer() {
  const st = data.state;
  const el = $("timer");
  if (!el || !st || st.phase !== "open") return;
  const q = byId[st.q];
  const t0 = data.opened && data.opened[st.q];
  if (!q || !t0 || !q.time) { el.parentElement.style.visibility = "hidden"; return; }
  const left = Math.max(0, q.time - (be.serverNow() - t0) / 1000);
  el.style.width = `${(100 * left) / q.time}%`;
  $("timerTxt").textContent = left > 0 ? `speed bonus: ${Math.ceil(left)} s` : "speed bonus over — you can still answer";
}

function renderResults(q, answers, revealed) {
  const vals = Object.values(answers).map((a) => a.v);
  const key = revealed && KEY[q.id];
  const header = `
    <p class="stage-meta">${revealed ? "Answer" : "Closed. What did the room say?"} · ${vals.length} answers</p>
    <h1 class="stage-q">${esc(q.text)}</h1>`;

  if (q.type === "number") return renderHistogram(q, vals, key, header);

  const counts = q.options.map((_, i) => vals.filter((v) => v === i).length);
  const max = Math.max(1, ...counts);
  let extra = "";
  if (revealed && key) {
    // The three fastest correct answers get a shout-out.
    const t0 = data.opened && data.opened[q.id];
    const fastest = Object.entries(answers)
      .filter(([, a]) => a.v === key.answer)
      .sort((a, b) => a[1].t - b[1].t).slice(0, 3)
      .map(([uid, a]) => `${esc(((data.players || {})[uid] || {}).name || "?")} (${((a.t - t0) / 1000).toFixed(1)} s)`);
    const pct = vals.length ? Math.round((100 * counts[key.answer]) / vals.length) : 0;
    extra = `<p class="stage-meta" style="font-size:1.3rem">${pct}% got it right.${fastest.length ? ` Fastest: ${fastest.join(" · ")}` : ""}</p>`;
  }
  $("main").innerHTML = header + `
    <div class="bars">${q.options.map((o, i) => {
      const cls = revealed && key ? (i === key.answer ? "correct" : "dim") : "";
      return `<div class="bar-row ${cls}">
        <div class="bar-label"><span class="letter" style="background:${COLORS[i % 4]}">${LETTERS[i]}</span>${esc(o)}${cls === "correct" ? " ✓" : ""}</div>
        <div class="bar-track"><div class="bar-fill" style="background:${COLORS[i % 4]}" data-w="${(100 * counts[i]) / max}"></div></div>
        <div class="bar-n">${counts[i]}</div></div>`;
    }).join("")}</div>` + extra;
  requestAnimationFrame(() => document.querySelectorAll(".bar-fill").forEach((b) => (b.style.width = b.dataset.w + "%")));
}

// Number questions: 10 bins, the class mean (gold dashed) and, after the
// reveal, the Bayes answer (green). The gap between the two lines is the talk.
function renderHistogram(q, vals, key, header) {
  const bins = 10, w = (q.max - q.min) / bins;
  const counts = Array(bins).fill(0);
  vals.forEach((v) => { counts[Math.min(bins - 1, Math.max(0, Math.floor((v - q.min) / w)))]++; });
  const max = Math.max(1, ...counts);
  const mean = vals.length ? vals.reduce((a, b) => a + Number(b), 0) / vals.length : null;
  const pos = (x) => `${(100 * (x - q.min)) / (q.max - q.min)}%`;
  $("main").innerHTML = header + `
    <div style="padding-top:40px">
      <div class="hist">
        ${counts.map((c) => `<div class="col" data-h="${(100 * c) / max}" style="height:0">${c ? `<span>${c}</span>` : ""}</div>`).join("")}
        ${mean !== null ? `<div class="mean-line" style="left:${pos(mean)}"><b>Class average ${mean.toFixed(1)}${esc(q.unit || "")}</b></div>` : ""}
        ${key ? `<div class="truth-line" style="left:${pos(key.answer)}"><b>Bayes: ${+Number(key.answer).toFixed(1)}${esc(q.unit || "")}</b></div>` : ""}
      </div>
      <div class="hist-axis">${counts.map((_, i) => `<div>${q.min + i * w}–${q.min + (i + 1) * w}</div>`).join("")}</div>
    </div>`;
  requestAnimationFrame(() => document.querySelectorAll(".hist .col").forEach((c) => (c.style.height = c.dataset.h + "%")));
}

function renderBoard() {
  const rows = leaderboard(data).slice(0, 10);
  $("main").innerHTML = `
    <h1 class="stage-q" style="text-align:center">🏆 Leaderboard</h1>
    <div class="board">${rows.map((r, i) => `
      <div class="board-row ${r.rank === 1 ? "top1" : ""}" style="animation-delay:${(rows.length - i) * 0.25}s">
        <span class="rk">${r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : "#" + r.rank}</span>
        <span>${esc(r.name)}</span><span class="pts">${r.total}</span></div>`).join("")}
    </div>`;
}

start();
