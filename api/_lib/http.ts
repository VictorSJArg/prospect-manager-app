import { timingSafeEqual } from 'node:crypto';

type HeaderValue = string | string[] | undefined;

export function applyCors(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', process.env.N8N_ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,X-API-Key');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }

  return false;
}

export function sendJson(res: any, statusCode: number, body: unknown) {
  res.status(statusCode).json(body);
}

export function sendError(res: any, statusCode: number, message: string, details?: unknown) {
  sendJson(res, statusCode, {
    error: message,
    ...(details ? { details } : {}),
  });
}

export function requireMethod(req: any, res: any, allowedMethods: string[]) {
  if (allowedMethods.includes(req.method)) return true;

  res.setHeader('Allow', allowedMethods.join(', '));
  sendError(res, 405, `Method ${req.method} not allowed`);
  return false;
}

export function getHeader(req: any, name: string) {
  const value: HeaderValue = req.headers?.[name.toLowerCase()] || req.headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}

function safeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function requireN8nAuth(req: any, res: any) {
  const expectedToken = process.env.N8N_API_TOKEN;
  if (!expectedToken) {
    sendError(res, 500, 'N8N_API_TOKEN is not configured');
    return false;
  }

  const authorization = getHeader(req, 'authorization') || '';
  const bearerToken = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : '';
  const apiKey = getHeader(req, 'x-api-key') || '';
  const providedToken = bearerToken || apiKey;

  if (!providedToken || !safeEquals(providedToken, expectedToken)) {
    sendError(res, 401, 'Invalid or missing n8n API token');
    return false;
  }

  return true;
}

export function getQueryParam(req: any, name: string) {
  const value = req.query?.[name];
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' ? value : undefined;
}

export function parseBoolean(value: string | undefined) {
  if (value === undefined) return undefined;
  return ['1', 'true', 'yes', 'si', 'sí'].includes(value.toLowerCase());
}

export function parsePositiveInt(value: string | undefined, fallback: number, max: number) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

export function splitList(value: string | undefined) {
  if (!value) return [];
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export function getJsonBody(req: any) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (_) {
      return {};
    }
  }
  return req.body;
}
