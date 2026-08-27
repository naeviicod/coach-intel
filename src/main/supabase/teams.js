// Teams & roster, backed by Supabase instead of local JSON — the first slice of
// app data to move off per-machine files so every signed-in teammate sees the
// same roster. Same function names/shapes as dataStore.js's team/member
// section, so the IPC handlers in main.js are a drop-in swap.

const { assertNotProtectedPerson } = require('../access');

function nextId(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function raise(error, fallback) {
  const msg =
    (error && (error.message || error.details || error.hint)) ||
    fallback ||
    'Request failed';
  const err = new Error(msg);
  if (error && error.code) err.code = error.code;
  throw err;
}

function accentHex(value) {
  const m = String(value || '').trim().match(/^#?([0-9a-fA-F]{6})$/);
  return m ? `#${m[1].toLowerCase()}` : null;
}

function missingAccentColumn(error) {
  const code = error && error.code;
  const msg = String((error && (error.message || error.details)) || '');
  return code === '42703' || code === 'PGRST204' || /accent/i.test(msg);
}

function rlsBlocked(error) {
  const code = error && error.code;
  const msg = String((error && (error.message || error.details)) || '');
  return code === '42501' || /row-level security/i.test(msg);
}

function persistHandles(member) {
  const handles = member?.handles && typeof member.handles === 'object' ? { ...member.handles } : {};
  if (member?.disabled === true) handles._disabled = '1';
  else if (member?.disabled === false) delete handles._disabled;
  else if (String(handles._disabled || '') !== '1') delete handles._disabled;
  return handles;
}

async function withTimeout(promise, ms, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

const WRITE_TIMEOUT_MS = 6000;

function createTeamsService({ client }) {
  function requireClient() {
    if (!client) throw new Error('Supabase is not configured yet — see src/main/supabase/config.js');
    return client;
  }

  async function getTeams() {
    const c = requireClient();
    const { data, error } = await c.from('teams').select('*').order('created_at', { ascending: true });
    if (error) raise(error);
    return data || [];
  }

  async function getTeam(teamId) {
    const c = requireClient();
    const { data, error } = await c.from('teams').select('*').eq('id', teamId).maybeSingle();
    if (error) raise(error);
    return data;
  }

  async function saveTeam(team) {
    const c = requireClient();
    const id = team.id || slugify(team.name) || nextId('team');
    const row = {
      id,
      name: team.name,
      tag: team.tag ?? null,
      logo: team.logo ?? null,
      updated_at: new Date().toISOString(),
    };
    const accent = accentHex(team.accent);
    if (accent) row.accent = accent;

    const write = async (payload) => {
      if (team.id) {
        const patch = {
          name: payload.name,
          tag: payload.tag,
          logo: payload.logo,
          updated_at: payload.updated_at,
        };
        if (payload.accent) patch.accent = payload.accent;
        const { data: updated, error: updateError } = await c
          .from('teams')
          .update(patch)
          .eq('id', id)
          .select()
          .maybeSingle();
        if (updateError) raise(updateError, 'Could not save team.');
        if (updated) return updated;
      }

      const { data, error } = await c.from('teams').upsert(payload).select().single();
      if (error) raise(error, 'Could not save team.');
      return data;
    };

    try {
      return await withTimeout(write(row), WRITE_TIMEOUT_MS, 'Saving the team');
    } catch (err) {
      if (accent && missingAccentColumn(err)) {
        delete row.accent;
        return await withTimeout(write(row), WRITE_TIMEOUT_MS, 'Saving the team');
      }
      if (rlsBlocked(err)) {
        await c.rpc('ensure_profile');
        return await withTimeout(write(row), WRITE_TIMEOUT_MS, 'Saving the team');
      }
      throw err;
    }
  }

  async function syncAccent(accent) {
    const color = accentHex(accent);
    if (!color) return false;
    const c = requireClient();
    const { error } = await withTimeout(
      c.from('teams').update({ accent: color, updated_at: new Date().toISOString() }).not('id', 'is', null),
      WRITE_TIMEOUT_MS,
      'Saving highlight color'
    );
    if (error) {
      if (missingAccentColumn(error)) return false;
      raise(error, 'Could not save highlight color.');
    }
    return true;
  }

  async function deleteTeam(teamId) {
    const c = requireClient();
    const { error } = await c.from('teams').delete().eq('id', teamId);
    if (error) raise(error);
    return true;
  }

  async function attachLinks(members) {
    const list = members || [];
    const ids = [...new Set(list.map((m) => m.user_id).filter(Boolean))];
    if (!ids.length) return list.map((m) => ({ ...m, linked: null }));
    const c = requireClient();
    const { data, error } = await c
      .from('profiles')
      .select('id, discord_username, avatar_url, role')
      .in('id', ids);
    if (error) return list.map((m) => ({ ...m, linked: m.user_id ? { id: m.user_id } : null }));
    const byId = new Map((data || []).map((row) => [row.id, row]));
    return list.map((m) => ({ ...m, linked: m.user_id ? byId.get(m.user_id) || { id: m.user_id } : null }));
  }

  async function getMembers(teamId) {
    const c = requireClient();
    const { data, error } = await c.from('members').select('*').eq('team_id', teamId).order('gamertag', { ascending: true });
    if (error) raise(error);
    return attachLinks(data || []);
  }

  async function getMember(teamId, memberId) {
    const c = requireClient();
    const { data, error } = await c.from('members').select('*').eq('team_id', teamId).eq('id', memberId).maybeSingle();
    if (error) raise(error);
    if (!data) return null;
    const [linked] = await attachLinks([data]);
    return linked;
  }

  async function saveMember(teamId, member) {
    const c = requireClient();
    const id = member.id || slugify(member.gamertag) || nextId('member');
    const existing = await getMember(teamId, id).catch(() => null);
    const row = {
      id,
      team_id: teamId,
      gamertag: member.gamertag,
      name: member.name || member.gamertag,
      role: member.role || 'Flex',
      aliases: member.aliases || [],
      photo: member.photo ?? null,
      slot: member.slot === 'bench' || member.slot === 'staff' || member.slot === 'fa' ? member.slot : 'starter',
      title: member.title || null,
      handles: persistHandles(member),
      updated_at: new Date().toISOString(),
    };
    const userId = member.user_id !== undefined ? member.user_id : existing?.user_id || null;
    if (userId) row.user_id = userId;

    const write = () => c.from('members').upsert(row).select().single();
    let { data, error } = await write();
    if (error && rlsBlocked(error)) {
      await c.rpc('ensure_profile');
      ({ data, error } = await write());
    }
    if (error && rlsBlocked(error)) {
      const err = new Error(
        'Could not save this player to the shared roster. Your account needs an owner, admin, or coach role.'
      );
      err.code = error.code;
      throw err;
    }
    if (error) raise(error);
    return data;
  }

  async function deleteMember(teamId, memberId) {
    const existing = await getMember(teamId, memberId);
    assertNotProtectedPerson(existing, 'Super Admin cannot be removed from the roster.');
    const c = requireClient();
    const { error } = await c.from('members').delete().eq('team_id', teamId).eq('id', memberId);
    if (error) raise(error);
    return true;
  }

  async function transferMember(fromTeamId, toTeamId, memberId, { slot } = {}) {
    const existing = await getMember(fromTeamId, memberId);
    assertNotProtectedPerson(existing, 'Super Admin cannot be moved off the roster.');
    const c = requireClient();
    if (!fromTeamId || !toTeamId || fromTeamId === toTeamId) {
      throw new Error('Pick a different team to transfer to.');
    }
    const patch = {
      team_id: toTeamId,
      updated_at: new Date().toISOString(),
      ...(slot === 'bench' || slot === 'staff' || slot === 'starter' || slot === 'fa' ? { slot } : {}),
    };
    const { data, error } = await c
      .from('members')
      .update(patch)
      .eq('id', memberId)
      .eq('team_id', fromTeamId)
      .select()
      .maybeSingle();
    if (error) raise(error, 'Could not transfer that player.');
    let row = data;
    if (!row) row = await getMember(toTeamId, memberId);
    if (!row) {
      const leftover = await getMember(fromTeamId, memberId);
      if (leftover) {
        row = await saveMember(toTeamId, { ...leftover, id: memberId, slot: patch.slot || leftover.slot });
      }
    }
    if (!row) throw new Error('Could not move that player. They may already be on another team.');
    await c
      .from('invites')
      .update({ team_id: toTeamId })
      .eq('member_id', memberId)
      .is('accepted_at', null);
    return row;
  }

  return { getTeams, getTeam, saveTeam, syncAccent, deleteTeam, getMembers, getMember, saveMember, deleteMember, transferMember };
}

module.exports = { createTeamsService };
