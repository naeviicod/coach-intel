const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const setup = require(path.join(__dirname, '..', 'src', 'main', 'desktopSetup'));

test('desktop setup accepts only an exact coachintel setup callback', () => {
  const state = 'a'.repeat(64);
  const code = 'b'.repeat(64);
  assert.deepEqual(setup.parseSetupCallback(`coachintel://setup?code=${code}&state=${state}`), { code, state, error: null });
  assert.equal(setup.parseSetupCallback(`coachintel://auth-callback?code=${code}`), null);
  assert.equal(setup.parseSetupCallback(`coachintel://setup/other?code=${code}&state=${state}`), null);
  assert.equal(setup.parseSetupCallback(`coachintel://setup?code=${code}&code=${code}&state=${state}`), null);
  assert.equal(setup.parseSetupCallback(`coachintel://setup?code=${code}&state=${state}&email=a@b.com`), null);
});

test('desktop setup opens only the HTTPS Coach Intel authorization endpoint and redeems in memory', async () => {
  const opened = [];
  const requests = [];
  const service = setup.createDesktopSetupService({
    openExternal: async (url) => opened.push(url),
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      return { ok: true, json: async () => ({ displayName: 'Naevii' }) };
    },
  });
  assert.deepEqual(await service.begin('3.9.0'), { ok: true });
  assert.equal(opened.length, 1);
  const authorization = new URL(opened[0]);
  assert.equal(authorization.origin, 'https://coach.championshipseries.eu');
  assert.equal(authorization.pathname, '/desktop/setup');
  const state = authorization.searchParams.get('state');
  assert.match(state, /^[a-f0-9]{64}$/);
  assert.match(authorization.searchParams.get('challenge'), /^[a-f0-9]{64}$/);

  const result = await service.redeem(`coachintel://setup?code=${'c'.repeat(64)}&state=${state}`);
  assert.deepEqual(result, { ok: true, displayName: 'Naevii' });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://coach.championshipseries.eu/api/desktop-setup/redeem');
  const payload = JSON.parse(requests[0].options.body);
  assert.equal(payload.code, 'c'.repeat(64));
  assert.equal(payload.state, state);
  assert.match(payload.verifier, /^[a-f0-9]{64}$/);
});

test('desktop setup rejects replay, bad state, network failure, and email-only display values', async () => {
  const service = setup.createDesktopSetupService({
    openExternal: async () => {},
    fetchImpl: async () => { throw new Error('offline'); },
  });
  await service.begin('3.9.0');
  assert.deepEqual(await service.redeem(`coachintel://setup?code=${'d'.repeat(64)}&state=${'e'.repeat(64)}`), {
    ok: false,
    error: 'invalid-or-expired',
  });
  assert.equal(setup.sanitizeDisplayName('member@example.com'), null);
  assert.equal(setup.sanitizeDisplayName('  Player\u202e '), 'Player');
  assert.equal(setup.sanitizeDisplayName('A'.repeat(100)).length, 80);
});

test('renderer setup copy uses the required personalized and generic wording without an email fallback', async () => {
  const { pathToFileURL } = require('node:url');
  const lib = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'renderer', 'lib', 'desktopSetup.js')).href);
  assert.deepEqual(lib.welcomeCopy('Naevii'), {
    title: 'Welcome to Coach Intel, Naevii',
    lineOne: 'Thank you for downloading Coach Intel, Naevii. Prepare smarter, improve your strategy and take your game to the next level.',
    lineTwo: 'Click Continue to complete setup and get started.',
  });
  assert.deepEqual(lib.welcomeCopy('member@example.com'), {
    title: 'Welcome to Coach Intel',
    lineOne: 'Thank you for downloading Coach Intel. Prepare smarter, improve your strategy and take your game to the next level.',
    lineTwo: 'Click Continue to complete setup and get started.',
  });
});
