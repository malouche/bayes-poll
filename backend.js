// backend.js — the only file that talks to storage.
//
// Two interchangeable backends with the same interface:
//   * Firebase Realtime Database (the real thing, used in the lecture room)
//   * "local": localStorage + BroadcastChannel, for rehearsing on ONE computer
//     with several browser tabs, no internet needed. Add ?local=1 to the URL.
//
// Database layout (one subtree per session, e.g. sessions/live):
//   state            {q: questionId|null, phase: lobby|open|closed|reveal|leaderboard}
//   opened/{q}       server timestamp when the question was first opened
//   reveals/{q}      {answer, tol?}   written by the presenter on "Reveal"
//   players/{uid}    {name, joined}
//   answers/{q}/{uid} {v, t}          one answer per player per question
//   board/{uid}      {total, rank, of} written by the presenter after each reveal
import { FIREBASE_CONFIG, ADMIN_EMAIL } from "./firebase-config.js";

const params = new URLSearchParams(location.search);
export const SESSION = (params.get("s") || "live").replace(/[^a-z0-9_-]/gi, "").slice(0, 24) || "live";
export const IS_LOCAL = params.get("local") === "1" || !FIREBASE_CONFIG.apiKey;

export async function createBackend() {
  return IS_LOCAL ? localBackend(SESSION) : firebaseBackend(SESSION);
}

// ─────────────────────────────────────────────────────────────────────────────
// Firebase
// ─────────────────────────────────────────────────────────────────────────────
async function firebaseBackend(s) {
  const V = "10.14.1";
  const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);
  const A = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`);
  const D = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-database.js`);

  const app = initializeApp(FIREBASE_CONFIG);
  const auth = A.getAuth(app);
  const db = D.getDatabase(app);
  const root = `sessions/${s}`;
  const r = (p = "") => D.ref(db, p ? `${root}/${p}` : root);

  // Clock offset between this device and the Firebase server (ms).
  let offset = 0;
  D.onValue(D.ref(db, ".info/serverTimeOffset"), (snap) => { offset = snap.val() || 0; });

  // Wait for any persisted sign-in to be restored before deciding what to do.
  await new Promise((res) => { const off = A.onAuthStateChanged(auth, () => { off(); res(); }); });

  return {
    kind: "firebase",
    serverNow: () => Date.now() + offset,

    // Students: anonymous sign-in, persisted on the phone across reloads.
    async ensureStudent() {
      if (!auth.currentUser) await A.signInAnonymously(auth);
      return auth.currentUser.uid;
    },

    // Presenter: Google sign-in; only ADMIN_EMAIL may write state (see rules).
    async ensurePresenter() {
      const u = auth.currentUser;
      if (u && !u.isAnonymous && u.email === ADMIN_EMAIL) return u.email;
      const res = await A.signInWithPopup(auth, new A.GoogleAuthProvider());
      if (res.user.email !== ADMIN_EMAIL) {
        await A.signOut(auth);
        throw new Error(`Signed in as ${res.user.email}, but only ${ADMIN_EMAIL} can run the session.`);
      }
      return res.user.email;
    },

    // Presenter view: the whole session, re-delivered on every change.
    onSession(cb) { return D.onValue(r(), (snap) => cb(snap.val() || {})); },

    // Student view: only what one phone needs (keeps traffic small).
    onStudent(uid, cb) {
      const view = {};
      const keys = { state: "state", reveals: "reveals", opened: "opened", me: `board/${uid}`, player: `players/${uid}` };
      const offs = Object.entries(keys).map(([k, p]) =>
        D.onValue(r(p), (snap) => { view[k] = snap.val(); cb({ ...view }); }));
      return () => offs.forEach((f) => f());
    },

    // If the first write is refused (seen once on iPhone: the database had not
    // yet received the fresh sign-in token), renew the token and retry once.
    async join(uid, name) {
      const w = () => D.set(r(`players/${uid}`), { name, joined: D.serverTimestamp() });
      try { await w(); }
      catch (e) {
        if (!/PERMISSION_DENIED/i.test(e.message) || !auth.currentUser) throw e;
        await auth.currentUser.getIdToken(true);
        await new Promise((res) => setTimeout(res, 800));
        await w();
      }
    },
    answer: (uid, qid, v) => D.set(r(`answers/${qid}/${uid}`), { v, t: D.serverTimestamp() }),

    async open(qid, alreadyOpened) {
      const upd = { state: { q: qid, phase: "open" } };
      if (!alreadyOpened) upd[`opened/${qid}`] = D.serverTimestamp();
      await D.update(r(), upd);
    },
    setPhase: (qid, phase) => D.set(r("state"), { q: qid, phase }),
    reveal: (qid, key) => D.update(r(), { state: { q: qid, phase: "reveal" }, [`reveals/${qid}`]: key }),
    writeBoard: (board) => D.set(r("board"), board),
    reset: () => D.remove(r()),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Local (rehearsal) backend — same interface, one browser, many tabs.
// ─────────────────────────────────────────────────────────────────────────────
function localBackend(s) {
  const KEY = `bayes-poll:${s}`;
  const chan = "BroadcastChannel" in window ? new BroadcastChannel(KEY) : null;
  const listeners = new Set();

  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const emit = () => { const d = read(); listeners.forEach((f) => f(d)); };
  const write = (mutate) => {
    const d = read(); mutate(d);
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {}
    chan && chan.postMessage("x"); emit();
  };
  chan && (chan.onmessage = emit);
  window.addEventListener("storage", (e) => e.key === KEY && emit());

  const setPath = (d, path, val) => {
    const parts = path.split("/"); let o = d;
    for (const p of parts.slice(0, -1)) o = o[p] = o[p] || {};
    o[parts.at(-1)] = val;
  };
  // Per-tab identity (sessionStorage) so several tabs = several students.
  const uidFor = () => {
    try {
      let u = sessionStorage.getItem("bp-uid");
      if (!u) { u = "u" + Math.random().toString(36).slice(2, 10); sessionStorage.setItem("bp-uid", u); }
      return u;
    } catch { return "u" + Math.random().toString(36).slice(2, 10); }
  };

  return {
    kind: "local",
    serverNow: () => Date.now(),
    ensureStudent: async () => uidFor(),
    ensurePresenter: async () => "local presenter",
    onSession(cb) { listeners.add(cb); cb(read()); return () => listeners.delete(cb); },
    onStudent(uid, cb) {
      const f = (d) => cb({ state: d.state, reveals: d.reveals, opened: d.opened,
                            me: d.board && d.board[uid], player: d.players && d.players[uid] });
      listeners.add(f); f(read()); return () => listeners.delete(f);
    },
    join: async (uid, name) => write((d) => setPath(d, `players/${uid}`, { name, joined: Date.now() })),
    answer: async (uid, qid, v) => {
      const d = read();
      // Mirror the Firebase rules: one answer, only while the question is open.
      if (!d.state || d.state.q !== qid || d.state.phase !== "open") throw new Error("closed");
      if (d.answers && d.answers[qid] && d.answers[qid][uid]) throw new Error("already");
      write((x) => setPath(x, `answers/${qid}/${uid}`, { v, t: Date.now() }));
    },
    open: async (qid, alreadyOpened) => write((d) => {
      d.state = { q: qid, phase: "open" };
      if (!alreadyOpened) setPath(d, `opened/${qid}`, Date.now());
    }),
    setPhase: async (qid, phase) => write((d) => { d.state = { q: qid, phase }; }),
    reveal: async (qid, key) => write((d) => { d.state = { q: qid, phase: "reveal" }; setPath(d, `reveals/${qid}`, key); }),
    writeBoard: async (board) => write((d) => { d.board = board; }),
    reset: async () => write((d) => { for (const k of Object.keys(d)) delete d[k]; }),
  };
}
