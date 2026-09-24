# bayes-poll

Live phone voting for the seminar *Bayesian Techniques in Healthcare* (Statistics & Data Science Club, Qatar University).

- **Students:** https://malouche.github.io/bayes-poll/ (scan the QR code on the slide, type a name, answer)
- **Presenter:** https://malouche.github.io/bayes-poll/presenter.html (Google sign-in, admin account only)

## Presenter keys

| Key | Action |
|-----|--------|
| `J` | Join screen: big QR code and the names as they arrive |
| `N` | Next question: selects it **and opens it** on every phone |
| `O` | Open the selected question |
| `C` | Close: no more answers; shows the bar chart |
| `R` | Reveal: marks the correct answer and updates everyone's score |
| `L` | Leaderboard (Top 10) |
| `H` | Hide the control bar (it comes back when the mouse hovers over it) |
| `F` | Full screen |

A typical question runs **N → (students answer) → C → R**.

## Scoring

- **Multiple choice:** a correct answer earns 500 points, plus up to 500 more for speed. The speed bonus falls linearly to 0 over the question's time limit.
- **Number guess:** 1000 × max(0, 1 − |guess − truth| / 25).
- **Warm-up and opinion polls:** no points.

## Rehearsal without the internet

Open `presenter.html?local=1` and a few tabs of `index.html?local=1` in one browser. Everything runs in that browser (localStorage + BroadcastChannel).

To rehearse on the real backend without touching the live session, add `?s=test` to both URLs. **Reset session…** clears a session.

## Files

- `questions.js`: question text (public)
- `key.js`: answer key, base64-encoded (loaded only by the presenter)
- `scoring.js`: the scoring rule
- `backend.js`: Firebase / local backends
- `firebase-config.js`: Firebase web config, the admin email and the public URL
- `database.rules.json`: Realtime Database security rules. These are already published; if you edit them, paste the new version into Firebase console › Realtime Database › Rules.

Firebase free (Spark) plan: up to 100 simultaneous connections, which is enough for a seminar room.
