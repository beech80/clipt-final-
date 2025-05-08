// Firebase v9 modular SDK
import { initializeApp } from "firebase/app";
import { getDatabase, ref, push, onChildAdded, serverTimestamp } from "firebase/database";

const config = {
  apiKey:            process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain:        process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL:       process.env.REACT_APP_FIREBASE_DATABASE_URL,
  projectId:         process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.REACT_APP_FIREBASE_APP_ID
};

const app = initializeApp(config);
const db = getDatabase(app);
const chatRef = ref(db, `chat/${process.env.REACT_APP_STREAM_VIDEO_ID}`);

export function sendMessage(user, text) {
  return push(chatRef, { user, text, ts: serverTimestamp() });
}

export function subscribeToChat(callback) {
  onChildAdded(chatRef, snap => {
    const data = snap.val();
    callback({ user: data.user, text: data.text, ts: data.ts });
  });
}
