const crypto = require('crypto');

const DEFAULT_SETUP_ORIGIN = 'https://coach.championshipseries.eu';
const DISPLAY_NAME_MAX_LENGTH = 80;
const CONTROL_OR_BIDI = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g;
const EMAIL_ONLY = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function randomHex(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

function sameSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function sanitizeDisplayName(value) {
  const text = String(value || '').replace(CONTROL_OR_BIDI, '').trim().slice(0, DISPLAY_NAME_MAX_LENGTH);
  if (!text || EMAIL_ONLY.test(text)) return null;
  return text;
}

function parseSetupCallback(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'coachintel:' || url.hostname !== 'setup' || !['', '/'].includes(url.pathname)) return null;
    const keys = [...url.searchParams.keys()];
    if (keys.some((key) => !['code', 'state', 'error'].includes(key))) return null;
    if (['code', 'state', 'error'].some((key) => url.searchParams.getAll(key).length > 1)) return null;
    return {
      code: url.searchParams.get('code') || null,
      state: url.searchParams.get('state') || null,
      error: url.searchParams.get('error') || null,
    };
  } catch {
    return null;
  }
}

function createDesktopSetupService({ openExternal, fetchImpl = globalThis.fetch, origin = DEFAULT_SETUP_ORIGIN } = {}) {
  const setupOrigin = new URL(origin);
  if (setupOrigin.protocol !== 'https:') throw new Error('Desktop setup requires an HTTPS origin.');
  if (typeof openExternal !== 'function' || typeof fetchImpl !== 'function') {
    throw new Error('Desktop setup dependencies are unavailable.');
  }

  let pending = null;

  async function begin(version) {
    if (!/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(String(version || ''))) {
      return { ok: false, error: 'invalid-version' };
    }
    const state = randomHex();
    const verifier = randomHex();
    const url = new URL('/desktop/setup', setupOrigin);
    url.searchParams.set('state', state);
    url.searchParams.set('challenge', sha256(verifier));
    url.searchParams.set('version', String(version));
    pending = { state, verifier, expiresAt: Date.now() + 5 * 60 * 1000 };
    await openExternal(url.toString());
    return { ok: true };
  }

  async function redeem(callbackUrl) {
    const callback = parseSetupCallback(callbackUrl);
    const active = pending;
    pending = null;
    if (!callback || !active || active.expiresAt < Date.now() || !sameSecret(callback.state, active.state)) {
      return { ok: false, error: 'invalid-or-expired' };
    }
    if (!callback.code || callback.error) return { ok: false, error: 'expired-or-unavailable' };

    try {
      const response = await fetchImpl(new URL('/api/desktop-setup/redeem', setupOrigin), {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', 'cache-control': 'no-store' },
        body: JSON.stringify({ code: callback.code, verifier: active.verifier, state: active.state }),
      });
      if (!response.ok) return { ok: false, error: 'expired-or-unavailable' };
      const body = await response.json();
      return { ok: true, displayName: sanitizeDisplayName(body?.displayName) };
    } catch {
      return { ok: false, error: 'offline-or-unavailable' };
    }
  }

  return { begin, redeem };
}

module.exports = { DEFAULT_SETUP_ORIGIN, createDesktopSetupService, parseSetupCallback, sanitizeDisplayName };
