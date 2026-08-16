// Reads Discord guild configuration: which servers the bot is in, which channels
// it can actually post to, and whether an existing connection is still healthy.
//
// Coach Intel reads Discord roles and channels. It never creates, edits, or deletes
// anything in Discord other than posting messages to approved channels.

const {
  CHANNEL_PURPOSES,
  POSTABLE_CHANNEL_TYPES,
  STATUS,
  BOT_INVITE_PERMISSIONS,
  BOT_INVITE_SCOPES,
} = require('./constants');
const { DiscordError, CODES } = require('./redact');
const { computeChannelPermissions, missingPermissions, describePermissions } = require('./permissions');

// Validates a pasted bot token by asking Discord who it belongs to.
// The token is passed per-request so it is never persisted before it is known good.
async function validateToken(client, token) {
  const user = await client.request('GET', '/users/@me', { token });
  if (!user || !user.id) throw new DiscordError(CODES.INVALID_TOKEN, 'identity response missing id');
  if (user.bot !== true) {
    throw new DiscordError(CODES.INVALID_TOKEN, 'credential is not a bot token');
  }
  return { id: user.id, username: user.username, discriminator: user.discriminator, avatar: user.avatar };
}

// Servers the bot has been invited to. Only these can be connected — Coach Intel
// cannot add itself to a server, so Discord's own authorization gates this list.
async function listGuilds(client, token) {
  const guilds = await client.request('GET', '/users/@me/guilds', { token, cache: !token });
  return (guilds || []).map((g) => ({
    id: g.id,
    name: g.name,
    icon: g.icon || null,
  }));
}

async function fetchGuild(client, guildId) {
  return client.get(`/guilds/${guildId}`, { cache: true });
}

async function fetchRoles(client, guildId) {
  return (await client.get(`/guilds/${guildId}/roles`, { cache: true })) || [];
}

async function fetchMember(client, guildId, userId) {
  return client.get(`/guilds/${guildId}/members/${userId}`, { cache: true });
}

async function fetchBotMember(client, guildId, botUserId) {
  return fetchMember(client, guildId, botUserId);
}

async function fetchChannels(client, guildId) {
  return (await client.get(`/guilds/${guildId}/channels`, { cache: true })) || [];
}

/**
 * Channels the bot can see, each annotated with whether it can actually post.
 * Includes unusable channels so the UI can explain *why* one is unavailable
 * rather than silently hiding it.
 */
async function listChannels(client, guildId, botUserId) {
  const [channels, roles, member] = await Promise.all([
    fetchChannels(client, guildId),
    fetchRoles(client, guildId),
    fetchBotMember(client, guildId, botUserId),
  ]);

  const categories = new Map(
    channels.filter((c) => Number(c.type) === 4).map((c) => [c.id, c.name])
  );
  const memberRoleIds = member?.roles || [];

  return channels
    .filter((c) => POSTABLE_CHANNEL_TYPES.has(Number(c.type)))
    .map((channel) => {
      const bits = computeChannelPermissions({
        guildId,
        channel,
        memberRoleIds,
        memberUserId: botUserId,
        roles,
      });
      const missing = missingPermissions(bits);
      return {
        id: channel.id,
        name: channel.name,
        type: Number(channel.type),
        category: channel.parent_id ? categories.get(channel.parent_id) || null : null,
        position: Number(channel.position) || 0,
        canPost: missing.length === 0,
        missing: describePermissions(missing),
      };
    })
    .sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.position - b.position);
}

/**
 * Confirms a single channel is still usable. Called before a mapping is saved
 * (§16) and again during health verification (§39).
 */
async function validateChannel(client, guildId, botUserId, channelId) {
  const channels = await listChannels(client, guildId, botUserId);
  const match = channels.find((c) => c.id === channelId);
  if (!match) {
    return { ok: false, code: CODES.CHANNEL_NOT_FOUND, missing: [], name: null };
  }
  if (!match.canPost) {
    return { ok: false, code: CODES.MISSING_CHANNEL_PERMISSIONS, missing: match.missing, name: match.name };
  }
  return { ok: true, code: null, missing: [], name: match.name };
}

/**
 * Full health sweep for the Integration Health panel.
 * A single broken optional channel degrades status to NEEDS_ATTENTION but never
 * tears down the whole integration.
 */
async function verifyHealth(client, integration) {
  const report = {
    guild: { ok: false, name: integration.guild_name || null, error: null },
    bot: { ok: false, username: integration.bot_username || null, error: null },
    channels: [],
    status: STATUS.NEEDS_ATTENTION,
    verified_at: new Date().toISOString(),
  };

  // Reachability of the guild also tells us whether the bot is still a member.
  try {
    const guild = await fetchGuild(client, integration.guild_id);
    report.guild.ok = true;
    report.guild.name = guild?.name || integration.guild_name;
  } catch (err) {
    report.guild.error =
      err.code === CODES.CHANNEL_NOT_FOUND || err.code === CODES.MISSING_CHANNEL_PERMISSIONS
        ? 'Coach Intel bot is no longer in this server.'
        : err.userMessage || 'Server unreachable.';
    report.status = err.code === CODES.INVALID_TOKEN ? STATUS.PERMISSION_ERROR : STATUS.NEEDS_ATTENTION;
    return report;
  }

  try {
    const member = await fetchBotMember(client, integration.guild_id, integration.bot_user_id);
    report.bot.ok = Boolean(member);
    if (!member) report.bot.error = 'Coach Intel bot is not a member of this server.';
  } catch {
    report.bot.error = 'Coach Intel bot is no longer in this server.';
  }

  const configured = (integration.channels || []).filter((c) => c.enabled && c.discord_channel_id);
  let available = [];
  try {
    available = await listChannels(client, integration.guild_id, integration.bot_user_id);
  } catch (err) {
    report.status = STATUS.NEEDS_ATTENTION;
    report.channels = configured.map((mapping) => ({
      purpose: mapping.purpose,
      label: labelForPurpose(mapping.purpose),
      channel_id: mapping.discord_channel_id,
      channel_name: mapping.discord_channel_name,
      ok: false,
      missing: [],
      error: err.userMessage || 'Channels could not be listed.',
    }));
    return report;
  }

  const byId = new Map(available.map((c) => [c.id, c]));
  for (const mapping of configured) {
    const live = byId.get(mapping.discord_channel_id);
    if (!live) {
      report.channels.push({
        purpose: mapping.purpose,
        label: labelForPurpose(mapping.purpose),
        channel_id: mapping.discord_channel_id,
        channel_name: mapping.discord_channel_name,
        ok: false,
        missing: [],
        error: `Discord channel #${mapping.discord_channel_name || 'unknown'} no longer exists. Select another channel.`,
      });
      continue;
    }
    report.channels.push({
      purpose: mapping.purpose,
      label: labelForPurpose(mapping.purpose),
      channel_id: live.id,
      channel_name: live.name,
      ok: live.canPost,
      missing: live.missing,
      error: live.canPost ? null : `Missing in #${live.name}: ${live.missing.join(', ')}.`,
    });
  }

  const channelProblems = report.channels.filter((c) => !c.ok);
  if (!report.guild.ok || !report.bot.ok) report.status = STATUS.NEEDS_ATTENTION;
  else if (channelProblems.some((c) => c.missing.length)) report.status = STATUS.PERMISSION_ERROR;
  else if (channelProblems.length) report.status = STATUS.NEEDS_ATTENTION;
  else report.status = STATUS.CONNECTED;

  return report;
}

function labelForPurpose(purpose) {
  return CHANNEL_PURPOSES.find((p) => p.id === purpose)?.label || purpose;
}

// The URL an org admin opens to invite their own Coach Intel bot. Requests only
// view/send/embed — never Administrator.
function botInviteUrl(applicationId) {
  const params = new URLSearchParams({
    client_id: String(applicationId || ''),
    scope: BOT_INVITE_SCOPES.join(' '),
    permissions: BOT_INVITE_PERMISSIONS,
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

module.exports = {
  validateToken,
  listGuilds,
  fetchGuild,
  fetchRoles,
  fetchMember,
  fetchBotMember,
  fetchChannels,
  listChannels,
  validateChannel,
  verifyHealth,
  labelForPurpose,
  botInviteUrl,
};
