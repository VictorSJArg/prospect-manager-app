import { getAdminDb } from '../_lib/firebaseAdmin.js';
import {
  applyCors,
  requireMethod,
  requireN8nAuth,
  sendError,
  sendJson,
} from '../_lib/http.js';

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;
  if (!requireMethod(req, res, ['GET'])) return;
  if (!requireN8nAuth(req, res)) return;

  try {
    const db = getAdminDb();
    const docSnap = await db.collection('settings').doc('general').get();
    
    if (!docSnap.exists) {
      sendJson(res, 200, { data: [] });
      return;
    }

    const data = docSnap.data() || {};
    const templates = data.templates || [];

    sendJson(res, 200, {
      data: templates,
    });
  } catch (error: any) {
    sendError(res, 500, 'Failed to fetch templates', error?.message || String(error));
  }
}
