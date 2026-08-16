const test = require('node:test');
const assert = require('node:assert/strict');

const { DiscordClient } = require('../../src/main/discord/client');
const { CODES } = require('../../src/main/discord/redact');
const { fakeResponse, recordingFetch, noSleep } = require('../helpers');

const TOKEN = 'MTIzNDU2Nzg5MDEyMzQ1Njc4.GaBcDe.abcdefghijklmnopqrstuvwxyz123';

function makeClient(fetchImpl, options = {}) {
  const sleep = options.sleep || noSleep();
  const client = new DiscordClient({
    getToken: async () => TOKEN,
    fetchImpl,
    sleep,
    ...options,
  });
  client.__sleep = sleep;
  return client;
}

test('sends the bot token as an Authorization header and parses JSON', async () => {
  const fetchImpl = recordingFetch([fakeResponse({ body: { id: '1', username: 'CoachIntel' } })]);
  const client = makeClient(fetchImpl);

  const result = await client.get('/users/@me');

  assert.deepEqual(result, { id: '1', username: 'CoachIntel' });
  assert.equal(fetchImpl.calls[0].options.headers.Authorization, `Bot ${TOKEN}`);
  assert.match(fetchImpl.calls[0].url, /\/users\/@me$/);
});

test('a 204 response resolves to null', async () => {
  const client = makeClient(recordingFetch([fakeResponse({ status: 204 })]));
  assert.equal(await client.get('/channels/1/messages'), null);
});

test('retries a 429 after the advertised delay, then succeeds', async () => {
  const fetchImpl = recordingFetch([
    fakeResponse({ status: 429, headers: { 'retry-after': '2' } }),
    fakeResponse({ body: { ok: true } }),
  ]);
  const client = makeClient(fetchImpl);

  const result = await client.get('/guilds/1');

  assert.deepEqual(result, { ok: true });
  assert.equal(fetchImpl.calls.length, 2);
  assert.ok(client.__sleep.waits.includes(2000), 'should wait the retry_after window');
});

test('gives up on a persistent 429 with a rate-limit error', async () => {
  const fetchImpl = recordingFetch([fakeResponse({ status: 429, headers: { 'retry-after': '1' } })]);
  const client = makeClient(fetchImpl, { maxAttempts: 3 });

  await assert.rejects(() => client.get('/guilds/1'), (err) => err.code === CODES.RATE_LIMITED);
  assert.equal(fetchImpl.calls.length, 3);
});

test('a global rate limit gates later requests to other routes', async () => {
  let clock = 0;
  const fetchImpl = recordingFetch([
    fakeResponse({ status: 429, headers: { 'retry-after': '5', 'x-ratelimit-global': 'true' } }),
    fakeResponse({ body: { ok: true } }),
  ]);
  const sleep = noSleep();
  const client = makeClient(fetchImpl, { sleep, now: () => clock });

  await client.get('/guilds/1');
  assert.ok(client.globalResetAt > 0, 'global gate should be armed');
});

test('retries 5xx responses and surfaces UNAVAILABLE when they persist', async () => {
  const fetchImpl = recordingFetch([fakeResponse({ status: 503 })]);
  const client = makeClient(fetchImpl, { maxAttempts: 3 });

  await assert.rejects(() => client.get('/guilds/1'), (err) => err.code === CODES.UNAVAILABLE);
  assert.equal(fetchImpl.calls.length, 3);
});

test('does not retry a 403 and maps it to a permissions error', async () => {
  const fetchImpl = recordingFetch([fakeResponse({ status: 403, body: { message: 'Missing Access' } })]);
  const client = makeClient(fetchImpl);

  await assert.rejects(
    () => client.post('/channels/1/messages', { content: 'x' }),
    (err) => err.code === CODES.MISSING_CHANNEL_PERMISSIONS
  );
  assert.equal(fetchImpl.calls.length, 1, '4xx must not be retried');
});

test('maps 401 to an invalid-token error', async () => {
  const client = makeClient(recordingFetch([fakeResponse({ status: 401 })]));
  await assert.rejects(() => client.get('/users/@me'), (err) => err.code === CODES.INVALID_TOKEN);
});

test('retries a network failure then reports NETWORK when it keeps failing', async () => {
  const fetchImpl = recordingFetch([new Error('fetch failed')]);
  const client = makeClient(fetchImpl, { maxAttempts: 2 });

  await assert.rejects(() => client.get('/guilds/1'), (err) => err.code === CODES.NETWORK);
  assert.equal(fetchImpl.calls.length, 2);
});

test('honours x-ratelimit-remaining: 0 before issuing the next request', async () => {
  let clock = 1000;
  const fetchImpl = recordingFetch([
    fakeResponse({ body: { a: 1 }, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset-after': '3' } }),
    fakeResponse({ body: { a: 2 } }),
  ]);
  const sleep = noSleep();
  const client = makeClient(fetchImpl, { sleep, now: () => clock });

  await client.get('/guilds/1/channels');
  await client.get('/guilds/1/channels');

  assert.ok(sleep.waits.some((w) => w === 3000), `expected a 3000ms wait, saw ${sleep.waits}`);
});

test('caches GETs marked cacheable and serves the second call without a request', async () => {
  const fetchImpl = recordingFetch([fakeResponse({ body: [{ id: 'c1' }] })]);
  const client = makeClient(fetchImpl);

  const first = await client.get('/guilds/1/channels', { cache: true });
  const second = await client.get('/guilds/1/channels', { cache: true });

  assert.deepEqual(first, second);
  assert.equal(fetchImpl.calls.length, 1, 'stable config must not be refetched on every render');
});

test('cache entries expire once the TTL has elapsed', async () => {
  let clock = 0;
  const fetchImpl = recordingFetch([fakeResponse({ body: { v: 1 } }), fakeResponse({ body: { v: 2 } })]);
  const client = makeClient(fetchImpl, { now: () => clock, cacheTtlMs: 100 });

  await client.get('/guilds/1', { cache: true });
  clock = 500;
  await client.get('/guilds/1', { cache: true });

  assert.equal(fetchImpl.calls.length, 2);
});

test('invalidate clears cached reads by prefix', async () => {
  const fetchImpl = recordingFetch([fakeResponse({ body: { v: 1 } }), fakeResponse({ body: { v: 2 } })]);
  const client = makeClient(fetchImpl);

  await client.get('/guilds/1/channels', { cache: true });
  client.invalidate('GET /guilds/1');
  await client.get('/guilds/1/channels', { cache: true });

  assert.equal(fetchImpl.calls.length, 2);
});

test('requests are serialized so a notification burst never fans out', async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const fetchImpl = async () => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 5));
    inFlight -= 1;
    return fakeResponse({ body: { ok: true } });
  };
  const client = makeClient(fetchImpl);

  await Promise.all([
    client.post('/channels/1/messages', { a: 1 }),
    client.post('/channels/1/messages', { a: 2 }),
    client.post('/channels/2/messages', { a: 3 }),
  ]);

  assert.equal(maxInFlight, 1);
});

test('a failing request does not break the queue for later requests', async () => {
  const fetchImpl = recordingFetch([
    fakeResponse({ status: 403 }),
    fakeResponse({ body: { ok: true } }),
  ]);
  const client = makeClient(fetchImpl);

  await assert.rejects(() => client.get('/channels/1'));
  assert.deepEqual(await client.get('/channels/2'), { ok: true });
});

test('a missing token fails before any network call', async () => {
  const fetchImpl = recordingFetch([fakeResponse({ body: {} })]);
  const client = new DiscordClient({ getToken: async () => null, fetchImpl, sleep: noSleep() });

  await assert.rejects(() => client.get('/users/@me'), (err) => err.code === CODES.NOT_CONNECTED);
  assert.equal(fetchImpl.calls.length, 0);
});
