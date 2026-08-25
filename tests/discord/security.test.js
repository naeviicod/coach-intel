const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const path = require('path');

const { createService } = require('../../src/main/discord');
const { createAuditLog } = require('../../src/main/discord/audit');
const { fakeSecretStore, tempDataRoot, cleanup, fakeResponse, noSleep } = require('../helpers');

const REPO_ROOT = path.join(__dirname, '..', '..');
const RENDERER_DIR = path.join(REPO_ROOT, 'src', 'renderer');
const MAIN_DIR = path.join(REPO_ROOT, 'src', 'main');

const TOKEN = 'MTIzNDU2Nzg5MDEyMzQ1Njc4.GaBcDe.abcdefghijklmnopqrstuvwxyz123';

async function jsFilesIn(dir) {
  const out = [];
  async function walk(current) {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (/\.(js|html|css)$/.test(entry.name)) out.push(full);
    }
  }
  await walk(dir);
  return out;
}

test('no Discord credential literal is committed anywhere in src', async () => {
  const files = [...(await jsFilesIn(RENDERER_DIR)), ...(await jsFilesIn(MAIN_DIR))];
  const tokenLike = /\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{27,}\b/;

  for (const file of files) {
    const contents = await fs.readFile(file, 'utf-8');
    assert.ok(!tokenLike.test(contents), `${path.relative(REPO_ROOT, file)} contains a token-shaped literal`);
  }
});

test('renderer code never touches a stored credential or builds auth headers', async () => {
  // The connect dialog necessarily reads a token from an input and hands it to the
  // main process. What it must never do is name a *stored* credential, reach for the
  // keychain, or construct an Authorization header itself.
  const forbidden = ['safeStorage', 'bot_token', 'DISCORD_BOT_TOKEN', 'DISCORD_CLIENT_SECRET', 'Authorization'];
  const files = await jsFilesIn(RENDERER_DIR);

  for (const file of files) {
    const contents = await fs.readFile(file, 'utf-8');
    for (const needle of forbidden) {
      assert.ok(
        !contents.includes(needle),
        `${path.relative(REPO_ROOT, file)} must not reference "${needle}"`
      );
    }
  }
});

test('the pasted token is handed straight to the main process and never held', async () => {
  const dialog = await fs.readFile(path.join(RENDERER_DIR, 'pages', 'integrations.js'), 'utf-8');

  // The only thing done with the input value is pass it to beginConnect.
  assert.match(dialog, /beginConnect\(\{\s*botToken:\s*token\s*\}\)/);
  // And the field is cleared as soon as it has been handed over.
  assert.match(dialog, /input\.value\s*=\s*''/);
  // It is typed as a password field so it is not shoulder-readable or autofilled.
  assert.match(dialog, /type:\s*'password'/);
  assert.match(dialog, /autocomplete:\s*'off'/);
});

test('no Discord screen writes to browser storage', async () => {
  // Coach Intel keeps UI chrome state in localStorage (src/renderer/prefs.js), which
  // is fine for panel layout but must never be used for Discord configuration or
  // credentials.
  const discordFiles = [
    path.join(RENDERER_DIR, 'pages', 'integrations.js'),
    path.join(RENDERER_DIR, 'components', 'discordConfig.js'),
    path.join(RENDERER_DIR, 'components', 'discordShare.js'),
    path.join(RENDERER_DIR, 'components', 'modal.js'),
  ];

  for (const file of discordFiles) {
    const contents = await fs.readFile(file, 'utf-8');
    for (const needle of ['localStorage', 'sessionStorage', 'indexedDB', 'document.cookie']) {
      assert.ok(!contents.includes(needle), `${path.relative(REPO_ROOT, file)} must not use ${needle}`);
    }
  }
});

test('the renderer never calls the Discord API directly', async () => {
  const files = await jsFilesIn(RENDERER_DIR);
  for (const file of files) {
    const contents = await fs.readFile(file, 'utf-8');
    assert.ok(
      !contents.includes('discord.com/api'),
      `${path.relative(REPO_ROOT, file)} must route Discord calls through the main process`
    );
  }
});

test('the preload bridge exposes no credential surface', async () => {
  const preload = await fs.readFile(path.join(MAIN_DIR, 'preload.js'), 'utf-8');
  assert.ok(!preload.includes('safeStorage'));
  assert.ok(!preload.includes('getSecret'));
  assert.ok(preload.includes('discord'), 'the Discord bridge should exist');
});

test('the state sent to the renderer contains no token', async (t) => {
  const dataRoot = await tempDataRoot();
  t.after(() => cleanup(dataRoot));

  const fetchImpl = async (url, options) => {
    const endpoint = url.replace('https://discord.com/api/v10', '');
    if (endpoint === '/users/@me') return fakeResponse({ body: { id: '9', username: 'Coach Intel', bot: true } });
    if (endpoint === '/users/@me/guilds') return fakeResponse({ body: [{ id: '1', name: 'Team Discord' }] });
    return fakeResponse({ status: 404, body: {} });
  };

  const service = createService({
    dataRoot,
    secretStore: fakeSecretStore(),
    fetchImpl,
    sleep: noSleep(),
  });

  await service.beginConnect({ botToken: TOKEN });
  await service.completeConnect({ guildId: '1', actor: 'Coach' });

  const state = await service.getState();
  const serialized = JSON.stringify(state);

  assert.ok(!serialized.includes(TOKEN), 'getState leaked the bot token');
  assert.ok(!/"(bot_)?token"/.test(serialized), 'getState exposed a token field');
  assert.equal(state.hasCredential, true, 'the UI still learns that a credential exists');
});

test('audit entries never persist a credential, even if a caller passes one', async (t) => {
  const dataRoot = await tempDataRoot();
  t.after(() => cleanup(dataRoot));
  const audit = createAuditLog({ dataRoot });

  await audit.record({
    action: 'discord.test',
    target: 'channel',
    detail: { bot_token: TOKEN, note: `raw Bot ${TOKEN}` },
  });

  const onDisk = await fs.readFile(audit.filePath, 'utf-8');
  assert.ok(!onDisk.includes(TOKEN));
});

test('only Discord HTTPS hosts can be opened externally', async () => {
  const main = await fs.readFile(path.join(MAIN_DIR, 'main.js'), 'utf-8');
  assert.ok(main.includes('ALLOWED_EXTERNAL_HOSTS'), 'external opens should be allowlisted');
  assert.ok(main.includes("parsed.protocol !== 'https:'"), 'non-HTTPS schemes should be refused');
  assert.ok(main.includes('coach.championshipseries.eu'), 'the Coach Intel site may be opened from About');
});

test('deep links only accept simple route segments', async () => {
  const main = await fs.readFile(path.join(MAIN_DIR, 'main.js'), 'utf-8');
  assert.match(main, /A-Za-z0-9\/_-/, 'deep-link routes should be validated against a strict pattern');
});
