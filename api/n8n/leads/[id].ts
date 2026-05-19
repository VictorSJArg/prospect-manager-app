import { getAdminDb } from '../../_lib/firebaseAdmin';
import {
  applyCors,
  getQueryParam,
  requireMethod,
  requireN8nAuth,
  sendError,
  sendJson,
} from '../../_lib/http';
import { serializeLead } from '../../_lib/serializers';

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;
  if (!requireMethod(req, res, ['GET'])) return;
  if (!requireN8nAuth(req, res)) return;

  const id = getQueryParam(req, 'id');
  if (!id) {
    sendError(res, 400, 'Missing lead id');
    return;
  }

  try {
    const snapshot = await getAdminDb().collection('leads').doc(id).get();
    if (!snapshot.exists) {
      sendError(res, 404, 'Lead not found');
      return;
    }

    sendJson(res, 200, {
      data: serializeLead(snapshot.id, snapshot.data() || {}),
    });
  } catch (error: any) {
    sendError(res, 500, 'Failed to fetch lead', error?.message || String(error));
  }
}
