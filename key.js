// key.js — answer key, loaded ONLY by presenter.html.
// Choice answers are 0-based option indices. Number answers carry the true
// value and a tolerance: points fall linearly to 0 at |guess − truth| = tol.
//
// Stored base64-encoded so a curious student skimming the page source does not
// see the answers at a glance. This is a speed bump, not security; it is fine
// for a seminar game.
//
// Plain version (edit this, then regenerate KEY_B64 with:
//   btoa(JSON.stringify(PLAIN)) in any browser console):
//   q1: 1   inside the same circles        (Stone et al., Statist. Sci. 2014)
//   q1b: 1  goes down, but not to zero
//   q2: 2   add up many small clues         (Banburismus)
//   q3: 2   probability formula counting words (naive Bayes)
//   q4g: 35.56 ± 25                         (Asia network, TB | D,A,X)
//   q4: 2   goes down                       (explaining away)
//   q5: 3   something else (hand)           (Front. Pain Res. 2025)
//   q6: 1   no                              (Markov equivalence)

const KEY_B64 =
  "eyJxMSI6eyJhbnN3ZXIiOjF9LCJxMWIiOnsiYW5zd2VyIjoxfSwicTIiOnsiYW5zd2VyIjoyfSwicTMiOnsiYW5zd2VyIjoyfSwicTRnIjp7ImFuc3dlciI6MzUuNTYsInRvbCI6MjV9LCJxNCI6eyJhbnN3ZXIiOjJ9LCJxNSI6eyJhbnN3ZXIiOjN9LCJxNiI6eyJhbnN3ZXIiOjF9fQ==";

export const KEY = JSON.parse(atob(KEY_B64));
