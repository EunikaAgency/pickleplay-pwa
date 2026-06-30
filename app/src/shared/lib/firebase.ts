// Firebase Cloud Messaging — app-side init. Lazily initialised so the SDK
// only loads when push is actually enabled, keeping the cold-start bundle small.

import type { FirebaseApp } from 'firebase/app';
import type { Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: 'AIzaSyCrrRUkReCER98hjXkBTN4Gdlrv2mcG1qM',
  authDomain: 'pickleballers-da675.firebaseapp.com',
  projectId: 'pickleballers-da675',
  storageBucket: 'pickleballers-da675.firebasestorage.app',
  messagingSenderId: '333083213227',
  appId: '1:333083213227:web:4f45bdb8bf57121d5926ee',
};

let _app: FirebaseApp | null = null;
let _messaging: Messaging | null = null;

/** Returns (or creates) the lazy Firebase app instance. */
export async function getFirebaseApp(): Promise<FirebaseApp> {
  if (_app) return _app;
  const { initializeApp } = await import('firebase/app');
  _app = initializeApp(firebaseConfig);
  return _app;
}

/** Returns (or creates) the lazy Firebase Messaging instance. */
export async function getFirebaseMessaging(): Promise<Messaging> {
  if (_messaging) return _messaging;
  // getMessaging auto-reads the app from getApp() if no app is passed, but we
  // pass ours explicitly so the lazy init is deterministic.
  const app = await getFirebaseApp();
  const { getMessaging } = await import('firebase/messaging');
  _messaging = getMessaging(app);
  return _messaging;
}
