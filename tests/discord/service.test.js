const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const path = require('path');

const { createService } = require('../../src/main/discord');
const { STATUS } = require('../../src/main/discord/constants');
const { CODES } = require('../../src/main/discord/redact');
const { fakeSecretStore, tempDataRoot, cleanup, fakeResponse, noSleep } = require('../helpers');

const TOKEN = 'MTIzNDU2Nzg5MDEyMzQ1Njc4.GaBcDe.abcdefghijklmnopqrstuvwxyz123';
const GUILD = '100';
const BOT = '999';
const BOT_ROLE = '200';
const POST_ALL = '19456';

function routingFetch(overrides = {}) {
  const routes = {
    'GET /users/@me': { body: { id: BOT, username: 'Coach Intel', bot: true } },
    'GET /users/@me/guilds': { body: [{ id: GUILD, name: 'Team Discord', icon: null }] },
    [`GET /guilds/${GUILD}`]: { body: { id: GUILD, name: 'Team Discord' } },
    [`GET /guilds/${GUILD}/roles`]: {
      body: [
        { id: GUILD, name: '@everyone', permissions: '0', position: 0 },
        { id: BOT_ROLE, name: 'Coach Intel', permissions: POST_ALL, position: 3 },
      ],
    },
    [`GET /guilds/${GUILD}/members/${BOT}`]: { body: { user: { id: BOT }, roles: [BOT_ROLE] } },
    [`GET /guilds/${GUILD}/channels`]: {
      body: [
        { id: 'c1', name: 'coach-intel', type: 0, position: 1, permission_overwrites: [] },
        { id: 'c2', name: 'locked', type: 0, position: 2, permission_overwrites: [{ id: GUILD, type: 0, allow: '0', deny: '2048' }] },
      ],
    },
    'POST /channels/c1/messages': { status: 204 },
    ...overrides,
  };

  const calls = [];
  const impl = async (url, options) => {
    const endpoint = url.replace('https://discord.com/api/v10', '');
    const key = `${options.method} ${endpoint}`;
    calls.push({ key, body: options.body ? JSON.parse(options.body) : null, headers: options.headers });
    const route = routes[key];
    if (!route) return fakeResponse({ status: 404, body: { message: 'Unknown route' } });
    return fakeResponse(route);
  };
  impl.calls = calls;
  return impl;
}

async function makeService(t, fetchImpl = routingFetch()) {
  const dataRoot = await tempDataRoot();
  t.after(() => cleanup(dataRoot));
  const service = createService({
    dataRoot,
    secretStore: fakeSecretStore(),
    getOrgName: async () => 'Naevii',
    fetchImpl,
    sleep: noSleep(),
  });
  return { service, dataRoot, fetchImpl };
}

async function connect(service) {
  await service.beginConnect({ botToken: TOKEN });
  return service.completeConnect({ guildId: GUILD, actor: 'Coach' });
}

test('a fresh install reports NOT_CONNECTED with the full catalog available', async (t) => {
  const { service } = await makeService(t);
  const state = await service.getState();

  assert.equal(state.connected, false);
  assert.equal(state.status, STATUS.NOT_CONNECTED);
  assert.ok(state.catalog.purposes.length >= 5);
  assert.ok(state.catalog.events.length >= 20);
});

test('an empty bot token is rejected before any network call', async (t) => {
  const { service, fetchImpl } = await makeService(t);
  await assert.rejects(() => service.beginConnect({ botToken: '   ' }), (err) => err.code === CODES.INVALID_TOKEN);
  assert.equal(fetchImpl.calls.length, 0);
});

test('connecting validates the token, lists servers, and binds the chosen one', async (t) => {
  const { service } = await makeService(t);

  const begin = await service.beginConnect({ botToken: TOKEN });
  assert.equal(begin.bot.username, 'Coach Intel');
  assert.deepEqual(begin.guilds.map((g) => g.id), [GUILD]);

  const integration = await service.completeConnect({ guildId: GUILD, actor: 'Coach' });
  assert.equal(integration.guild_name, 'Team Discord');
  assert.equal(integration.status, STATUS.CONNECTED);
  assert.equal(integration.connected_by, 'Coach');

  const state = await service.getState();
  assert.equal(state.connected, true);
});

test('a server outside the bot guild list cannot be connected', async (t) => {
  const { service } = await makeService(t);
  await service.beginConnect({ botToken: TOKEN });
  await assert.rejects(
    () => service.completeConnect({ guildId: 'someone-elses-server' }),
    (err) => err.code === CODES.GUILD_NOT_FOUND
  );
});

test('completing a connection without starting one is rejected', async (t) => {
  const { service } = await makeService(t);
  await assert.rejects(() => service.completeConnect({ guildId: GUILD }), (err) => err.code === CODES.NOT_CONNECTED);
});

test('cancelling discards the pending token', async (t) => {
  const { service } = await makeService(t);
  await service.beginConnect({ botToken: TOKEN });
  service.cancelConnect();
  await assert.rejects(() => service.completeConnect({ guildId: GUILD }), (err) => err.code === CODES.NOT_CONNECTED);
});

test('channel listing annotates which channels are actually usable', async (t) => {
  const { service } = await makeService(t);
  await connect(service);

  const channels = await service.listChannels();
  assert.equal(channels.find((c) => c.id === 'c1').canPost, true);
  const locked = channels.find((c) => c.id === 'c2');
  assert.equal(locked.canPost, false);
  assert.deepEqual(locked.missing, ['Send Messages']);
});

test('saving mappings stores the good channel and rejects the unusable one', async (t) => {
  const { service } = await makeService(t);
  await connect(service);

  const { integration, rejected } = await service.saveChannels({
    mappings: [
      { purpose: 'general', discord_channel_id: 'c1', sensitivity: 'PUBLIC_TEAM', enabled: true },
      { purpose: 'alerts', discord_channel_id: 'c2', sensitivity: 'RESTRICTED', enabled: true },
    ],
    actor: 'Coach',
  });

  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].purpose, 'alerts');
  assert.deepEqual(rejected[0].missing, ['Send Messages']);

  // One bad channel must not block the rest of the integration.
  assert.equal(integration.channels.find((c) => c.purpose === 'general').enabled, true);
  assert.equal(integration.channels.find((c) => c.purpose === 'general').discord_channel_name, 'coach-intel');
  assert.equal(integration.channels.find((c) => c.purpose === 'alerts').enabled, false);
});

test('a mapping pointing at a deleted channel is cleared on save', async (t) => {
  const { service } = await makeService(t);
  await connect(service);

  const { rejected } = await service.saveChannels({ mappings: [{ purpose: 'general', discord_channel_id: 'deleted', enabled: true }] });
  assert.equal(rejected[0].reason, 'Channel no longer exists');
});

test('the test message is delivered to the configured channel', async (t) => {
  const { service, fetchImpl } = await makeService(t);
  await connect(service);
  await service.saveChannels({ mappings: [{ purpose: 'general', discord_channel_id: 'c1', sensitivity: 'PUBLIC_TEAM', enabled: true }] });

  const result = await service.test({ actor: 'Coach' });

  assert.equal(result.channel, 'coach-intel');
  const post = fetchImpl.calls.find((c) => c.key === 'POST /channels/c1/messages');
  assert.ok(post);
  assert.match(post.body.embeds[0].author.name, /COACH INTEL/);
  assert.equal(post.body.embeds[0].fields.find((f) => f.name === 'Organization').value, 'Naevii');
});

test('testing without any configured channel gives a clear error', async (t) => {
  const { service } = await makeService(t);
  await connect(service);
  await assert.rejects(() => service.test({}), (err) => err.code === CODES.NOT_CONFIGURED);
});

test('health verification persists the resulting status', async (t) => {
  const { service } = await makeService(t);
  await connect(service);
  await service.saveChannels({ mappings: [{ purpose: 'general', discord_channel_id: 'c1', sensitivity: 'PUBLIC_TEAM', enabled: true }] });

  const report = await service.verify({ actor: 'Coach' });
  assert.equal(report.status, STATUS.CONNECTED);

  const state = await service.getState();
  assert.equal(state.status, STATUS.CONNECTED);
  assert.ok(state.integration.last_verified_at);
});

test('publishing an event routes it through the Discord provider', async (t) => {
  const { service, fetchImpl } = await makeService(t);
  await connect(service);
  await service.saveChannels({ mappings: [{ purpose: 'general', discord_channel_id: 'c1', sensitivity: 'PUBLIC_TEAM', enabled: true }] });

  const { results } = await service.publish('intel.high_confidence.created', {
    team: { id: 'team-naevii', name: 'Team Naevii' },
    summary: 'Opponent favours the B site.',
    dedupeId: 'intel-1',
  });

  assert.equal(results[0].outcome, 'DELIVERED');
  assert.ok(fetchImpl.calls.some((c) => c.key === 'POST /channels/c1/messages'));
});

// The wiring main.js performs: domain writes publish to the event bus, and Discord
// is only a subscriber. This is what makes strat notifications fire for real.
test('a strat save reaching the event bus is delivered to the mapped channel', async (t) => {
  const events = require('../../src/main/events');
  const { service, fetchImpl } = await makeService(t);
  await connect(service);
  await service.saveChannels({
    mappings: [{ purpose: 'strats', discord_channel_id: 'c1', sensitivity: 'COACHING_STAFF', enabled: true }],
  });

  events.reset();
  t.after(() => events.reset());
  events.subscribe((eventId, payload) => service.publish(eventId, payload));

  const strat = {
    strategy_id: 'den-hardpoint',
    strategy_name: 'Den Spawn Trap',
    map: 'Den',
    mode: 'Hardpoint',
    status: 'READY FOR REVIEW',
    notes: 'Hold P2 until the break.',
    versions: [{ version: 1 }, { version: 2 }],
  };
  await events.stratSaved({
    previous: { ...strat, status: 'DRAFT' },
    strat,
    team: { id: 'team-naevii', name: 'Team Naevii' },
    actor: 'Ion',
  });

  const posted = fetchImpl.calls.find((c) => c.key === 'POST /channels/c1/messages');
  assert.ok(posted, 'the strat event should have been posted to the mapped channel');
  const embed = posted.body.embeds[0];
  assert.equal(embed.title, 'Den Spawn Trap');
  assert.ok(embed.fields.some((f) => f.value === 'READY FOR REVIEW'));
  assert.ok(embed.fields.some((f) => f.value.includes('coachintel://')));

  // A retry of the same save must not post twice.
  await events.stratSaved({
    previous: { ...strat, status: 'DRAFT' },
    strat,
    team: { id: 'team-naevii', name: 'Team Naevii' },
    actor: 'Ion',
  });
  const posts = fetchImpl.calls.filter((c) => c.key === 'POST /channels/c1/messages');
  assert.equal(posts.length, 1);
});

test('a coaching-staff strat event never reaches a public team channel', async (t) => {
  const events = require('../../src/main/events');
  const { service, fetchImpl } = await makeService(t);
  await connect(service);
  await service.saveChannels({
    mappings: [{ purpose: 'strats', discord_channel_id: 'c1', sensitivity: 'PUBLIC_TEAM', enabled: true }],
  });

  events.reset();
  t.after(() => events.reset());
  events.subscribe((eventId, payload) => service.publish(eventId, payload));

  await events.stratSaved({
    previous: { strategy_id: 's1', status: 'DRAFT' },
    strat: { strategy_id: 's1', strategy_name: 'Skidrow Break', status: 'APPROVED', versions: [{ version: 2 }] },
    team: { id: 'team-naevii', name: 'Team Naevii' },
    actor: 'Ion',
  });

  assert.ok(!fetchImpl.calls.some((c) => c.key === 'POST /channels/c1/messages'));
});

test('operations that need a connection fail cleanly when there is none', async (t) => {
  const { service } = await makeService(t);
  await assert.rejects(() => service.listChannels(), (err) => err.code === CODES.NOT_CONNECTED);
  await assert.rejects(() => service.listRoles(), (err) => err.code === CODES.NOT_CONNECTED);
  await assert.rejects(() => service.test({}), (err) => err.code === CODES.NOT_CONNECTED);
});

test('disconnecting removes Discord state but preserves Coach Intel data', async (t) => {
  const { service, dataRoot } = await makeService(t);
  await connect(service);
  await service.saveChannels({ mappings: [{ purpose: 'general', discord_channel_id: 'c1', enabled: true, sensitivity: 'PUBLIC_TEAM' }] });

  // Stand-in for real Coach Intel domain data.
  const teamFile = path.join(dataRoot, 'org', 'teams', 'team-naevii', 'team-profile.json');
  await fs.mkdir(path.dirname(teamFile), { recursive: true });
  await fs.writeFile(teamFile, JSON.stringify({ name: 'Team Naevii' }), 'utf-8');

  await service.disconnect({ actor: 'Coach' });

  const state = await service.getState();
  assert.equal(state.connected, false);
  assert.equal(state.integration, null);
  assert.equal(state.hasCredential, false);

  // Domain data untouched.
  const preserved = JSON.parse(await fs.readFile(teamFile, 'utf-8'));
  assert.equal(preserved.name, 'Team Naevii');
});

test('the audit log records the integration lifecycle', async (t) => {
  const { service } = await makeService(t);
  await connect(service);
  await service.saveChannels({ mappings: [{ purpose: 'general', discord_channel_id: 'c1', enabled: true, sensitivity: 'PUBLIC_TEAM' }] });
  await service.test({ actor: 'Coach' });
  await service.disconnect({ actor: 'Coach' });

  const entries = await service.auditRecent({ limit: 50 });
  const actions = entries.map((e) => e.action);
  assert.ok(actions.includes('discord.guild_connected'));
  assert.ok(actions.includes('discord.channel_mapping_changed'));
  assert.ok(actions.includes('discord.test_message_sent'));
  assert.ok(actions.includes('discord.guild_disconnected'));
  for (const entry of entries) {
    assert.ok(entry.timestamp && entry.action && entry.result);
  }
});
