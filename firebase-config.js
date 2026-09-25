// firebase-config.js — paste the web-app config from the Firebase console here.
// These values are NOT secrets: every Firebase web app ships them to the
// browser. Access is controlled by database.rules.json, not by hiding this.
//
// While apiKey is empty, the app runs in local rehearsal mode automatically.
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDk74pPlbNcQPW7rIqnyY23SBQvzaI4T6w",
  authDomain: "bayes-poll.firebaseapp.com",
  databaseURL: "https://bayes-poll-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "bayes-poll",
  appId: "1:537961083615:web:6edac71793a75b9c67af6a",
};

// The only Google account allowed to run the presenter screen.
export const ADMIN_EMAIL = "dfmalouche@gmail.com";

// Public address of the student app (used for the QR code on the projector).
export const PUBLIC_URL = "https://malouche.github.io/bayes-poll/";
