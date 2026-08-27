// Public surface of the Supabase integration (team sign-in via Discord).
//
// Mirrors ../discord/index.js: IPC handlers in main.js call these methods, no
// other module talks to the Supabase client directly.

const { createSessionStore, electronSecretStore } = require('./store');
const { createSupabaseClient } = require('./client');
const { createAuthService } = require('./auth');
const { createProfilesService } = require('./profiles');
const { createTeamsService } = require('./teams');
const { createInviteService } = require('./invites');
const { createRecordsService } = require('./records');
const { createFeedbackService } = require('./feedback');
const { createAssetsService } = require('./assets');

let service = null;

function createService({ dataRoot, secretStore }) {
  const sessionStore = createSessionStore({
    dataRoot,
    secretStore,
    // Plaintext persistence is a development-only escape hatch. Packaged builds
    // keep auth material in Keychain or require the member to sign in again.
    allowInsecureStorage: !app.isPackaged,
  });
  const client = createSupabaseClient(sessionStore);
  const auth = createAuthService({ client });
  const profiles = createProfilesService({ client });
  const teams = createTeamsService({ client });
  const invites = createInviteService({ client, dataRoot });
  const records = createRecordsService({ client });
  const feedback = createFeedbackService({ client });
  const assets = createAssetsService({ client });

  async function getState() {
    if (!client) return { configured: false, session: null };
    try {
      const session = await auth.getSession();
      return { configured: true, session };
    } catch (err) {
      console.warn('[supabase] getState failed:', err?.message || err);
      return { configured: true, session: null };
    }
  }

  // Live roster + shared docs: any teammate's write refreshes every open window.
  function subscribeRealtime(onChange) {
    if (!client) return () => {};
    const channel = client
      .channel('org-data')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => onChange('teams'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => onChange('members'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => onChange('profiles'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_docs' }, () => onChange('shared_docs'))
      .subscribe();
    return () => client.removeChannel(channel);
  }

  return {
    configured: Boolean(client),
    client,
    getState,
    listProfiles: profiles.list,
    updateProfileRole: profiles.updateRole,
    ensureProfile: profiles.ensure,
    updateMyProfile: profiles.updateMyProfile,
    updateMyPhoto: profiles.updateMyPhoto,
    submitFeedback: feedback.submit,
    uploadAsset: assets.upload,
    downloadAsset: assets.download,
    subscribeRealtime,
    ...teams,
    ...auth,
    ...invites,
    ...records,
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
