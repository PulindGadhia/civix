import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase configuration from Vite environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let auth: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let storage: any;

// Graceful check for environment variables to avoid runtime exceptions in boilerplate
console.log("========= FIREBASE ENV =========");
console.log(import.meta.env);

console.log("API KEY:", import.meta.env.VITE_FIREBASE_API_KEY);
console.log("PROJECT:", import.meta.env.VITE_FIREBASE_PROJECT_ID);
console.log("AUTH:", import.meta.env.VITE_FIREBASE_AUTH_DOMAIN);
console.log("STORAGE:", import.meta.env.VITE_FIREBASE_STORAGE_BUCKET);
console.log("SENDER:", import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID);
console.log("APP:", import.meta.env.VITE_FIREBASE_APP_ID);

const isFirebaseConfigured =
  !!firebaseConfig.apiKey &&
  !!firebaseConfig.projectId;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    console.log('Firebase client SDK initialized successfully.');
  } catch (error) {
    console.error('Error initializing Firebase client SDK:', error);
  }
} else {
  console.warn(
    'Firebase environment credentials missing. Frontend running in fallback mock mode.'
  );
}

export { app, auth, db, storage, isFirebaseConfigured };
