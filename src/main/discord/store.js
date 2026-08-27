// Persistence for the Discord integration.
//
// Three files live under <dataRoot>/org/integrations/ so that deleting all org
// data (dataStore.deleteAllData) removes the integration too, while bundled
// reference data is untouched:
//
//   discord.json          integration config (no secrets)
//   discord-secrets.enc   bot token, encrypted via the OS keychain
//   discord-delivery.json idempotency ledger for sent notifications
//
// The bot token is never written in plaintext and never returned to the renderer.

const fs = require('fs/promises');
const path = require('path');

const { CHANNEL_PURPOSES, EVENTS, STATUS } = require('./constants');
const { DiscordError, CODES } = require('./redact');

const CONFIG_VERSION = 1;
const DELIVERY_LIMIT = 500;
const DELIVERY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function nowIso() {
  return new Date().toISOString();
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    if (err instanceof SyntaxError) return fallback;
    throw err;
  }
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function emptyConfig() {
  return { version: CONFIG_VERSION, integrations: [] };
}

// Default channel mappings: every purpose present but unconfigured, so the UI can
// render the full list without inventing channel names.
function defaultChannels() {
  return CHANNEL_PURPOSES.map((p) => ({
    purpose: p.id,
    discord_channel_id: null,
    discord_channel_name: null,
    sensitivity: p.defaultSensitivity,
    enabled: false,
  }));
}

function defaultPreferences() {
  const prefs = {};
  for (const event of EVENTS) {
    prefs[event.id] = { enabled: event.defaultEnabled, purpose: event.purpose };
  }
  return prefs;
}

/**
 * @param {object} options
 * @param {string} options.dataRoot            root of the Coach Intel data directory
 * @param {object} options.secretStore         { isAvailable(), encrypt(str)->Buffer, decrypt(Buffer)->str }
 */
function createStore({ dataRoot, secretStore }) {
  const dir = path.join(dataRoot, 'org', 'integrations');
  const configPath = path.join(dir, 'discord.json');
  const secretsPath = path.join(dir, 'discord-secrets.enc');
  const deliveryPath = path.join(dir, 'discord-delivery.json');

  // ---------- Config ----------

  async function readConfig() {
    const raw = await readJson(configPath, emptyConfig());
    if (!raw || !Array.isArray(raw.integrations)) return emptyConfig();
    return raw;
  }

  async function writeConfig(config) {
    await writeJson(configPath, { ...config, version: CONFIG_VERSION });
    return config;
  }

  // One organization connects one Discord server today. The config is an array so
  // additional guilds can be added later without a schema migration.
  async function getIntegration() {
    const config = await readConfig();
    return config.integrations[0] || null;
  }

  async function requireIntegration() {
    const integration = await getIntegration();
    if (!integration || !integration.guild_id) {
      throw new DiscordError(CODES.NOT_CONNECTED);
    }
    return integration;
  }

  async function saveIntegration(patch) {
    const config = await readConfig();
    const existing = config.integrations[0] || null;
    const merged = {
      id: existing?.id || `di_${Date.now().toString(36)}`,
      organization_id: 'org',
      guild_id: null,
      guild_name: null,
      guild_icon: null,
      bot_installed: false,
      bot_user_id: null,
      bot_username: null,
      status: STATUS.NOT_CONNECTED,
      connected_by: null,
      connected_at: null,
      last_verified_at: null,
      last_error: null,
      channels: defaultChannels(),
      role_mappings: [],
      preferences: defaultPreferences(),
      ...existing,
      ...patch,
    };
    config.integrations[0] = merged;
    await writeConfig(config);
    return merged;
  }

  async function setStatus(status, lastError = null) {
    const existing = await getIntegration();
    if (!existing) return null;
    return saveIntegration({ status, last_error: lastError });
  }

  async function clearIntegration() {
    await writeConfig(emptyConfig());
    await clearSecret();
    await fs.rm(deliveryPath, { force: true });
  }

  // ---------- Channel mappings ----------

  async function saveChannels(mappings) {
    const integration = await requireIntegration();
    const byPurpose = new Map((mappings || []).map((m) => [m.purpose, m]));
    const channels = CHANNEL_PURPOSES.map((p) => {
      const incoming = byPurpose.get(p.id);
      const previous = integration.channels.find((c) => c.purpose === p.id);
      if (!incoming) return previous || { purpose: p.id, discord_channel_id: null, discord_channel_name: null, sensitivity: p.defaultSensitivity, enabled: false };
      return {
        purpose: p.id,
        discord_channel_id: incoming.discord_channel_id || null,
        discord_channel_name: incoming.discord_channel_name || null,
        sensitivity: incoming.sensitivity || p.defaultSensitivity,
        enabled: Boolean(incoming.enabled && incoming.discord_channel_id),
      };
    });
    return saveIntegration({ channels });
  }

  async function channelForPurpose(purpose) {
    const integration = await requireIntegration();
    const mapping = integration.channels.find((c) => c.purpose === purpose);
    if (!mapping || !mapping.enabled || !mapping.discord_channel_id) return null;
    return mapping;
  }

  // ---------- Notification preferences ----------

  async function savePreferences(preferences) {
    const integration = await requireIntegration();
    const next = { ...defaultPreferences() };
    for (const event of EVENTS) {
      const incoming = preferences?.[event.id];
      const previous = integration.preferences?.[event.id];
      const source = incoming || previous;
      if (!source) continue;
      next[event.id] = {
        enabled: Boolean(source.enabled),
        purpose: event.purpose,
      };
    }
    return saveIntegration({ preferences: next });
  }

  // ---------- Secrets ----------

  function assertEncryptionAvailable() {
    if (!secretStore || !secretStore.isAvailable()) {
      throw new DiscordError(
        CODES.UNKNOWN,
        'OS keychain encryption unavailable; refusing to store the bot token in plaintext'
      );
    }
  }

  async function setSecret(integrationId, botToken) {
    assertEncryptionAvailable();
    const payload = JSON.stringify({ [integrationId]: botToken });
    const encrypted = secretStore.encrypt(payload);
    await fs.mkdir(path.dirname(secretsPath), { recursive: true });
    await fs.writeFile(secretsPath, encrypted);
    // Owner read/write only.
    await fs.chmod(secretsPath, 0o600).catch(() => {});
  }

  async function getSecret(integrationId) {
    let encrypted;
    try {
      encrypted = await fs.readFile(secretsPath);
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
    assertEncryptionAvailable();
    try {
      const decoded = JSON.parse(secretStore.decrypt(encrypted));
      return decoded[integrationId] || null;
    } catch {
      // Keychain changed or file corrupt — treat as a credential that must be re-entered.
      throw new DiscordError(CODES.INVALID_TOKEN, 'stored bot token could not be decrypted');
    }
  }

  async function clearSecret() {
    await fs.rm(secretsPath, { force: true });
  }

  async function hasSecret() {
    try {
      await fs.access(secretsPath);
      return true;
    } catch {
      return false;
    }
  }

  // ---------- Idempotency ledger ----------

  // Uniqueness key is event_id + provider + destination, so a retry of the same
  // domain event never posts twice to the same channel.
  function deliveryKey({ eventId, provider = 'discord', destination }) {
    return `${eventId}|${provider}|${destination}`;
  }

  async function readDelivery() {
    const raw = await readJson(deliveryPath, { entries: [] });
    const cutoff = Date.now() - DELIVERY_TTL_MS;
    const entries = (raw.entries || []).filter((e) => Date.parse(e.at) >= cutoff);
    return { entries };
  }

  async function wasDelivered(key) {
    const { entries } = await readDelivery();
    return entries.some((e) => e.key === key);
  }

  async function markDelivered(key) {
    const { entries } = await readDelivery();
    if (entries.some((e) => e.key === key)) return false;
    entries.push({ key, at: nowIso() });
    const trimmed = entries.slice(-DELIVERY_LIMIT);
    await writeJson(deliveryPath, { entries: trimmed });
    return true;
  }

  return {
    paths: { dir, configPath, secretsPath, deliveryPath },
    readConfig,
    getIntegration,
    requireIntegration,
    saveIntegration,
    setStatus,
    clearIntegration,
    saveChannels,
    channelForPurpose,
    savePreferences,
    setSecret,
    getSecret,
    clearSecret,
    hasSecret,
    deliveryKey,
    wasDelivered,
    markDelivered,
    defaultChannels,
    defaultPreferences,
  };
}

// Electron's safeStorage is keychain-backed on macOS. Required lazily so the
// module can be unit-tested outside an Electron runtime.
function electronSecretStore() {
  const { safeStorage } = require('electron');
  return {
    isAvailable: () => safeStorage.isEncryptionAvailable(),
    encrypt: (str) => safeStorage.encryptString(str),
    decrypt: (buf) => safeStorage.decryptString(buf),
  };
}

module.exports = { createStore, electronSecretStore, CONFIG_VERSION, defaultChannels, defaultPreferences };
