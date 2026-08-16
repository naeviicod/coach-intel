// Roster of everyone who has signed in, and role management.
// RLS on the `profiles` table (see scripts/supabase/schema.sql) is what actually
// enforces who can read the roster or change a role — this module just calls the
// table through the signed-in user's own session.

function createProfilesService({ client }) {
  function requireClient() {
    if (!client) throw new Error('Supabase is not configured yet — see src/main/supabase/config.js');
    return client;
  }

  async function list() {
    const c = requireClient();
    const { data: sessionData } = await c.auth.getSession();
    const userId = sessionData?.session?.user?.id || null;

    const { data, error } = await c.from('profiles').select('*').order('created_at', { ascending: true });
    if (error) throw error;

    const profiles = data || [];
    const me = userId ? profiles.find((p) => p.id === userId) || null : null;
    return { profiles, me };
  }

  async function updateRole(userId, role) {
    const c = requireClient();
    const { error } = await c.from('profiles').update({ role }).eq('id', userId);
    if (error) throw error;
    return true;
  }

  return { list, updateRole };
}

module.exports = { createProfilesService };
