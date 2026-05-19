export function normalizeEmail(value?: string | null) {
  return (value || '').trim().toLowerCase();
}

export function normalizePhone(value?: string | null) {
  const raw = (value || '').trim();
  if (!raw) return '';

  const hasPlus = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';

  return hasPlus ? `+${digits}` : digits;
}

export function toIsoDate(value: any) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

export function toMillis(value: any) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function serializeLead(id: string, data: Record<string, any>) {
  const rawEmail = data.email || data.mail || '';
  const emailNormalized = data.emailNormalized || normalizeEmail(rawEmail);
  const phoneNormalized = data.phoneNormalized || normalizePhone(data.phone);
  const optOut = data.optOut === true;
  const canReceiveCampaigns = data.canReceiveCampaigns === undefined
    ? true
    : data.canReceiveCampaigns !== false;

  return {
    id,
    name: data.name || '',
    dni: data.dni || '',
    phone: data.phone || '',
    phoneNormalized,
    email: rawEmail,
    mail: rawEmail,
    emailNormalized,
    profession: data.profession || '',
    status: data.status || 'Sin Análisis',
    priority: data.priority || 'Media',
    details: data.details || '',
    followUpDate: data.followUpDate || null,
    isHighPotential: data.isHighPotential === true,
    canReceiveCampaigns,
    optOut,
    hasPhone: Boolean(phoneNormalized),
    hasEmail: Boolean(emailNormalized),
    hasContact: Boolean(phoneNormalized || emailNormalized),
    createdAt: toIsoDate(data.createdAt),
    updatedAt: toIsoDate(data.updatedAt),
    userId: data.userId || '',
    userName: data.userName || '',
    lastCampaignAt: toIsoDate(data.lastCampaignAt),
    lastCampaignChannel: data.lastCampaignChannel || '',
    lastCampaignStatus: data.lastCampaignStatus || '',
    selectedTemplateId: data.selectedTemplateId || null,
  };
}

export function serializeObservation(id: string, data: Record<string, any>) {
  return {
    id,
    leadId: data.leadId || '',
    type: data.type || 'text',
    category: data.category || 'internal',
    content: data.type === 'audio' ? '[audio]' : data.content || '',
    channel: data.channel || '',
    subject: data.subject || '',
    recipient: data.recipient || '',
    deliveryStatus: data.deliveryStatus || '',
    providerMessageId: data.providerMessageId || '',
    campaignId: data.campaignId || '',
    source: data.source || '',
    createdAt: toIsoDate(data.createdAt),
    updatedAt: toIsoDate(data.updatedAt),
    userId: data.userId || '',
    userName: data.userName || '',
  };
}
