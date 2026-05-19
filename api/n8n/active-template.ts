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
      sendJson(res, 200, { data: null });
      return;
    }

    const data = docSnap.data() || {};
    const templates = data.templates || [];
    const activeTemplateId = data.activeTemplateId || '';
    
    const activeTemplate = templates.find((t: any) => t.id === activeTemplateId) || null;

    sendJson(res, 200, {
      data: activeTemplate,
    });
  } catch (error: any) {
    sendError(res, 500, 'Failed to fetch active template', error?.message || String(error));
  }
}
