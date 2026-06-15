import { createHmac, randomBytes } from 'node:crypto';

const TOKEN_TTL_MS = 60 * 60 * 1000;

export async function handler(event) {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const apiKey = process.env.ABLY_API_KEY || process.env.ABLYAPIKEY;
  if (!apiKey || !apiKey.includes(':')) {
    return json(500, { error: 'Missing ABLY_API_KEY or ABLYAPIKEY environment variable.' });
  }

  const body = parseBody(event.body);
  const query = event.queryStringParameters || {};
  const clientId = sanitizeClientId(body.clientId || query.clientId);
  const roomCode = sanitizeRoomCode(body.roomCode || query.roomCode);

  if (!clientId) return json(400, { error: 'Missing clientId.' });
  if (!roomCode) return json(400, { error: 'Missing roomCode.' });

  try {
    return json(200, createTokenRequest({ apiKey, clientId, roomCode }));
  } catch (error) {
    return json(500, { error: error?.message || 'Could not create Ably token request.' });
  }
}

function createTokenRequest({ apiKey, clientId, roomCode }) {
  const split = apiKey.indexOf(':');
  const keyName = apiKey.slice(0, split);
  const keySecret = apiKey.slice(split + 1);
  const ttl = TOKEN_TTL_MS;
  const capability = JSON.stringify({ [`tlr:room:${roomCode}`]: ['publish', 'subscribe', 'presence', 'history'] });
  const timestamp = Date.now();
  const nonce = randomBytes(16).toString('hex');

  // Ably TokenRequest MAC input is newline-delimited and includes a trailing newline.
  const signText = [keyName, ttl, capability, clientId, timestamp, nonce, ''].join('\n');
  const mac = createHmac('sha256', keySecret).update(signText).digest('base64');

  return { keyName, ttl, capability, clientId, timestamp, nonce, mac };
}

function parseBody(body) {
  if (!body) return {};
  try { return JSON.parse(body); } catch (_) { return {}; }
}

function sanitizeRoomCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

function sanitizeClientId(value) {
  return String(value || '').trim().replace(/[^A-Za-z0-9_.:@-]/g, '').slice(0, 96);
}

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(payload),
  };
}
