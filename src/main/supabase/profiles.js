// Roster of everyone who has signed in, and role management.
// RLS on the `profiles` table (see scripts/supabase/schema.sql) is what actually
// enforces who can read the roster or change a role — this module just calls the
// table through the signed-in user's own session.

const { isProtectedPerson } = require('../access');

function createProfilesService({ client }) {
  function requireClient() {
    if (!client) throw new Error('Supabase is not configured yet — see src/main/supabase/config.js');
    return client;
  }

  async function ensure() {
    const c = requireClient();
    const { data, error } = await c.rpc('ensure_profile');
    if (error) {
      const msg = String(error.message || '');
      if (error.code === 'PGRST202' || error.code === '42883' || /ensure_profile/i.test(msg)) return null;
      console.warn('[profiles] ensure_profile', msg);
      return null;
    }
    return data || null;
  }

  async function list() {
    const c = requireClient();
    const { data: sessionData } = await c.auth.getSession();
    const userId = sessionData?.session?.user?.id || null;

    const load = async () => {
      const { data, error } = await c.from('profiles').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      const profiles = data || [];
      const me = userId ? profiles.find((p) => p.id === userId) || null : null;
      return { profiles, me };
    };

    let listed = await load();
    if (userId && !listed.me) {
      await ensure();
      listed = await load();
    }
    let teamIds = [];
    let linkedNames = [];
    if (userId) {
      const { data, error } = await c.from('members').select('team_id, gamertag, name, photo').eq('user_id', userId);
      if (!error) {
        teamIds = [...new Set((data || []).map((row) => row.team_id).filter(Boolean))];
        linkedNames = [...new Set((data || []).flatMap((row) => [row.gamertag, row.name]).filter(Boolean))];
        const linkedPhoto = (data || []).find((row) => row.photo)?.photo;
        if (listed.me && !listed.me.photo && linkedPhoto) {
          listed.me = { ...listed.me, photo: linkedPhoto };
        }
      }
    }
    return { ...listed, teamIds, linkedNames };
  }

  async function updateMyProfile({ displayName, title }) {
    const c = requireClient();
    const { data, error } = await c.rpc('update_my_profile', {
      new_name: String(displayName || '').trim(),
      new_title: String(title || '').trim(),
    });
    if (error) throw error;
    if (data && data.ok === false) throw new Error(data.error || 'Could not save profile.');
    return data;
  }

  async function updateMyPhoto(photo) {
    const c = requireClient();
    const { data, error } = await c.rpc('update_my_photo', { new_photo: String(photo || '').trim() });
    if (error) throw error;
    if (data && data.ok === false) throw new Error(data.error || 'Could not save photo.');
    return data;
  }

  async function updateRole(userId, role) {
    const c = requireClient();
    const { data: row } = await c.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (isProtectedPerson(row)) throw new Error('Super Admin access cannot be changed.');
    let next = role;
    if (next === 'player') next = 'user';
    const { error } = await c.from('profiles').update({ role: next }).eq('id', userId);
    if (error && next === 'user') {
      const retry = await c.from('profiles').update({ role: 'member' }).eq('id', userId);
      if (retry.error) throw retry.error;
      return true;
    }
    if (error) throw error;
    return true;
  }

  return { list, updateRole, ensure, updateMyProfile, updateMyPhoto };
}

module.exports = { createProfilesService };
