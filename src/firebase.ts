import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const resolvedFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim() || firebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() || firebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim() || firebaseConfig.projectId,
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() || firebaseConfig.storageBucket,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() ||
    firebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim() || firebaseConfig.appId,
};

const resolvedDatabaseId =
  import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID?.trim() ||
  firebaseConfig.firestoreDatabaseId;

const app = getApps().length > 0 ? getApp() : initializeApp(resolvedFirebaseConfig);

export const db = getFirestore(app, resolvedDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

function isTopLevelWindow(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self === window.top;
  } catch {
    return false;
  }
}

function getFirebaseErrorCode(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    return String((err as { code?: unknown }).code ?? '');
  }
  return '';
}

export function getReadableFirebaseAuthError(err: unknown): string {
  const code = getFirebaseErrorCode(err);
  const host = typeof window !== 'undefined' ? window.location.hostname : '';

  switch (code) {
    case 'auth/unauthorized-domain':
      return host
        ? `Google Sign-In is not authorized for "${host}" yet. Add this domain in Firebase Console -> Authentication -> Settings -> Authorized domains.`
        : 'Google Sign-In is not authorized for this domain yet. Check Firebase Console -> Authorized domains.';
    case 'auth/popup-blocked':
      return 'Sign-in popup was blocked by your browser. Please allow popups for this site and try again.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google Sign-In was closed before completing. Please try again.';
    case 'auth/operation-not-allowed':
      return 'Google Sign-In is currently disabled in Firebase Authentication settings.';
    case 'auth/network-request-failed':
      return 'Network error during Google Sign-In. Please check your internet connection and try again.';
    default:
      return err instanceof Error ? err.message : 'Google Sign-In could not be completed.';
  }
}

export async function signInWithGoogle() {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (err) {
    const code = getFirebaseErrorCode(err);
    // In external top-level browsers (e.g., Vercel mobile browsers blocking popups),
    // automatically fall back to redirect sign-in; keep popup-only inside iframes.
    if (code === 'auth/popup-blocked' && isTopLevelWindow()) {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    throw err;
  }
}

export async function consumeGoogleRedirectResult() {
  return getRedirectResult(auth);
}

export async function signOutUser() {
  return signOut(auth);
}

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();
