import { FieldValue, getAdminDb } from '../../../_lib/firebaseAdmin.js';
import {
  applyCors,
  getJsonBody,
  getQueryParam,
  requireMethod,
  requireN8nAuth,
  sendError,
  sendJson,
} from '../../../_lib/http.js';

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;
  if (!requireMethod(req, res, ['POST'])) return;
  if (!requireN8nAuth(req, res)) return;

  const id = getQueryParam(req, 'id');
  if (!id) {
    sendError(res, 400, 'Missing lead id');
    return;
  }

  const body = getJsonBody(req);
  const content = String(body.content || body.message || '').trim();
  const subject = String(body.subject || '').trim();

  if (!content && !subject) {
    sendError(res, 400, 'Missing message content or subject');
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

    const now = FieldValue.serverTimestamp();
    const observationRef = await db.collection('observations').add({
      leadId: id,
      type: 'text',
      category: 'client_message',
      content: content || subject,
      channel: body.channel || 'email',
      subject,
      recipient: body.recipient || body.to || '',
      deliveryStatus: body.status || 'sent',
      providerMessageId: body.providerMessageId || '',
      campaignId: body.campaignId || '',
      source: 'n8n',
      createdAt: now,
      updatedAt: now,
      userId: 'n8n',
      userName: body.userName || 'n8n',
    });

    const updateData: Record<string, any> = {
      updatedAt: now,
      lastCampaignAt: now,
      lastCampaignChannel: body.channel || 'email',
      lastCampaignStatus: body.status || 'sent',
    };

    if (body.campaignId) {
      updateData[`sentTemplates.${body.campaignId}`] = now;
    }

    await leadRef.update(updateData);

    sendJson(res, 201, {
      data: {
        id: observationRef.id,
        leadId: id,
        status: 'logged',
      },
    });
  } catch (error: any) {
    sendError(res, 500, 'Failed to log n8n message', error?.message || String(error));
  }
}
