// Persistence for the Supabase auth session.
//
// The session (access + refresh token) is encrypted via the OS keychain, the same
// way the Discord bot token is handled in ../discord/store.js — it is never
// written in plaintext and never returned to the renderer directly.
//
// Shape matches the storage adapter supabase-js expects: getItem/setItem/removeItem.

const fs = require('fs/promises');
const path = require('path');

function createSessionStore({ dataRoot, secretStore }) {
  const dir = path.join(dataRoot, 'org', 'integrations');
  const filePath = path.join(dir, 'supabase-session.enc');

  function assertEncryptionAvailable() {
    if (!secretStore || !secretStore.isAvailable()) {
      throw new Error('OS keychain encryption unavailable; refusing to store the session in plaintext');
    }
  }

  async function readAll() {
    let encrypted;
    try {
      encrypted = await fs.readFile(filePath);
    } catch (err) {
      if (err.code === 'ENOENT') return {};
      throw err;
    }
    assertEncryptionAvailable();
    try {
      return JSON.parse(secretStore.decrypt(encrypted));
    } catch {
      // Keychain changed or file corrupt — treat as a session that must be re-created.
      return {};
    }
  }

  async function writeAll(data) {
    assertEncryptionAvailable();
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, secretStore.encrypt(JSON.stringify(data)));
    await fs.chmod(filePath, 0o600).catch(() => {});
  }

  return {
    async getItem(key) {
      const all = await readAll();
      return all[key] ?? null;
    },
    async setItem(key, value) {
      const all = await readAll();
      all[key] = value;
      await writeAll(all);
    },
    async removeItem(key) {
      const all = await readAll();
      if (!(key in all)) return;
      delete all[key];
      await writeAll(all);
    },
  };
}

// Electron's safeStorage is keychain-backed on macOS. Required lazily so this
// module can be unit-tested outside an Electron runtime.
function electronSecretStore() {
  const { safeStorage } = require('electron');
  return {
    isAvailable: () => safeStorage.isEncryptionAvailable(),
    encrypt: (str) => safeStorage.encryptString(str),
    decrypt: (buf) => safeStorage.decryptString(buf),
  };
}

module.exports = { createSessionStore, electronSecretStore };
