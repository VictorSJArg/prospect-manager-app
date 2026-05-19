import { getAdminDb } from '../_lib/firebaseAdmin.js';
import {
  applyCors,
  getQueryParam,
  parseBoolean,
  parsePositiveInt,
  requireMethod,
  requireN8nAuth,
  sendError,
  sendJson,
  splitList,
} from '../_lib/http.js';
import { serializeLead, toMillis } from '../_lib/serializers.js';

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;
  if (!requireMethod(req, res, ['GET'])) return;
  if (!requireN8nAuth(req, res)) return;

  try {
    const db = getAdminDb();
    const limit = parsePositiveInt(getQueryParam(req, 'limit'), 500, 1000);
    const fetchLimit = Math.min(limit * 3, 3000);
    const statuses = splitList(getQueryParam(req, 'status'));
    const priorities = splitList(getQueryParam(req, 'priority'));
    const highPotential = parseBoolean(getQueryParam(req, 'highPotential'));
    const hasContact = parseBoolean(getQueryParam(req, 'hasContact'));
    const includeOptOut = parseBoolean(getQueryParam(req, 'includeOptOut')) === true;
    const since = getQueryParam(req, 'since');
    const sinceMillis = since ? new Date(since).getTime() : 0;

    const snapshot = await db
      .collection('leads')
      .orderBy('createdAt', 'desc')
      .limit(fetchLimit)
      .get();

    let leads = snapshot.docs.map((doc) => serializeLead(doc.id, doc.data()));

    if (statuses.length) {
      leads = leads.filter((lead) => statuses.includes(lead.status));
    }

    if (priorities.length) {
      leads = leads.filter((lead) => priorities.includes(lead.priority));
    }

    if (highPotential !== undefined) {
      leads = leads.filter((lead) => lead.isHighPotential === highPotential);
    }

    if (hasContact !== undefined) {
      leads = leads.filter((lead) => lead.hasContact === hasContact);
    }

    if (!includeOptOut) {
      leads = leads.filter((lead) => !lead.optOut && lead.canReceiveCampaigns !== false);
    }

    if (sinceMillis && !Number.isNaN(sinceMillis)) {
      leads = leads.filter((lead) => {
        const updatedAt = toMillis(lead.updatedAt);
        const createdAt = toMillis(lead.createdAt);
        return Math.max(updatedAt, createdAt) >= sinceMillis;
      });
    }

    leads = leads.slice(0, limit);

    // Fetch templates to resolve template content for each lead
    const settingsDoc = await db.collection('settings').doc('general').get();
    const settingsData = settingsDoc.exists ? settingsDoc.data() || {} : {};
    const templates = settingsData.templates || [];
    const activeTemplateId = settingsData.activeTemplateId || null;

    const resolvedLeads = leads
      .map((lead: any) => {
        const templateId = lead.selectedTemplateId || activeTemplateId;
        const template = templates.find((t: any) => t.id === templateId) || null;
        return {
          ...lead,
          template,
        };
      })
      .filter((lead: any) => {
        if (!lead.template) return false;
        const sentTemplates = lead.sentTemplates || {};
        return !sentTemplates[lead.template.id];
      });

    sendJson(res, 200, {
      data: resolvedLeads,
      meta: {
        count: resolvedLeads.length,
        fetched: snapshot.size,
        limit,
      },
    });
  } catch (error: any) {
    sendError(res, 500, 'Failed to fetch leads', error?.message || String(error));
  }
}
