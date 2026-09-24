// questions.js — the question text shown on phones and on the projector.
// Answers are NOT here (students can read this file). The answer key lives in
// key.js and is only sent to phones when the presenter presses "Reveal".
//
// Fields
//   id      stable key used in the database (never rename during a session)
//   slide   where it runs in the Beamer deck (for the presenter only)
//   type    "choice" | "number"
//   scored  false = opinion poll, no points
//   text    one short sentence, simple English
//   options choice questions only
//   min/max/unit  number questions only
//   time    seconds for the full speed bonus to run out (choice) — soft limit

export const QUESTIONS = [
  {
    id: "warmup", slide: "Opening", type: "choice", scored: false,
    text: "Before we start: how do you feel about probability?",
    options: ["I love it", "It is OK", "It scares me a little", "What is probability?"],
  },
  {
    id: "q1", slide: "Q1 · Rio–Paris", type: "choice", scored: true, time: 30,
    text: "Four searches found nothing. Where should they look next?",
    options: [
      "Farther away, outside the searched circles",
      "Inside the same circles, again",
    ],
  },
  {
    id: "q1b", slide: "Q1 · after 'A failed search re-weights'", type: "choice", scored: true, time: 20,
    text: "A search finds nothing in one area. The chance the plane is there…",
    options: ["drops to zero", "goes down, but not to zero", "stays the same"],
  },
  {
    id: "q2", slide: "Q2 · Enigma", type: "choice", scored: true, time: 30,
    text: "Enigma had about 10²³ settings, far too many to try. How did Turing's team win?",
    options: [
      "A much faster machine that tries them all",
      "A clever shortcut that skips most settings",
      "Stop trying settings: add up many small clues",
    ],
  },
  {
    id: "q3", slide: "Q3 · Spam", type: "choice", scored: true, time: 25,
    text: "The first spam filters that really worked (around 2002) used…",
    options: [
      "People reading emails by hand",
      "A list of bad senders",
      "A simple probability formula that counts words",
      "A giant AI model",
    ],
  },
  {
    id: "q4a", slide: "Q4 · A patient (frame 1)", type: "choice", scored: false,
    text: "She is short of breath, travelled abroad, and smokes. What does she have?",
    options: ["Tuberculosis (TB)", "Lung cancer", "Bronchitis", "More than one"],
  },
  {
    id: "q4g", slide: "Q4 · end of the bars frame", type: "number", scored: true,
    text: "The chance of TB is now 7.8%. Her X-ray comes back positive. Guess the new chance of TB (%).",
    min: 0, max: 100, unit: "%",
  },
  {
    id: "q4", slide: "Q4 · X-ray positive (overlay 2)", type: "choice", scored: true, time: 30,
    text: "Now she tells you she is a heavy smoker. What happens to the chance of TB?",
    options: ["It goes up", "It stays the same", "It goes down"],
  },
  {
    id: "q5", slide: "Q5 · Ten pain sites", type: "choice", scored: true, time: 30,
    text: "In the learned network, which pain site has the most arrows coming out of it?",
    options: ["Back", "Neck or shoulder", "Headache", "Something else"],
  },
  {
    id: "q6", slide: "Q6 · Look at this arrow", type: "choice", scored: true, time: 25,
    text: "The network has an arrow from A to B. Does this prove that A causes B?",
    options: ["Yes", "No", "Only if the sample is large"],
  },
  {
    id: "final", slide: "Close", type: "choice", scored: false,
    text: "Which idea will you remember tomorrow?",
    options: [
      "A failed search is still data",
      "Small clues add up",
      "Explaining away (the smoker)",
      "Arrows are not always causes",
    ],
  },
];

export const byId = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));
