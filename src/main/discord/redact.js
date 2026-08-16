// Keeps Discord credentials out of logs, error messages, and anything that
// crosses the IPC boundary into the renderer.

// Discord bot tokens are three dot-separated base64url segments; the first is the
// application ID. Webhook URLs embed their own token in the path.
const TOKEN_PATTERNS = [
  /\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{20,}\b/g,
  /(discord(?:app)?\.com\/api\/webhooks\/\d+\/)[A-Za-z0-9_-]+/gi,
  /((?:Bot|Bearer)\s+)\S+/gi,
];

const PLACEHOLDER = '[redacted]';

function redact(value) {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'string') return value;
  let out = value;
  out = out.replace(TOKEN_PATTERNS[0], PLACEHOLDER);
  out = out.replace(TOKEN_PATTERNS[1], `$1${PLACEHOLDER}`);
  out = out.replace(TOKEN_PATTERNS[2], `$1${PLACEHOLDER}`);
  return out;
}

// Strips any key that looks credential-bearing, and redacts remaining strings.
const SECRET_KEY_PATTERN = /token|secret|password|authorization|credential|webhook_url/i;

function redactObject(input, depth = 0) {
  if (depth > 6) return PLACEHOLDER;
  if (Array.isArray(input)) return input.map((v) => redactObject(v, depth + 1));
  if (input && typeof input === 'object') {
    const out = {};
    for (const [key, value] of Object.entries(input)) {
      out[key] = SECRET_KEY_PATTERN.test(key) ? PLACEHOLDER : redactObject(value, depth + 1);
    }
    return out;
  }
  return redact(input);
}

// ---------- Error model ----------

const CODES = {
  INVALID_TOKEN: 'INVALID_TOKEN',
  NOT_CONNECTED: 'NOT_CONNECTED',
  FORBIDDEN: 'FORBIDDEN',
  MISSING_CHANNEL_PERMISSIONS: 'MISSING_CHANNEL_PERMISSIONS',
  CHANNEL_NOT_FOUND: 'CHANNEL_NOT_FOUND',
  GUILD_NOT_FOUND: 'GUILD_NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  UNAVAILABLE: 'UNAVAILABLE',
  NETWORK: 'NETWORK',
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  UNKNOWN: 'UNKNOWN',
};

// The only Discord-related strings ever shown to a user. No raw API payloads,
// no stack traces, no tokens.
const USER_MESSAGES = {
  INVALID_TOKEN: 'The Discord connection needs to be refreshed — the bot token was rejected.',
  NOT_CONNECTED: 'No Discord server is connected to this organization yet.',
  FORBIDDEN: 'You do not have permission to connect this server.',
  MISSING_CHANNEL_PERMISSIONS: 'Coach Intel bot is missing required channel permissions.',
  CHANNEL_NOT_FOUND: 'That Discord channel no longer exists. Select another channel.',
  GUILD_NOT_FOUND: 'Coach Intel can no longer reach that Discord server. The bot may have been removed.',
  RATE_LIMITED: 'Discord is rate-limiting Coach Intel. Try again shortly.',
  UNAVAILABLE: 'Discord is temporarily unavailable.',
  NETWORK: 'Coach Intel could not reach Discord. Check your connection.',
  NOT_CONFIGURED: 'This Discord channel has not been configured yet.',
  UNKNOWN: 'Discord returned an unexpected error.',
};

class DiscordError extends Error {
  constructor(code, detail) {
    super(USER_MESSAGES[code] || USER_MESSAGES.UNKNOWN);
    this.name = 'DiscordError';
    this.code = CODES[code] ? code : CODES.UNKNOWN;
    // Diagnostic detail stays redacted so it is safe to surface or log.
    this.detail = detail ? redact(String(detail)) : null;
  }

  get userMessage() {
    return USER_MESSAGES[this.code] || USER_MESSAGES.UNKNOWN;
  }

  toIpc() {
    return { ok: false, code: this.code, message: this.userMessage, detail: this.detail };
  }
}

// Maps an HTTP status from Discord onto a Coach Intel error code.
function codeForStatus(status) {
  if (status === 401) return CODES.INVALID_TOKEN;
  if (status === 403) return CODES.MISSING_CHANNEL_PERMISSIONS;
  if (status === 404) return CODES.CHANNEL_NOT_FOUND;
  if (status === 429) return CODES.RATE_LIMITED;
  if (status >= 500) return CODES.UNAVAILABLE;
  return CODES.UNKNOWN;
}

// Normalizes anything thrown inside the Discord service into a DiscordError,
// guaranteeing no raw error text (which may embed a token) escapes.
function toDiscordError(err) {
  if (err instanceof DiscordError) return err;
  if (err && typeof err === 'object' && err.name === 'DiscordError' && err.code) return err;
  const message = err && err.message ? err.message : String(err);
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network/i.test(message)) {
    return new DiscordError(CODES.NETWORK, message);
  }
  return new DiscordError(CODES.UNKNOWN, message);
}

// Wraps an async service call so the renderer always receives a plain,
// secret-free result envelope instead of a thrown Error.
async function safeCall(fn) {
  try {
    const data = await fn();
    return { ok: true, data: data === undefined ? null : data };
  } catch (err) {
    return toDiscordError(err).toIpc();
  }
}

module.exports = {
  redact,
  redactObject,
  PLACEHOLDER,
  CODES,
  USER_MESSAGES,
  DiscordError,
  codeForStatus,
  toDiscordError,
  safeCall,
};
