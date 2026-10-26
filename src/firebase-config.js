// Firebase web config, read from VITE_FIREBASE_* environment variables (see .env.example).
// These are public web-app identifiers (access is protected by firestore.rules), but every deployment must use its
// OWN Firebase project — there is deliberately no built-in default.
import { env } from './env.js';

export const firebaseConfig = {
  apiKey: env('VITE_FIREBASE_API_KEY'),
  authDomain: env('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: env('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: env('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: env('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: env('VITE_FIREBASE_APP_ID'),
  ...(env('VITE_FIREBASE_MEASUREMENT_ID') ? { measurementId: env('VITE_FIREBASE_MEASUREMENT_ID') } : {}),
};

export const REQUIRED_FIREBASE_VARS = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID'];
export const missingFirebaseVars = () => REQUIRED_FIREBASE_VARS.filter((k) => !env(k));
export const isFirebaseConfigured = missingFirebaseVars().length === 0;
