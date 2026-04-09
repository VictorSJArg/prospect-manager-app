import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const provider = new GoogleAuthProvider();

/**
 * Intenta popup primero (instantáneo). Si el navegador lo bloquea,
 * usa redirect como fallback.
 */
export const signInWithGoogle = async (): Promise<void> => {
  try {
    await signInWithPopup(auth, provider);
  } catch (popupError: any) {
    // Solo usar redirect si el popup fue bloqueado por el navegador
    if (
      popupError.code === 'auth/popup-blocked' ||
      popupError.code === 'auth/popup-closed-by-user' ||
      popupError.code === 'auth/cancelled-popup-request'
    ) {
      await signInWithRedirect(auth, provider);
    } else {
      throw popupError;
    }
  }
};

/**
 * Llama esto al montar la app para procesar cualquier redirect pendiente.
 * Retorna error string si falla, null si ok.
 */
export const processRedirectResult = async (): Promise<string | null> => {
  try {
    await getRedirectResult(auth);
    return null;
  } catch (error: any) {
    console.error('getRedirectResult error:', error.code, error.message);
    return error.message || error.code || 'Unknown error';
  }
};

export const logOut = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out', error);
  }
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
