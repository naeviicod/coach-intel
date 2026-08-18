// Public surface of the Discord integration.
//
// Everything the rest of Coach Intel touches goes through this facade: IPC handlers
// call these methods, and domain code publishes events via `publish`. No other
// module imports the Discord client, store, or REST endpoints directly.

const {
  CHANNEL_PURPOSES,
  EVENTS,
  EVENT_GROUPS,
  SENSITIVITY_LABELS,
  STATUS,
  STATUS_LABELS,
  AUDIT_ACTIONS,
} = require('./constants');
const { DiscordError, CODES, safeCall } = require('./redact');
const { DiscordClient } = require('./client');
const { createStore, electronSecretStore } = require('./store');
const { createAuditLog } = require('./audit');
const guildApi = require('./guild');
const messages = require('./messages');
const { DiscordProvider, InAppProvider, NotificationRouter, OUTCOME } = require('./notifications');
const notificationStore = require('../notificationStore');

// A pasted token is held in memory only until the admin picks a server.
const PENDING_TTL_MS = 10 * 60 * 1000;

let service = null;

function createService({ dataRoot, secretStore, getOrgName = async () => null, fetchImpl, sleep }) {
  const store = createStore({ dataRoot, secretStore });
  const audit = createAuditLog({ dataRoot });

  let pending = null;

  const client = new DiscordClient({
    fetchImpl,
    sleep,
    getToken: async () => {
      const integration = await store.getIntegration();
      if (!integration) return null;
      return store.getSecret(integration.id);
    },
  });

  const provider = new DiscordProvider({ client, store, audit });
  const inAppProvider = new InAppProvider({ store: notificationStore });
  const router = new NotificationRouter({ providers: [provider, inAppProvider] });

  async function orgName() {
    try {
      return await getOrgName();
    } catch {
      return null;
    }
  }

  // Config contains no secrets, but strip defensively before it crosses IPC.
  function sanitize(integration) {
    if (!integration) return null;
    const { ...safe } = integration;
    delete safe.bot_token;
    delete safe.token;
    return safe;
  }

  // ---------- Read ----------

  async function getState() {
    const integration = await store.getIntegration();
    const hasCredential = await store.hasSecret();
    return {
      connected: Boolean(integration?.guild_id && hasCredential),
      hasCredential,
      status: integration?.status || STATUS.NOT_CONNECTED,
      statusLabel: STATUS_LABELS[integration?.status || STATUS.NOT_CONNECTED],
      integration: sanitize(integration),
      catalog: {
        purposes: CHANNEL_PURPOSES,
        events: EVENTS,
        eventGroups: EVENT_GROUPS,
        sensitivities: SENSITIVITY_LABELS,
        statuses: STATUS_LABELS,
      },
      encryptionAvailable: Boolean(secretStore && secretStore.isAvailable()),
    };
  }

  // ---------- Connect ----------

  // Step 1: validate the pasted bot token and list the servers it has been invited to.
  async function beginConnect({ botToken }) {
    const token = String(botToken || '').trim();
    if (!token) throw new DiscordError(CODES.INVALID_TOKEN, 'empty token');
    if (!secretStore || !secretStore.isAvailable()) {
      throw new DiscordError(CODES.UNKNOWN, 'OS keychain unavailable; cannot store the bot token securely');
    }

    const bot = await guildApi.validateToken(client, token);
    const guilds = await guildApi.listGuilds(client, token);
    pending = { token, bot, guilds, at: Date.now() };
    return { bot, guilds };
  }

  // Step 2: bind the chosen server to this organization and persist the token.
  async function completeConnect({ guildId, actor }) {
    if (!pending || Date.now() - pending.at > PENDING_TTL_MS) {
      pending = null;
      throw new DiscordError(CODES.NOT_CONNECTED, 'connection attempt expired; paste the bot token again');
    }
    const guild = pending.guilds.find((g) => g.id === guildId);
    if (!guild) throw new DiscordError(CODES.GUILD_NOT_FOUND, 'server not in the bot guild list');

    const integration = await store.saveIntegration({
      guild_id: guild.id,
      guild_name: guild.name,
      guild_icon: guild.icon,
      bot_installed: true,
      bot_user_id: pending.bot.id,
      bot_username: pending.bot.username,
      status: STATUS.CONNECTED,
      connected_by: actor || 'Coach',
      connected_at: new Date().toISOString(),
      last_verified_at: new Date().toISOString(),
      last_error: null,
    });

    await store.setSecret(integration.id, pending.token);
    pending = null;
    client.invalidate();

    await audit.record({
      action: AUDIT_ACTIONS.GUILD_CONNECTED,
      actor: actor || 'Coach',
      organization: await orgName(),
      target: guild.name,
      result: 'SUCCESS',
    });

    return sanitize(integration);
  }

  function cancelConnect() {
    pending = null;
    return true;
  }

  // ---------- Channels ----------

  async function listChannels({ refresh = false } = {}) {
    const integration = await store.requireIntegration();
    if (refresh) client.invalidate(`GET /guilds/${integration.guild_id}`);
    return guildApi.listChannels(client, integration.guild_id, integration.bot_user_id);
  }

  async function listRoles() {
    const integration = await store.requireIntegration();
    const roles = await guildApi.fetchRoles(client, integration.guild_id);
    return roles
      .filter((r) => r.name !== '@everyone')
      .map((r) => ({ id: r.id, name: r.name, color: r.color, position: r.position }))
      .sort((a, b) => b.position - a.position);
  }

  // Validates each requested channel before saving, so a mapping is never stored
  // pointing at a channel the bot cannot use. One bad channel does not block the rest.
  async function saveChannels({ mappings, actor }) {
    const integration = await store.requireIntegration();
    const available = await guildApi.listChannels(client, integration.guild_id, integration.bot_user_id);
    const byId = new Map(available.map((c) => [c.id, c]));

    const validated = [];
    const rejected = [];
    for (const mapping of mappings || []) {
      if (!mapping.discord_channel_id) {
        validated.push({ ...mapping, discord_channel_name: null, enabled: false });
        continue;
      }
      const live = byId.get(mapping.discord_channel_id);
      if (!live) {
        rejected.push({ purpose: mapping.purpose, reason: 'Channel no longer exists', missing: [] });
        validated.push({ ...mapping, discord_channel_id: null, discord_channel_name: null, enabled: false });
        continue;
      }
      if (!live.canPost) {
        rejected.push({ purpose: mapping.purpose, reason: 'Missing permissions', missing: live.missing });
        validated.push({ ...mapping, discord_channel_name: live.name, enabled: false });
        continue;
      }
      validated.push({ ...mapping, discord_channel_name: live.name });
    }

    const saved = await store.saveChannels(validated);
    await audit.record({
      action: AUDIT_ACTIONS.CHANNEL_MAPPING_CHANGED,
      actor: actor || 'Coach',
      organization: await orgName(),
      target: `${validated.filter((v) => v.enabled).length} channel(s)`,
      result: rejected.length ? 'SKIPPED' : 'SUCCESS',
      detail: rejected.length ? { rejected } : null,
    });

    return { integration: sanitize(saved), rejected };
  }

  // ---------- Preferences ----------

  async function savePreferences({ preferences, actor }) {
    const saved = await store.savePreferences(preferences);
    await audit.record({
      action: AUDIT_ACTIONS.PREFERENCES_CHANGED,
      actor: actor || 'Coach',
      organization: await orgName(),
      target: `${Object.values(saved.preferences).filter((p) => p.enabled).length} event(s) enabled`,
      result: 'SUCCESS',
    });
    return sanitize(saved);
  }

  // ---------- Test ----------

  async function test({ purpose = 'general', actor } = {}) {
    const integration = await store.requireIntegration();
    const mapping = (integration.channels || []).find((c) => c.purpose === purpose && c.enabled && c.discord_channel_id)
      || (integration.channels || []).find((c) => c.enabled && c.discord_channel_id);

    if (!mapping) throw new DiscordError(CODES.NOT_CONFIGURED);

    const body = messages.testMessage({
      orgName: await orgName(),
      guildName: integration.guild_name,
      channelName: mapping.discord_channel_name,
    });

    try {
      await client.post(`/channels/${mapping.discord_channel_id}/messages`, body);
    } catch (err) {
      await audit.record({
        action: AUDIT_ACTIONS.TEST_MESSAGE_SENT,
        actor: actor || 'Coach',
        organization: await orgName(),
        target: `#${mapping.discord_channel_name}`,
        result: 'FAILURE',
        detail: { code: err.code || CODES.UNKNOWN },
      });
      throw err;
    }

    await audit.record({
      action: AUDIT_ACTIONS.TEST_MESSAGE_SENT,
      actor: actor || 'Coach',
      organization: await orgName(),
      target: `#${mapping.discord_channel_name}`,
      result: 'SUCCESS',
    });

    return { channel: mapping.discord_channel_name };
  }

  // ---------- Share ----------

  async function share({ purpose, spec, actor }) {
    provider.orgName = await orgName();
    return provider.share({ purpose, spec, actor });
  }

  // ---------- Events ----------

  async function publish(eventId, payload = {}) {
    provider.orgName = await orgName();
    return router.publish(eventId, payload);
  }

  // ---------- Health ----------

  async function verify({ actor } = {}) {
    const integration = await store.requireIntegration();
    client.invalidate(`GET /guilds/${integration.guild_id}`);
    const report = await guildApi.verifyHealth(client, integration);

    const firstProblem =
      report.guild.error ||
      report.bot.error ||
      report.channels.find((c) => !c.ok)?.error ||
      null;

    await store.saveIntegration({
      status: report.status,
      last_verified_at: report.verified_at,
      last_error: firstProblem,
      bot_installed: report.bot.ok,
    });

    await audit.record({
      action: AUDIT_ACTIONS.HEALTH_VERIFIED,
      actor: actor || 'Coach',
      organization: await orgName(),
      target: integration.guild_name,
      result: report.status === STATUS.CONNECTED ? 'SUCCESS' : 'FAILURE',
      detail: firstProblem ? { problem: firstProblem } : null,
    });

    return report;
  }

  // ---------- Disconnect ----------

  // Removes every Discord mapping, credential, and pending job. Coach Intel teams,
  // players, Strats, Intel, matches, and reports are untouched.
  async function disconnect({ actor } = {}) {
    const integration = await store.getIntegration();
    const guildName = integration?.guild_name || null;
    await store.clearIntegration();
    client.invalidate();
    pending = null;

    await audit.record({
      action: AUDIT_ACTIONS.GUILD_DISCONNECTED,
      actor: actor || 'Coach',
      organization: await orgName(),
      target: guildName,
      result: 'SUCCESS',
    });

    return { disconnected: true };
  }

  async function auditRecent({ limit = 50 } = {}) {
    return audit.recent(limit);
  }

  // ---------- Team Chat ----------
  //
  // The one purpose Coach Intel actually reads from (see constants.js) — every
  // other channel mapping stays post-only, matching what the Integrations page
  // tells the coach. Requires the bot's "Message Content Intent" to be turned
  // on in the Discord Developer Portal, or message content comes back empty.

  function chatChannelMapping(integration) {
    return (integration.channels || []).find((c) => c.purpose === 'team_chat' && c.enabled && c.discord_channel_id) || null;
  }

  async function listRecentMessages() {
    const integration = await store.requireIntegration();
    const mapping = chatChannelMapping(integration);
    if (!mapping) throw new DiscordError(CODES.NOT_CONFIGURED);
    const rows = await client.get(`/channels/${mapping.discord_channel_id}/messages?limit=50`);
    return {
      channelName: mapping.discord_channel_name,
      messages: (rows || [])
        .map((m) => ({
          id: m.id,
          author: m.author?.global_name || m.author?.username || 'Unknown',
          avatar: m.author?.avatar
            ? `https://cdn.discordapp.com/avatars/${m.author.id}/${m.author.avatar}.png?size=64`
            : null,
          content: m.content || (m.embeds?.length ? '[embed]' : m.attachments?.length ? '[attachment]' : ''),
          timestamp: m.timestamp,
        }))
        .reverse(),
    };
  }

  async function sendChatMessage({ content, actor } = {}) {
    const integration = await store.requireIntegration();
    const mapping = chatChannelMapping(integration);
    if (!mapping) throw new DiscordError(CODES.NOT_CONFIGURED);
    const text = String(content || '').trim().slice(0, 2000);
    if (!text) throw new Error('Message is empty');
    await client.post(`/channels/${mapping.discord_channel_id}/messages`, { content: text });
    await audit.record({
      action: AUDIT_ACTIONS.SHARED,
      actor: actor || 'Coach',
      organization: await orgName(),
      target: `team chat → #${mapping.discord_channel_name}`,
      result: 'SUCCESS',
    });
    return true;
  }

  return {
    store,
    audit,
    client,
    provider,
    router,
    getState,
    beginConnect,
    completeConnect,
    cancelConnect,
    listChannels,
    listRoles,
    saveChannels,
    savePreferences,
    test,
    share,
    publish,
    verify,
    disconnect,
    auditRecent,
    listRecentMessages,
    sendChatMessage,
    botInviteUrl: guildApi.botInviteUrl,
  };
}

// ---------- Singleton wiring for the Electron main process ----------

function init({ dataRoot, getOrgName }) {
  service = createService({
    dataRoot,
    secretStore: electronSecretStore(),
    getOrgName,
  });
  return service;
}

function get() {
  if (!service) throw new Error('Discord service has not been initialized');
  return service;
}

module.exports = {
  createService,
  init,
  get,
  safeCall,
  OUTCOME,
  messages,
};
