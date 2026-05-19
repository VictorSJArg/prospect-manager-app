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
import { serializeLead } from '../../../_lib/serializers';

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;
  if (!requireMethod(req, res, ['POST'])) return;
  if (!requireN8nAuth(req, res)) return;

  const webhookUrl = process.env.N8N_EMAIL_WEBHOOK_URL;
  if (!webhookUrl) {
    sendError(res, 501, 'N8N_EMAIL_WEBHOOK_URL is not configured');
    return;
  }

  const id = getQueryParam(req, 'id');
  if (!id) {
    sendError(res, 400, 'Missing lead id');
    return;
  }

  const body = getJsonBody(req);
  const subject = String(body.subject || '').trim();
  const content = String(body.content || body.message || '').trim();

  if (!subject || !content) {
    sendError(res, 400, 'Missing email subject or content');
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

    const lead = serializeLead(leadSnapshot.id, leadSnapshot.data() || {});
    const to = String(body.to || lead.email || '').trim();

    if (!to) {
      sendError(res, 400, 'Lead has no email address');
      return;
    }

    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.N8N_EMAIL_WEBHOOK_TOKEN
          ? { 'X-Webhook-Token': process.env.N8N_EMAIL_WEBHOOK_TOKEN }
          : {}),
      },
      body: JSON.stringify({
        lead,
        email: {
          to,
          subject,
          content,
          campaignId: body.campaignId || '',
        },
        requestedAt: new Date().toISOString(),
        source: 'prospect-manager-api',
      }),
    });

    if (!webhookResponse.ok) {
      const responseText = await webhookResponse.text();
      sendError(res, 502, 'n8n email webhook rejected the request', responseText);
      return;
    }

    const now = FieldValue.serverTimestamp();
    await db.collection('observations').add({
      leadId: id,
      type: 'text',
      category: 'client_message',
      content,
      channel: 'email',
      subject,
      recipient: to,
      deliveryStatus: 'queued',
      campaignId: body.campaignId || '',
      source: 'n8n-email-webhook',
      createdAt: now,
      updatedAt: now,
      userId: 'n8n',
      userName: body.userName || 'n8n',
    });

    await leadRef.update({
      updatedAt: now,
      lastCampaignAt: now,
      lastCampaignChannel: 'email',
      lastCampaignStatus: 'queued',
    });

    sendJson(res, 202, {
      data: {
        id,
        to,
        status: 'queued',
      },
    });
  } catch (error: any) {
    sendError(res, 500, 'Failed to request email through n8n', error?.message || String(error));
  }
}
