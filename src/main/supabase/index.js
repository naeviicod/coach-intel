// Public surface of the Supabase integration (team sign-in via Discord).
//
// Mirrors ../discord/index.js: IPC handlers in main.js call these methods, no
// other module talks to the Supabase client directly.

const { createSessionStore, electronSecretStore } = require('./store');
const { createSupabaseClient, isConfigured } = require('./client');
const { createAuthService } = require('./auth');
const { createProfilesService } = require('./profiles');

let service = null;

function createService({ dataRoot, secretStore }) {
  const sessionStore = createSessionStore({ dataRoot, secretStore });
  const client = createSupabaseClient(sessionStore);
  const auth = createAuthService({ client });
  const profiles = createProfilesService({ client });

  async function getState() {
    const session = await auth.getSession();
    return { configured: isConfigured(), session };
  }

  return {
    configured: isConfigured(),
    client,
    getState,
    listProfiles: profiles.list,
    updateProfileRole: profiles.updateRole,
    ...auth,
  };
}

function init({ dataRoot }) {
  service = createService({ dataRoot, secretStore: electronSecretStore() });
  return service;
}

function get() {
  if (!service) throw new Error('Supabase service has not been initialized');
  return service;
}

module.exports = { createService, init, get };
