// Computes what the Coach Intel bot can actually do in a given channel, so the UI
// can show a real ✓/✕ per channel instead of guessing.
//
// Follows Discord's documented resolution order: base role permissions, then the
// @everyone channel overwrite, then role overwrites, then the member overwrite.
// Administrator short-circuits everything.

const { PERMISSIONS, REQUIRED_CHANNEL_PERMISSIONS } = require('./constants');

const ALL_PERMISSIONS = (1n << 64n) - 1n;

const OVERWRITE_TYPE = { ROLE: 0, MEMBER: 1 };

function toBigInt(value) {
  if (typeof value === 'bigint') return value;
  if (value === null || value === undefined || value === '') return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

function has(bits, flagName) {
  const flag = PERMISSIONS[flagName];
  if (!flag) return false;
  return (bits & flag) === flag;
}

/**
 * Union of @everyone plus every role the bot holds.
 * @param {string} guildId
 * @param {string[]} memberRoleIds
 * @param {Array<{id: string, permissions: string}>} roles
 */
function computeBasePermissions(guildId, memberRoleIds, roles) {
  const roleById = new Map((roles || []).map((r) => [r.id, r]));
  // The @everyone role always shares the guild's ID.
  let bits = toBigInt(roleById.get(guildId)?.permissions);
  for (const roleId of memberRoleIds || []) {
    bits |= toBigInt(roleById.get(roleId)?.permissions);
  }
  if (has(bits, 'ADMINISTRATOR')) return ALL_PERMISSIONS;
  return bits;
}

/**
 * Applies a channel's permission overwrites on top of base permissions.
 * @param {object} args
 * @param {string} args.guildId
 * @param {object} args.channel          Discord channel object with permission_overwrites
 * @param {string[]} args.memberRoleIds  role IDs held by the bot
 * @param {string} args.memberUserId     the bot's user ID
 * @param {Array} args.roles             guild roles
 * @returns {bigint}
 */
function computeChannelPermissions({ guildId, channel, memberRoleIds = [], memberUserId, roles = [] }) {
  const base = computeBasePermissions(guildId, memberRoleIds, roles);
  if (base === ALL_PERMISSIONS) return ALL_PERMISSIONS;

  let bits = base;
  const overwrites = channel?.permission_overwrites || [];

  const everyone = overwrites.find((o) => o.id === guildId);
  if (everyone) {
    bits &= ~toBigInt(everyone.deny);
    bits |= toBigInt(everyone.allow);
  }

  // Role overwrites are accumulated first, then applied together.
  let roleAllow = 0n;
  let roleDeny = 0n;
  for (const overwrite of overwrites) {
    if (Number(overwrite.type) !== OVERWRITE_TYPE.ROLE) continue;
    if (overwrite.id === guildId) continue;
    if (!memberRoleIds.includes(overwrite.id)) continue;
    roleAllow |= toBigInt(overwrite.allow);
    roleDeny |= toBigInt(overwrite.deny);
  }
  bits &= ~roleDeny;
  bits |= roleAllow;

  // A member-specific overwrite wins over role overwrites.
  const member = overwrites.find(
    (o) => Number(o.type) === OVERWRITE_TYPE.MEMBER && o.id === memberUserId
  );
  if (member) {
    bits &= ~toBigInt(member.deny);
    bits |= toBigInt(member.allow);
  }

  return bits;
}

/**
 * Which of the required posting permissions are absent.
 * @returns {string[]} permission flag names, e.g. ['SEND_MESSAGES']
 */
function missingPermissions(bits, required = REQUIRED_CHANNEL_PERMISSIONS) {
  return required.filter((name) => !has(bits, name));
}

function canPost(bits) {
  return missingPermissions(bits).length === 0;
}

const FRIENDLY_NAMES = {
  VIEW_CHANNEL: 'View Channel',
  SEND_MESSAGES: 'Send Messages',
  EMBED_LINKS: 'Embed Links',
  ATTACH_FILES: 'Attach Files',
  ADMINISTRATOR: 'Administrator',
  SEND_MESSAGES_IN_THREADS: 'Send Messages in Threads',
};

function describePermissions(names) {
  return (names || []).map((n) => FRIENDLY_NAMES[n] || n);
}

module.exports = {
  ALL_PERMISSIONS,
  OVERWRITE_TYPE,
  toBigInt,
  has,
  computeBasePermissions,
  computeChannelPermissions,
  missingPermissions,
  canPost,
  describePermissions,
  FRIENDLY_NAMES,
};
