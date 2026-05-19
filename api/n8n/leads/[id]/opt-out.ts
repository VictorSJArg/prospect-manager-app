import { FieldValue, getAdminDb } from '../../../_lib/firebaseAdmin';
import {
  applyCors,
  getJsonBody,
  getQueryParam,
  requireMethod,
  requireN8nAuth,
  sendError,
  sendJson,
} from '../../../_lib/http';

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;
  if (!requireMethod(req, res, ['POST', 'PATCH'])) return;
  if (!requireN8nAuth(req, res)) return;

  const id = getQueryParam(req, 'id');
  if (!id) {
    sendError(res, 400, 'Missing lead id');
    return;
  }

  try {
    const db = getAdminDb();
    const leadRef = db.collection('leads').doc(id);
    const leadSnapshot = await leadRef.get();

    if (!leadSnapshot.exists) {
      sendError(res, 404, 'Lead not found');
      return;
    }

    const body = getJsonBody(req);
    const now = FieldValue.serverTimestamp();
    const reason = String(body.reason || '').trim();

    await leadRef.update({
      optOut: true,
      canReceiveCampaigns: false,
      optOutAt: now,
      optOutReason: reason,
      updatedAt: now,
    });

    await db.collection('observations').add({
      leadId: id,
      type: 'text',
      category: 'internal',
      content: reason ? `Contacto excluido de envios masivos: ${reason}` : 'Contacto excluido de envios masivos.',
      source: 'n8n',
      createdAt: now,
      updatedAt: now,
      userId: 'n8n',
      userName: body.userName || 'n8n',
    });

    sendJson(res, 200, {
      data: {
        id,
        optOut: true,
        canReceiveCampaigns: false,
      },
    });
  } catch (error: any) {
    sendError(res, 500, 'Failed to mark lead as opt-out', error?.message || String(error));
  }
}
