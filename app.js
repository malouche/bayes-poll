// app.js — the student phone app.
// Flow: join (nickname) → wait → answer when a question opens → see result
// after the reveal → final rank on the leaderboard.
import { createBackend, SESSION, IS_LOCAL } from "./backend.js";
import { byId } from "./questions.js";

const $app = document.getElementById("app");
const $score = document.getElementById("score");
const $who = document.getElementById("who");
const $banner = document.getElementById("banner");
const LETTERS = ["A", "B", "C", "D", "E", "F"];

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Remember what this phone answered, so a reload does not re-ask.
const MINE_KEY = `bp-mine:${SESSION}`;
const mine = (() => { try { return JSON.parse(localStorage.getItem(MINE_KEY)) || {}; } catch { return {}; } })();
const saveMine = () => { try { localStorage.setItem(MINE_KEY, JSON.stringify(mine)); } catch {} };

let be, uid, view = {}, lastKey = "";

function banner(msg) {
  $banner.textContent = msg || "";
  $banner.classList.toggle("hidden", !msg);
}

async function main() {
  if (IS_LOCAL) banner(`Rehearsal mode (local) · session “${SESSION}”`);
  try {
    be = await createBackend();
    uid = await be.ensureStudent();
  } catch (e) {
    $app.innerHTML = `<h2>Could not connect</h2><p class="muted">${esc(e.message)}</p>
      <button class="btn" onclick="location.reload()">Try again</button>`;
    return;
  }
  be.onStudent(uid, (v) => { view = v; render(); });
  window.addEventListener("online", () => banner(IS_LOCAL ? banner.textContent : ""));
  window.addEventListener("offline", () => banner("You are offline. Reconnect to keep playing."));
}

// Render only when something the student can see has changed; otherwise a
// half-typed nickname or a moving slider would be wiped on every update.
function render() {
  const { state, reveals, me, player } = view;
  const total = me ? me.total : 0;
  $score.textContent = `${total} pts`;
  $who.textContent = player ? player.name : "Bayes Seminar";

  const q = state && state.q;
  const key = JSON.stringify([!!player, state, q && reveals && reveals[q], q && mine[q], me]);
  if (key === lastKey) return;
  lastKey = key;

  if (!player) return renderJoin();
  if (!state || !state.phase || state.phase === "lobby") return renderWait();
  if (state.phase === "leaderboard") return renderFinal();

  const qq = byId[q];
  if (!qq) return renderWait();
  if (state.phase === "open" && mine[q] === undefined) return renderQuestion(qq);
  if (state.phase === "reveal") return renderReveal(qq);
  return renderLocked(qq, state.phase);
}

function renderJoin() {
  $app.className = "screen center";
  $app.innerHTML = `
    <div class="tick">👋</div>
    <h1>Welcome!</h1>
    <p class="muted">Type your first name or a nickname.<br>It will appear on the big screen.</p>
    <input id="name" type="text" maxlength="20" autocomplete="nickname" placeholder="Your name" autofocus>
    <button class="btn" id="go">Join</button>`;
  const $n = document.getElementById("name"), $go = document.getElementById("go");
  const go = async () => {
    const name = $n.value.trim().replace(/\s+/g, " ").slice(0, 20);
    if (!name) { $n.focus(); return; }
    $go.disabled = true;
    try { await be.join(uid, name); }
    catch (e) { $go.disabled = false; alert("Could not join: " + e.message); }
  };
  $go.onclick = go;
  $n.onkeydown = (e) => { if (e.key === "Enter") go(); };
}

function renderWait() {
  const p = view.player;
  $app.className = "screen center";
  $app.innerHTML = `
    <div class="tick">✅</div>
    <h1>You are in, ${esc(p.name)}!</h1>
    <p class="muted">Look at the big screen.<br>Questions will appear here.</p>`;
}

function renderQuestion(q) {
  $app.className = "screen";
  const tag = q.scored ? `<span class="pill">Points</span>` : `<span class="pill">Just for fun · no points</span>`;
  if (q.type === "number") {
    // No default value: a pre-set slider would anchor everyone's guess.
    $app.innerHTML = `
      <div>${tag}</div>
      <h2>${esc(q.text)}</h2>
      <div class="card slider-wrap">
        <div class="big" style="text-align:center"><span id="val">?</span>${esc(q.unit || "")}</div>
        <input id="rng" type="range" min="${q.min}" max="${q.max}" step="1" value="${(q.min + q.max) / 2}" style="opacity:.45">
        <input id="num" type="number" inputmode="decimal" min="${q.min}" max="${q.max}" placeholder="Move the slider or type a number">
      </div>
      <button class="btn gold" id="send" disabled>Send my guess</button>`;
    const $r = document.getElementById("rng"), $n = document.getElementById("num"),
          $v = document.getElementById("val"), $s = document.getElementById("send");
    const touched = () => { $r.style.opacity = 1; $s.disabled = false; };
    $r.oninput = () => { $n.value = $r.value; $v.textContent = $r.value; touched(); };
    $n.oninput = () => {
      if ($n.value === "") return;
      const x = Math.min(q.max, Math.max(q.min, Number($n.value) || 0));
      $v.textContent = x; $r.value = x; touched();
    };
    $s.onclick = (e) => {
      const x = Math.min(q.max, Math.max(q.min, Number($n.value)));
      if ($n.value === "" || !Number.isFinite(x)) return;
      submit(q, x, e.target);
    };
    return;
  }
  $app.innerHTML = `
    <div>${tag}</div>
    <h2>${esc(q.text)}</h2>
    <div class="options">
      ${q.options.map((o, i) => `
        <button class="opt opt-${i % 4}" data-i="${i}"><span class="letter">${LETTERS[i]}</span><span>${esc(o)}</span></button>`).join("")}
    </div>`;
  $app.querySelectorAll(".opt").forEach((b) => (b.onclick = () => submit(q, Number(b.dataset.i), b)));
}

async function submit(q, v, el) {
  $app.querySelectorAll("button").forEach((b) => (b.disabled = true));
  if (el) el.style.outline = "4px solid #111";
  try {
    await be.answer(uid, q.id, v);
    mine[q.id] = v; saveMine(); lastKey = ""; render();
  } catch (e) {
    // Rules reject late or duplicate answers.
    mine[q.id] = null; saveMine(); lastKey = ""; render();
  }
}

function yourAnswerText(q, v) {
  if (v === undefined || v === null) return "You did not answer.";
  return q.type === "number" ? `You said ${v}${q.unit || ""}.` : `You said ${LETTERS[v]}: ${esc(q.options[v])}.`;
}

function renderLocked(q, phase) {
  const v = mine[q.id];
  $app.className = "screen center";
  if (v === undefined || v === null) {
    $app.innerHTML = `<div class="tick">⏱️</div><h1>Time is up for this one</h1><p class="muted">Wait for the next question.</p>`;
  } else {
    $app.innerHTML = `<div class="tick">📨</div><h1>Answer sent</h1><p class="muted">${yourAnswerText(q, v)}</p>
      <p class="muted">${phase === "open" ? "Waiting for the others…" : "Wait for the answer on the big screen."}</p>`;
  }
}

function renderReveal(q) {
  const r = (view.reveals || {})[q.id];
  const v = mine[q.id];
  const me = view.me;
  const pts = me && me.last && me.last.q === q.id ? me.last.pts : 0;
  const rankLine = me ? `<p class="muted">You are <b>#${me.rank}</b> of ${me.of}.</p>` : "";
  $app.className = "screen center";

  if (!q.scored || !r) {
    $app.innerHTML = `<div class="tick">🙌</div><h1>Thanks!</h1><p class="muted">This one was just for fun.</p>${rankLine}`;
    return;
  }
  if (q.type === "number") {
    const answered = v !== undefined && v !== null;
    $app.innerHTML = `
      <div class="tick">🎯</div>
      <h1>Bayes says ${+Number(r.answer).toFixed(1)}${esc(q.unit || "")}</h1>
      <p class="muted">${yourAnswerText(q, v)}</p>
      ${answered ? `<div class="big">+${pts}</div>` : ""}
      ${rankLine}`;
    return;
  }
  const ok = v === r.answer;
  $app.innerHTML = `
    <div class="tick">${ok ? "🎉" : (v === undefined || v === null ? "⏱️" : "🤔")}</div>
    <h1 class="${ok ? "result-ok" : "result-bad"}">${ok ? "Correct!" : "Not this time"}</h1>
    <p class="muted">${yourAnswerText(q, v)}</p>
    <p>Answer: <b>${LETTERS[r.answer]}: ${esc(q.options[r.answer])}</b></p>
    ${ok ? `<div class="big">+${pts}</div>` : `<p class="muted">Good try! Being wrong here is how the idea sticks.</p>`}
    ${rankLine}`;
}

function renderFinal() {
  const me = view.me;
  $app.className = "screen center";
  const medal = me && me.rank <= 3 ? ["🥇", "🥈", "🥉"][me.rank - 1] : "🏁";
  $app.innerHTML = `
    <div class="tick">${medal}</div>
    <h1>Final score</h1>
    <div class="big">${me ? me.total : 0}</div>
    <p class="muted">${me ? `You finished <b>#${me.rank}</b> of ${me.of}.` : ""}</p>
    <p class="muted">Thank you for playing!</p>`;
}

main();
