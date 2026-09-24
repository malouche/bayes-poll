// scoring.js — one scoring rule, shared by phones and the projector so the two
// can never disagree.
//
//  choice, correct : 500 base + up to 500 speed bonus, linear in response time
//                    from 0 s (full bonus) to q.time s (no bonus)
//  choice, wrong   : 0
//  number          : 1000 × max(0, 1 − |guess − truth| / tol), rounded
//  unscored poll   : 0
import { byId } from "./questions.js";

export function pointsFor(qid, ans, reveal, openedAt) {
  const q = byId[qid];
  if (!q || !q.scored || !ans || !reveal) return 0;
  if (q.type === "number") {
    const err = Math.abs(Number(ans.v) - reveal.answer);
    return Math.round(1000 * Math.max(0, 1 - err / (reveal.tol || 25)));
  }
  if (Number(ans.v) !== reveal.answer) return 0;
  const secs = Math.max(0, (ans.t - (openedAt || ans.t)) / 1000);
  const bonus = 500 * Math.max(0, 1 - secs / (q.time || 30));
  return 500 + Math.round(bonus);
}

// Totals for every player over all revealed questions.
// Returns [{uid, name, total, n}] sorted by total (desc), ties by name.
export function leaderboard(data) {
  const players = data.players || {};
  const answers = data.answers || {};
  const reveals = data.reveals || {};
  const opened = data.opened || {};
  const rows = Object.entries(players).map(([uid, p]) => {
    let total = 0, n = 0;
    for (const qid of Object.keys(reveals)) {
      const a = answers[qid] && answers[qid][uid];
      if (!a) continue;
      const pts = pointsFor(qid, a, reveals[qid], opened[qid]);
      total += pts;
      if (pts > 0) n += 1;
    }
    return { uid, name: p.name, total, n };
  });
  rows.sort((a, b) => b.total - a.total || String(a.name).localeCompare(b.name));
  // Competition ranking: equal totals share a rank.
  rows.forEach((r, i) => {
    r.rank = i > 0 && rows[i - 1].total === r.total ? rows[i - 1].rank : i + 1;
  });
  return rows;
}
