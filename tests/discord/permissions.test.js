const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ALL_PERMISSIONS,
  computeBasePermissions,
  computeChannelPermissions,
  missingPermissions,
  canPost,
  describePermissions,
} = require('../../src/main/discord/permissions');

const GUILD = '100';
const BOT = '999';
const BOT_ROLE = '200';

const VIEW = 1024n;
const SEND = 2048n;
const EMBED = 16384n;
const POST_ALL = VIEW | SEND | EMBED; // 19456
const ADMIN = 8n;

function roles({ everyone = 0n, bot = 0n } = {}) {
  return [
    { id: GUILD, permissions: String(everyone) },
    { id: BOT_ROLE, permissions: String(bot) },
  ];
}

test('base permissions union @everyone with the bot roles', () => {
  const bits = computeBasePermissions(GUILD, [BOT_ROLE], roles({ everyone: VIEW, bot: SEND | EMBED }));
  assert.equal(bits, POST_ALL);
});

test('Administrator short-circuits to every permission', () => {
  const bits = computeBasePermissions(GUILD, [BOT_ROLE], roles({ bot: ADMIN }));
  assert.equal(bits, ALL_PERMISSIONS);
  assert.equal(canPost(bits), true);
});

test('an administrator bot is unaffected by channel denies', () => {
  const bits = computeChannelPermissions({
    guildId: GUILD,
    memberUserId: BOT,
    memberRoleIds: [BOT_ROLE],
    roles: roles({ bot: ADMIN }),
    channel: { permission_overwrites: [{ id: GUILD, type: 0, allow: '0', deny: String(POST_ALL) }] },
  });
  assert.equal(bits, ALL_PERMISSIONS);
});

test('the @everyone channel overwrite can deny a base permission', () => {
  const bits = computeChannelPermissions({
    guildId: GUILD,
    memberUserId: BOT,
    memberRoleIds: [BOT_ROLE],
    roles: roles({ everyone: POST_ALL }),
    channel: { permission_overwrites: [{ id: GUILD, type: 0, allow: '0', deny: String(VIEW) }] },
  });
  assert.deepEqual(missingPermissions(bits), ['VIEW_CHANNEL']);
  assert.equal(canPost(bits), false);
});

test('a role overwrite allow restores a permission denied for @everyone', () => {
  const bits = computeChannelPermissions({
    guildId: GUILD,
    memberUserId: BOT,
    memberRoleIds: [BOT_ROLE],
    roles: roles({ everyone: POST_ALL }),
    channel: {
      permission_overwrites: [
        { id: GUILD, type: 0, allow: '0', deny: String(SEND) },
        { id: BOT_ROLE, type: 0, allow: String(SEND), deny: '0' },
      ],
    },
  });
  assert.equal(canPost(bits), true);
});

test('a member overwrite wins over a role overwrite', () => {
  const bits = computeChannelPermissions({
    guildId: GUILD,
    memberUserId: BOT,
    memberRoleIds: [BOT_ROLE],
    roles: roles({ everyone: POST_ALL }),
    channel: {
      permission_overwrites: [
        { id: BOT_ROLE, type: 0, allow: '0', deny: String(EMBED) },
        { id: BOT, type: 1, allow: String(EMBED), deny: '0' },
      ],
    },
  });
  assert.equal(canPost(bits), true);
});

test('overwrites for roles the bot does not hold are ignored', () => {
  const bits = computeChannelPermissions({
    guildId: GUILD,
    memberUserId: BOT,
    memberRoleIds: [BOT_ROLE],
    roles: roles({ everyone: POST_ALL }),
    channel: { permission_overwrites: [{ id: '555', type: 0, allow: '0', deny: String(POST_ALL) }] },
  });
  assert.equal(canPost(bits), true);
});

test('reports every missing posting permission', () => {
  const bits = computeChannelPermissions({
    guildId: GUILD,
    memberUserId: BOT,
    memberRoleIds: [],
    roles: roles({ everyone: VIEW }),
    channel: { permission_overwrites: [] },
  });
  assert.deepEqual(missingPermissions(bits).sort(), ['EMBED_LINKS', 'SEND_MESSAGES']);
  assert.deepEqual(describePermissions(['SEND_MESSAGES', 'EMBED_LINKS']), ['Send Messages', 'Embed Links']);
});

test('malformed permission strings are treated as no permissions', () => {
  const bits = computeBasePermissions(GUILD, [BOT_ROLE], [
    { id: GUILD, permissions: 'not-a-number' },
    { id: BOT_ROLE, permissions: null },
  ]);
  assert.equal(bits, 0n);
  assert.equal(canPost(bits), false);
});
