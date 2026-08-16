const fs = require('fs/promises');
const os = require('os');
const path = require('path');

// Stand-in for Electron's safeStorage. Reversible on purpose — the point of the
// tests is that the token is not stored verbatim and that an unavailable keychain
// blocks persistence, not that this transform is strong.
function fakeSecretStore({ available = true } = {}) {
  return {
    isAvailable: () => available,
    encrypt: (str) => Buffer.from(`enc::${Buffer.from(str, 'utf-8').toString('base64')}`, 'utf-8'),
    decrypt: (buf) => {
      const raw = buf.toString('utf-8');
      if (!raw.startsWith('enc::')) throw new Error('bad ciphertext');
      return Buffer.from(raw.slice(5), 'base64').toString('utf-8');
    },
  };
}

async function tempDataRoot() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'coach-intel-test-'));
}

async function cleanup(dir) {
  await fs.rm(dir, { recursive: true, force: true });
}

function fakeResponse({ status = 200, body = null, headers = {} } = {}) {
  const map = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v)]));
  const text = body === null ? '' : typeof body === 'string' ? body : JSON.stringify(body);
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (key) => (map.has(String(key).toLowerCase()) ? map.get(String(key).toLowerCase()) : null) },
    text: async () => text,
  };
}

// Records every call so tests can assert retry counts and request order.
function recordingFetch(responses) {
  const calls = [];
  const queue = [...responses];
  const impl = async (url, options) => {
    calls.push({ url, options });
    const next = queue.length > 1 ? queue.shift() : queue[0];
    if (next instanceof Error) throw next;
    if (typeof next === 'function') return next(url, options);
    return next;
  };
  impl.calls = calls;
  return impl;
}

function noSleep() {
  const waits = [];
  const sleep = async (ms) => {
    waits.push(ms);
  };
  sleep.waits = waits;
  return sleep;
}

/**
 * Fake Discord client backed by a { 'GET /path': payload } routing table.
 * Throwing values are rethrown so error paths can be exercised.
 */
function fakeClient(routes = {}) {
  const calls = [];
  const client = {
    calls,
    routes,
    async request(method, endpoint) {
      calls.push({ method, endpoint });
      const key = `${method} ${endpoint}`;
      if (!(key in routes)) throw new Error(`unexpected request ${key}`);
      const value = routes[key];
      if (value instanceof Error) throw value;
      return typeof value === 'function' ? value() : value;
    },
    get(endpoint, options) {
      return client.request('GET', endpoint, options);
    },
    post(endpoint, body) {
      calls.push({ method: 'POST', endpoint, body });
      const key = `POST ${endpoint}`;
      if (key in routes) {
        const value = routes[key];
        if (value instanceof Error) throw value;
        return typeof value === 'function' ? value(body) : value;
      }
      return null;
    },
    invalidate() {},
  };
  return client;
}

function collectingAudit() {
  const entries = [];
  return {
    entries,
    async record(entry) {
      entries.push(entry);
      return entry;
    },
    async recent() {
      return [...entries].reverse();
    },
  };
}

module.exports = {
  fakeSecretStore,
  tempDataRoot,
  cleanup,
  fakeResponse,
  recordingFetch,
  noSleep,
  fakeClient,
  collectingAudit,
};
