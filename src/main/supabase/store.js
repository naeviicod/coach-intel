// Persistence for the Supabase auth session.
//
// The session (access + refresh token) is encrypted via the OS keychain, the same
// way the Discord bot token is handled in ../discord/store.js — it is never
// written in plaintext and never returned to the renderer directly.
//
// Shape matches the storage adapter supabase-js expects: getItem/setItem/removeItem.

const fs = require('fs/promises');
const path = require('path');

function createSessionStore({ dataRoot, secretStore, allowInsecureStorage = false }) {
  const dir = path.join(dataRoot, 'org', 'integrations');
  const encryptedPath = path.join(dir, 'supabase-session.enc');
  // Used only when the OS keychain is unavailable (e.g. an unsigned dev build
  // where macOS won't grant Keychain access) — a distinct filename so an
  // encrypted and a plaintext session file are never mistaken for each other.
  const plaintextPath = path.join(dir, 'supabase-session.insecure.json');

  let warnedNoKeychain = false;
  function keychainAvailable() {
    const available = Boolean(secretStore && secretStore.isAvailable());
    if (!available && !warnedNoKeychain) {
      warnedNoKeychain = true;
      console.warn(allowInsecureStorage
        ? '[supabase] OS keychain unavailable — an unsigned development build will use a permissions-locked session file.'
        : '[supabase] OS keychain unavailable — production session persistence is disabled.');
    }
    return available;
  }

  async function readAll() {
    if (keychainAvailable()) {
      let encrypted;
      try {
        encrypted = await fs.readFile(encryptedPath);
      } catch (err) {
        if (err.code === 'ENOENT') return {};
        throw err;
      }
      try {
        return JSON.parse(secretStore.decrypt(encrypted));
      } catch {
        // Keychain changed or file corrupt — treat as a session that must be re-created.
        return {};
      }
    }
    if (!allowInsecureStorage) return {};
    try {
      return JSON.parse(await fs.readFile(plaintextPath, 'utf-8'));
    } catch (err) {
      if (err.code === 'ENOENT') return {};
      return {};
    }
  }

  async function writeAll(data) {
    await fs.mkdir(dir, { recursive: true });
    if (keychainAvailable()) {
      await fs.writeFile(encryptedPath, secretStore.encrypt(JSON.stringify(data)));
      await fs.chmod(encryptedPath, 0o600).catch(() => {});
      return;
    }
    if (!allowInsecureStorage) return;
    await fs.writeFile(plaintextPath, JSON.stringify(data));
    await fs.chmod(plaintextPath, 0o600).catch(() => {});
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
