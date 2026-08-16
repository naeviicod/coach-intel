const test = require('node:test');
const assert = require('node:assert/strict');

const guildApi = require('../../src/main/discord/guild');
const { STATUS } = require('../../src/main/discord/constants');
const { DiscordError, CODES } = require('../../src/main/discord/redact');
const { fakeClient } = require('../helpers');

const GUILD = '100';
const BOT = '999';
const BOT_ROLE = '200';
const POST_ALL = '19456'; // View Channel + Send Messages + Embed Links

function routes(overrides = {}) {
  return {
    [`GET /guilds/${GUILD}`]: { id: GUILD, name: 'Team Discord' },
    [`GET /guilds/${GUILD}/roles`]: [
      { id: GUILD, name: '@everyone', permissions: '0', position: 0 },
      { id: BOT_ROLE, name: 'Coach Intel', permissions: POST_ALL, position: 5 },
    ],
    [`GET /guilds/${GUILD}/members/${BOT}`]: { user: { id: BOT }, roles: [BOT_ROLE] },
    [`GET /guilds/${GUILD}/channels`]: [
      { id: 'cat', name: 'Coaching', type: 4, position: 0 },
      { id: 'c1', name: 'strats', type: 0, parent_id: 'cat', position: 1, permission_overwrites: [] },
      { id: 'c2', name: 'private-coaches', type: 0, position: 2, permission_overwrites: [{ id: GUILD, type: 0, allow: '0', deny: '1024' }] },
      { id: 'v1', name: 'Voice', type: 2, position: 3 },
    ],
    ...overrides,
  };
}

test('rejects a credential that is not a bot token', async () => {
  const client = fakeClient({ 'GET /users/@me': { id: '1', username: 'Human', bot: false } });
  await assert.rejects(() => guildApi.validateToken(client, 'x'), (err) => err.code === CODES.INVALID_TOKEN);
});

test('accepts a bot token and returns the bot identity', async () => {
  const client = fakeClient({ 'GET /users/@me': { id: BOT, username: 'Coach Intel', bot: true } });
  const bot = await guildApi.validateToken(client, 'x');
  assert.equal(bot.id, BOT);
  assert.equal(bot.username, 'Coach Intel');
});

test('only lists servers the bot has actually been invited to', async () => {
  const client = fakeClient({
    'GET /users/@me/guilds': [{ id: GUILD, name: 'Team Discord', icon: 'abc' }],
  });
  const guilds = await guildApi.listGuilds(client, 'token');
  assert.deepEqual(guilds, [{ id: GUILD, name: 'Team Discord', icon: 'abc' }]);
});

test('lists text channels with a real per-channel permission verdict', async () => {
  const client = fakeClient(routes());
  const channels = await guildApi.listChannels(client, GUILD, BOT);

  // Voice channels and categories are not postable destinations.
  assert.deepEqual(channels.map((c) => c.id).sort(), ['c1', 'c2']);

  const strats = channels.find((c) => c.id === 'c1');
  assert.equal(strats.canPost, true);
  assert.equal(strats.category, 'Coaching');

  const locked = channels.find((c) => c.id === 'c2');
  assert.equal(locked.canPost, false);
  assert.deepEqual(locked.missing, ['View Channel']);
});

test('validateChannel reports a deleted channel', async () => {
  const client = fakeClient(routes());
  const result = await guildApi.validateChannel(client, GUILD, BOT, 'gone');
  assert.equal(result.ok, false);
  assert.equal(result.code, CODES.CHANNEL_NOT_FOUND);
});

test('validateChannel reports missing permissions with the specific flags', async () => {
  const client = fakeClient(routes());
  const result = await guildApi.validateChannel(client, GUILD, BOT, 'c2');
  assert.equal(result.ok, false);
  assert.equal(result.code, CODES.MISSING_CHANNEL_PERMISSIONS);
  assert.deepEqual(result.missing, ['View Channel']);
});

test('a fully working setup verifies as CONNECTED', async () => {
  const client = fakeClient(routes());
  const report = await guildApi.verifyHealth(client, {
    guild_id: GUILD,
    guild_name: 'Team Discord',
    bot_user_id: BOT,
    channels: [{ purpose: 'strats', discord_channel_id: 'c1', discord_channel_name: 'strats', enabled: true }],
  });

  assert.equal(report.status, STATUS.CONNECTED);
  assert.equal(report.guild.ok, true);
  assert.equal(report.bot.ok, true);
  assert.equal(report.channels[0].ok, true);
});

test('a deleted channel degrades to NEEDS ATTENTION with an actionable message', async () => {
  const client = fakeClient(routes());
  const report = await guildApi.verifyHealth(client, {
    guild_id: GUILD,
    guild_name: 'Team Discord',
    bot_user_id: BOT,
    channels: [{ purpose: 'strats', discord_channel_id: 'deleted', discord_channel_name: 'strats', enabled: true }],
  });

  assert.equal(report.status, STATUS.NEEDS_ATTENTION);
  assert.equal(report.channels[0].ok, false);
  assert.match(report.channels[0].error, /no longer exists\. Select another channel\./);
});

test('revoked channel permissions surface as PERMISSION ERROR', async () => {
  const client = fakeClient(routes());
  const report = await guildApi.verifyHealth(client, {
    guild_id: GUILD,
    guild_name: 'Team Discord',
    bot_user_id: BOT,
    channels: [{ purpose: 'strats', discord_channel_id: 'c2', discord_channel_name: 'private-coaches', enabled: true }],
  });

  assert.equal(report.status, STATUS.PERMISSION_ERROR);
  assert.match(report.channels[0].error, /Missing in #private-coaches: View Channel/);
});

test('a removed bot is detected and explained', async () => {
  const client = fakeClient(routes({ [`GET /guilds/${GUILD}`]: new DiscordError(CODES.CHANNEL_NOT_FOUND) }));
  const report = await guildApi.verifyHealth(client, {
    guild_id: GUILD,
    guild_name: 'Team Discord',
    bot_user_id: BOT,
    channels: [],
  });

  assert.equal(report.guild.ok, false);
  assert.match(report.guild.error, /no longer in this server/i);
  assert.equal(report.status, STATUS.NEEDS_ATTENTION);
});

test('a rejected token during verification reports a permission error', async () => {
  const client = fakeClient(routes({ [`GET /guilds/${GUILD}`]: new DiscordError(CODES.INVALID_TOKEN) }));
  const report = await guildApi.verifyHealth(client, { guild_id: GUILD, bot_user_id: BOT, channels: [] });
  assert.equal(report.status, STATUS.PERMISSION_ERROR);
});

test('one broken channel does not hide the healthy ones', async () => {
  const client = fakeClient(routes());
  const report = await guildApi.verifyHealth(client, {
    guild_id: GUILD,
    bot_user_id: BOT,
    guild_name: 'Team Discord',
    channels: [
      { purpose: 'strats', discord_channel_id: 'c1', discord_channel_name: 'strats', enabled: true },
      { purpose: 'alerts', discord_channel_id: 'c2', discord_channel_name: 'private-coaches', enabled: true },
    ],
  });

  assert.equal(report.channels.length, 2);
  assert.equal(report.channels.find((c) => c.purpose === 'strats').ok, true);
  assert.equal(report.channels.find((c) => c.purpose === 'alerts').ok, false);
});

test('the bot invite URL requests only posting permissions, never Administrator', () => {
  const url = guildApi.botInviteUrl('123456');
  assert.match(url, /client_id=123456/);
  assert.match(url, /scope=bot/);
  assert.match(url, /permissions=19456/);
  assert.ok(!url.includes('permissions=8'));
});
