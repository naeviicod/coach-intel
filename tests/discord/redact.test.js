const test = require('node:test');
const assert = require('node:assert/strict');

const {
  redact,
  redactObject,
  DiscordError,
  CODES,
  codeForStatus,
  toDiscordError,
  safeCall,
  PLACEHOLDER,
} = require('../../src/main/discord/redact');

const SAMPLE_TOKEN = 'MTIzNDU2Nzg5MDEyMzQ1Njc4.GaBcDe.abcdefghijklmnopqrstuvwxyz123';

test('redacts a bot token appearing anywhere in a string', () => {
  const out = redact(`request failed with ${SAMPLE_TOKEN} attached`);
  assert.ok(!out.includes(SAMPLE_TOKEN));
  assert.ok(out.includes(PLACEHOLDER));
});

test('redacts an Authorization header value', () => {
  const out = redact(`Authorization: Bot ${SAMPLE_TOKEN}`);
  assert.ok(!out.includes(SAMPLE_TOKEN));
});

test('redacts the token segment of a webhook URL but keeps the route', () => {
  const out = redact('posted to https://discord.com/api/webhooks/123456789012/AbCdEf-secret_value');
  assert.ok(!out.includes('AbCdEf-secret_value'));
  assert.ok(out.includes('webhooks/123456789012/'));
});

test('redactObject removes credential-bearing keys entirely', () => {
  const out = redactObject({
    guild: 'Team Discord',
    bot_token: SAMPLE_TOKEN,
    nested: { refresh_token: 'abc', client_secret: 'shh', webhook_url: 'https://x' },
  });
  assert.equal(out.guild, 'Team Discord');
  assert.equal(out.bot_token, PLACEHOLDER);
  assert.equal(out.nested.refresh_token, PLACEHOLDER);
  assert.equal(out.nested.client_secret, PLACEHOLDER);
  assert.equal(out.nested.webhook_url, PLACEHOLDER);
});

test('DiscordError exposes a user-facing message and redacts its detail', () => {
  const err = new DiscordError(CODES.UNKNOWN, `raw failure Bot ${SAMPLE_TOKEN}`);
  assert.ok(!err.message.includes(SAMPLE_TOKEN));
  assert.ok(!err.detail.includes(SAMPLE_TOKEN));
  assert.equal(err.userMessage, err.message);
});

test('DiscordError carries no stack trace across IPC', () => {
  const payload = new DiscordError(CODES.FORBIDDEN).toIpc();
  assert.deepEqual(Object.keys(payload).sort(), ['code', 'detail', 'message', 'ok']);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, CODES.FORBIDDEN);
  assert.match(payload.message, /do not have permission/i);
});

test('maps HTTP statuses onto Coach Intel error codes', () => {
  assert.equal(codeForStatus(401), CODES.INVALID_TOKEN);
  assert.equal(codeForStatus(403), CODES.MISSING_CHANNEL_PERMISSIONS);
  assert.equal(codeForStatus(404), CODES.CHANNEL_NOT_FOUND);
  assert.equal(codeForStatus(429), CODES.RATE_LIMITED);
  assert.equal(codeForStatus(503), CODES.UNAVAILABLE);
  assert.equal(codeForStatus(418), CODES.UNKNOWN);
});

test('network failures become a NETWORK error rather than leaking the raw cause', () => {
  const err = toDiscordError(new Error('fetch failed'));
  assert.equal(err.code, CODES.NETWORK);
});

test('safeCall wraps success and failure in a plain envelope', async () => {
  const good = await safeCall(async () => ({ value: 1 }));
  assert.deepEqual(good, { ok: true, data: { value: 1 } });

  const bad = await safeCall(async () => {
    throw new DiscordError(CODES.RATE_LIMITED, SAMPLE_TOKEN);
  });
  assert.equal(bad.ok, false);
  assert.equal(bad.code, CODES.RATE_LIMITED);
  assert.ok(!JSON.stringify(bad).includes(SAMPLE_TOKEN));
});
