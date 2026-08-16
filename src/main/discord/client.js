// The single place Coach Intel talks to the Discord REST API.
//
// Every request is serialized through one queue, so notification bursts can never
// fan out into parallel calls. Rate-limit headers are honoured before a request is
// sent, 429s wait out `retry_after`, and only 429/5xx/network failures are retried.

const { API_BASE } = require('./constants');
const { DiscordError, CODES, codeForStatus, redact } = require('./redact');

const DEFAULT_CACHE_TTL_MS = 60_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const MAX_BACKOFF_MS = 8_000;
const MAX_RETRY_AFTER_MS = 30_000;

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class DiscordClient {
  constructor({
    getToken,
    fetchImpl,
    sleep = defaultSleep,
    now = () => Date.now(),
    cacheTtlMs = DEFAULT_CACHE_TTL_MS,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    userAgent = `CoachIntel (https://naevii.com, ${require('../../../package.json').version})`,
  } = {}) {
    this.getToken = getToken;
    this.fetchImpl = fetchImpl || ((...args) => globalThis.fetch(...args));
    this.sleep = sleep;
    this.now = now;
    this.cacheTtlMs = cacheTtlMs;
    this.maxAttempts = maxAttempts;
    this.userAgent = userAgent;

    this.cache = new Map();
    // Per-bucket earliest-next-send timestamps, plus one global gate.
    this.buckets = new Map();
    this.globalResetAt = 0;
    // Tail of the serialization chain.
    this.queue = Promise.resolve();
  }

  // ---------- Cache ----------

  cacheGet(key) {
    const hit = this.cache.get(key);
    if (!hit) return undefined;
    if (this.now() - hit.at > this.cacheTtlMs) {
      this.cache.delete(key);
      return undefined;
    }
    return hit.value;
  }

  cacheSet(key, value) {
    this.cache.set(key, { at: this.now(), value });
  }

  invalidate(prefix) {
    if (!prefix) {
      this.cache.clear();
      return;
    }
    for (const key of [...this.cache.keys()]) {
      if (key.startsWith(prefix)) this.cache.delete(key);
    }
  }

  // ---------- Queue ----------

  // Chains work so exactly one Discord request is in flight at a time.
  enqueue(task) {
    const run = this.queue.then(task, task);
    // Keep the chain alive regardless of individual failures.
    this.queue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  async waitForSlot(bucket) {
    const readyAt = Math.max(this.globalResetAt, this.buckets.get(bucket) || 0);
    const delay = readyAt - this.now();
    if (delay > 0) await this.sleep(Math.min(delay, MAX_RETRY_AFTER_MS));
  }

  noteRateLimit(bucket, headers) {
    const remaining = Number(headers.get('x-ratelimit-remaining'));
    const resetAfter = Number(headers.get('x-ratelimit-reset-after'));
    if (Number.isFinite(remaining) && remaining <= 0 && Number.isFinite(resetAfter)) {
      this.buckets.set(bucket, this.now() + resetAfter * 1000);
    }
  }

  // ---------- Request ----------

  /**
   * @param {'GET'|'POST'|'PATCH'|'PUT'|'DELETE'} method
   * @param {string} endpoint  path below the API base, e.g. `/users/@me`
   * @param {object} [options]
   * @param {object} [options.body]   JSON body
   * @param {boolean} [options.cache] cache successful GETs for cacheTtlMs
   * @param {string} [options.token]  override the stored bot token (used while validating a new one)
   */
  async request(method, endpoint, options = {}) {
    const { body, cache = false, token } = options;
    const cacheKey = `${method} ${endpoint}`;

    if (method === 'GET' && cache) {
      const hit = this.cacheGet(cacheKey);
      if (hit !== undefined) return hit;
    }

    const result = await this.enqueue(() => this.dispatch(method, endpoint, body, token));

    if (method === 'GET' && cache) this.cacheSet(cacheKey, result);
    // Any mutation invalidates cached reads for that resource family.
    if (method !== 'GET') this.invalidate('GET ' + endpoint.split('/').slice(0, 3).join('/'));

    return result;
  }

  async dispatch(method, endpoint, body, overrideToken) {
    const bucket = `${method} ${endpoint.replace(/\/\d{5,}/g, '/:id')}`;
    let lastError = null;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      await this.waitForSlot(bucket);

      const token = overrideToken || (await this.getToken());
      if (!token) throw new DiscordError(CODES.NOT_CONNECTED);

      let response;
      try {
        response = await this.fetchImpl(`${API_BASE}${endpoint}`, {
          method,
          headers: {
            Authorization: `Bot ${token}`,
            'Content-Type': 'application/json',
            'User-Agent': this.userAgent,
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch (err) {
        lastError = new DiscordError(CODES.NETWORK, err && err.message);
        if (attempt === this.maxAttempts) throw lastError;
        await this.sleep(this.backoffMs(attempt));
        continue;
      }

      this.noteRateLimit(bucket, response.headers);

      if (response.status === 429) {
        const retryAfterMs = await this.retryAfterMs(response);
        if (response.headers.get('x-ratelimit-global') === 'true') {
          this.globalResetAt = this.now() + retryAfterMs;
        } else {
          this.buckets.set(bucket, this.now() + retryAfterMs);
        }
        lastError = new DiscordError(CODES.RATE_LIMITED, `retry_after ${retryAfterMs}ms`);
        if (attempt === this.maxAttempts) throw lastError;
        await this.sleep(retryAfterMs);
        continue;
      }

      if (response.status >= 500) {
        lastError = new DiscordError(CODES.UNAVAILABLE, `status ${response.status}`);
        if (attempt === this.maxAttempts) throw lastError;
        await this.sleep(this.backoffMs(attempt));
        continue;
      }

      if (!response.ok) {
        // 4xx other than 429 will never succeed on retry.
        throw new DiscordError(codeForStatus(response.status), await this.errorDetail(response));
      }

      if (response.status === 204) return null;
      return this.parseJson(response);
    }

    throw lastError || new DiscordError(CODES.UNKNOWN);
  }

  backoffMs(attempt) {
    // Exponential with jitter, capped.
    const base = Math.min(MAX_BACKOFF_MS, 400 * 2 ** (attempt - 1));
    return base + Math.floor(Math.random() * 200);
  }

  async retryAfterMs(response) {
    const header = Number(response.headers.get('retry-after'));
    if (Number.isFinite(header) && header > 0) return Math.min(header * 1000, MAX_RETRY_AFTER_MS);
    const payload = await this.parseJson(response).catch(() => null);
    const seconds = payload && Number(payload.retry_after);
    if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
    return 1000;
  }

  async parseJson(response) {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      throw new DiscordError(CODES.UNKNOWN, 'malformed response body');
    }
  }

  // Discord error payloads never contain our token, but the response is redacted
  // anyway so this detail is safe to log or attach to an error.
  async errorDetail(response) {
    const text = await response.text().catch(() => '');
    const snippet = text ? text.slice(0, 300) : '';
    return redact(`status ${response.status}${snippet ? ` ${snippet}` : ''}`);
  }

  // ---------- Convenience ----------

  get(endpoint, options) {
    return this.request('GET', endpoint, options);
  }

  post(endpoint, body, options) {
    return this.request('POST', endpoint, { ...options, body });
  }
}

module.exports = { DiscordClient, DEFAULT_CACHE_TTL_MS };
