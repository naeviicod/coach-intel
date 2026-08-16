const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');

const { createStore } = require('../../src/main/discord/store');
const { CHANNEL_PURPOSES, EVENTS, STATUS } = require('../../src/main/discord/constants');
const { fakeSecretStore, tempDataRoot, cleanup } = require('../helpers');

const TOKEN = 'MTIzNDU2Nzg5MDEyMzQ1Njc4.GaBcDe.abcdefghijklmnopqrstuvwxyz123';

async function freshStore(options = {}) {
  const dataRoot = await tempDataRoot();
  const store = createStore({ dataRoot, secretStore: fakeSecretStore(options), ...options });
  return { store, dataRoot };
}

async function connected(store) {
  const integration = await store.saveIntegration({
    guild_id: '1',
    guild_name: 'Team Discord',
    bot_user_id: '99',
    status: STATUS.CONNECTED,
  });
  await store.setSecret(integration.id, TOKEN);
  return integration;
}

test('a fresh install reports no integration', async (t) => {
  const { store, dataRoot } = await freshStore();
  t.after(() => cleanup(dataRoot));
  assert.equal(await store.getIntegration(), null);
  await assert.rejects(() => store.requireIntegration(), /No Discord server is connected/);
});

test('saving an integration seeds every channel purpose and event preference', async (t) => {
  const { store, dataRoot } = await freshStore();
  t.after(() => cleanup(dataRoot));
  const integration = await connected(store);

  assert.equal(integration.channels.length, CHANNEL_PURPOSES.length);
  assert.equal(Object.keys(integration.preferences).length, EVENTS.length);
  // Defaults must be conservative: only high-value events on.
  const enabled = Object.values(integration.preferences).filter((p) => p.enabled).length;
  assert.ok(enabled > 0 && enabled < EVENTS.length);
});

test('the config is an array so more servers can be added without a migration', async (t) => {
  const { store, dataRoot } = await freshStore();
  t.after(() => cleanup(dataRoot));
  await connected(store);
  const config = await store.readConfig();
  assert.ok(Array.isArray(config.integrations));
  assert.equal(config.integrations.length, 1);
});

test('the bot token is never written to disk in plaintext', async (t) => {
  const { store, dataRoot } = await freshStore();
  t.after(() => cleanup(dataRoot));
  const integration = await connected(store);

  const onDisk = await fs.readFile(store.paths.secretsPath, 'utf-8');
  assert.ok(!onDisk.includes(TOKEN));
  assert.equal(await store.getSecret(integration.id), TOKEN);

  const config = await fs.readFile(store.paths.configPath, 'utf-8');
  assert.ok(!config.includes(TOKEN));
});

test('an unavailable keychain blocks storing the token instead of falling back', async (t) => {
  const dataRoot = await tempDataRoot();
  t.after(() => cleanup(dataRoot));
  const store = createStore({ dataRoot, secretStore: fakeSecretStore({ available: false }) });
  await store.saveIntegration({ guild_id: '1' });
  await assert.rejects(() => store.setSecret('di_1', TOKEN), /Discord returned an unexpected error/);
  assert.equal(await store.hasSecret(), false);
});

test('channel mappings without a channel id are stored disabled', async (t) => {
  const { store, dataRoot } = await freshStore();
  t.after(() => cleanup(dataRoot));
  await connected(store);

  const saved = await store.saveChannels([
    { purpose: 'strats', discord_channel_id: 'c1', discord_channel_name: 'strats', sensitivity: 'COACHING_STAFF', enabled: true },
    { purpose: 'general', discord_channel_id: null, enabled: true },
  ]);

  assert.equal(saved.channels.find((c) => c.purpose === 'strats').enabled, true);
  assert.equal(saved.channels.find((c) => c.purpose === 'general').enabled, false);
  // Untouched purposes survive a partial save.
  assert.equal(saved.channels.length, CHANNEL_PURPOSES.length);
});

test('channelForPurpose only returns enabled, mapped channels', async (t) => {
  const { store, dataRoot } = await freshStore();
  t.after(() => cleanup(dataRoot));
  await connected(store);
  await store.saveChannels([
    { purpose: 'strats', discord_channel_id: 'c1', discord_channel_name: 'strats', sensitivity: 'RESTRICTED', enabled: true },
  ]);

  assert.equal((await store.channelForPurpose('strats')).discord_channel_id, 'c1');
  assert.equal(await store.channelForPurpose('alerts'), null);
});

test('preferences persist enabled flags and fall back to the event default purpose', async (t) => {
  const { store, dataRoot } = await freshStore();
  t.after(() => cleanup(dataRoot));
  await connected(store);

  const saved = await store.savePreferences({
    'strategy.approved': { enabled: false },
    'vod.clip_added': { enabled: true },
  });

  assert.equal(saved.preferences['strategy.approved'].enabled, false);
  assert.equal(saved.preferences['vod.clip_added'].enabled, true);
  assert.equal(saved.preferences['vod.clip_added'].purpose, 'vod_review');
});

test('the idempotency ledger records a destination once', async (t) => {
  const { store, dataRoot } = await freshStore();
  t.after(() => cleanup(dataRoot));

  const key = store.deliveryKey({ eventId: 'strategy.approved:abc', destination: 'c1' });
  assert.equal(await store.wasDelivered(key), false);
  assert.equal(await store.markDelivered(key), true);
  assert.equal(await store.wasDelivered(key), true);
  // A second mark for the same key is a no-op.
  assert.equal(await store.markDelivered(key), false);

  const other = store.deliveryKey({ eventId: 'strategy.approved:abc', destination: 'c2' });
  assert.equal(await store.wasDelivered(other), false);
});

test('disconnecting clears config, credential, and pending delivery state', async (t) => {
  const { store, dataRoot } = await freshStore();
  t.after(() => cleanup(dataRoot));
  await connected(store);
  await store.markDelivered(store.deliveryKey({ eventId: 'x', destination: 'c1' }));

  await store.clearIntegration();

  assert.equal(await store.getIntegration(), null);
  assert.equal(await store.hasSecret(), false);
  assert.equal(await store.wasDelivered(store.deliveryKey({ eventId: 'x', destination: 'c1' })), false);
});

test('a corrupt config file degrades to "not connected" rather than throwing', async (t) => {
  const { store, dataRoot } = await freshStore();
  t.after(() => cleanup(dataRoot));
  await connected(store);
  await fs.writeFile(store.paths.configPath, '{ not json', 'utf-8');
  assert.equal(await store.getIntegration(), null);
});
