import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';

const defaultProjectId = 'gen-lang-client-0932299961';
const defaultDatabaseId = 'ai-studio-a6278b9a-2b8a-4ac0-9165-4a9d6ea34455';

function parseServiceAccount() {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const rawBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64;

  if (rawJson) return JSON.parse(rawJson);
  if (rawBase64) return JSON.parse(Buffer.from(rawBase64, 'base64').toString('utf8'));

  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return {
      projectId: process.env.FIREBASE_PROJECT_ID || defaultProjectId,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }

  return null;
}

function getCredentialConfig() {
  const serviceAccount = parseServiceAccount();
  if (serviceAccount) return { credential: cert(serviceAccount) };
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return { credential: applicationDefault() };
  return {};
}

export function getAdminDb() {
  const projectId = process.env.FIREBASE_PROJECT_ID || defaultProjectId;
  const databaseId = process.env.FIRESTORE_DATABASE_ID || defaultDatabaseId;

  const app = getApps()[0] || initializeApp({
    projectId,
    ...getCredentialConfig(),
  });

  return getFirestore(app, databaseId);
}

export { FieldValue, Timestamp };
