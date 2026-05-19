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

export function buildLeadContactFields(
  phone?: string | null,
  email?: string | null,
  options: { initializeCampaignConsent?: boolean } = {}
) {
  const emailNormalized = normalizeEmail(email);
  const phoneNormalized = normalizePhone(phone);

  const fields: Record<string, string | boolean> = {
    email: email || '',
    mail: email || '',
    phoneNormalized,
    emailNormalized,
  };

  if (options.initializeCampaignConsent) {
    fields.canReceiveCampaigns = true;
    fields.optOut = false;
  }

  return fields;
}
