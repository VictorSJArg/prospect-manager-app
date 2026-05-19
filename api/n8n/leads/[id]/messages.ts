import { getAdminDb } from '../../../_lib/firebaseAdmin';
import {
  applyCors,
  getQueryParam,
  parsePositiveInt,
  requireMethod,
  requireN8nAuth,
  sendError,
  sendJson,
} from '../../../_lib/http';
import { serializeObservation, toMillis } from '../../../_lib/serializers';

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
    const limit = parsePositiveInt(getQueryParam(req, 'limit'), 100, 500);
    const snapshot = await getAdminDb()
      .collection('observations')
      .where('leadId', '==', id)
      .limit(limit)
      .get();

    const messages = snapshot.docs
      .map((doc) => serializeObservation(doc.id, doc.data()))
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

    sendJson(res, 200, {
      data: messages,
      meta: {
        count: messages.length,
        limit,
      },
    });
  } catch (error: any) {
    sendError(res, 500, 'Failed to fetch lead messages', error?.message || String(error));
  }
}
