const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const ACCESS_ROLES = new Set(['owner', 'admin', 'user', 'team_leader', 'coach', 'analyst', 'creative']);
const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

function newToken() {
  return crypto.randomBytes(18).toString('base64url');
}

const INVITE_SITE = 'https://coach.championshipseries.eu';

function inviteUrl(token) {
  return `${INVITE_SITE}/invite/${token}`;
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

function unwrapRpc(data, fallback) {
  const payload = data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  if (payload && payload.ok === false) throw new Error(payload.error || fallback);
  if (payload && payload.ok === true) return payload;
  if (payload) return payload;
  throw new Error(fallback);
}

function createInviteService({ client, dataRoot }) {
  const pendingPath = path.join(dataRoot, 'pending-invite.json');

  function requireClient() {
    if (!client) throw new Error('Sign-in is not configured yet, so invites cannot be created.');
    return client;
  }

  async function setPending(token) {
    if (!TOKEN_RE.test(String(token || ''))) throw new Error('Invalid invite');
    await fs.mkdir(path.dirname(pendingPath), { recursive: true });
    await fs.writeFile(pendingPath, JSON.stringify({ token, saved_at: new Date().toISOString() }) + '\n');
    return token;
  }

  async function getPendingToken() {
    try {
      const raw = JSON.parse(await fs.readFile(pendingPath, 'utf8'));
      const token = String(raw?.token || '');
      return TOKEN_RE.test(token) ? token : null;
    } catch {
      return null;
    }
  }

  async function clearPending() {
    await fs.rm(pendingPath, { force: true });
  }

  async function preview(token) {
    const c = requireClient();
    if (!TOKEN_RE.test(String(token || ''))) throw new Error('Invalid invite');
    const { data, error } = await c.rpc('invite_preview', { invite_token: token });
    if (error) raise(error, 'Could not read that invite. Run the latest schema.sql in Supabase.');
    return unwrapRpc(data, 'Invite not found');
  }

  async function pending() {
    const token = await getPendingToken();
    if (!token) return null;
    try {
      const data = await preview(token);
      return { token, ...data };
    } catch (err) {
      return { token, ok: false, error: err.message };
    }
  }

  async function create({ teamId, memberId, accessRole }) {
    const c = requireClient();
    const role = ACCESS_ROLES.has(accessRole) ? accessRole : 'user';
    const token = newToken();
    const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    await c
      .from('invites')
      .update({ expires_at: new Date().toISOString() })
      .eq('team_id', teamId)
      .eq('member_id', memberId)
      .is('accepted_at', null);

    const { data, error } = await c
      .from('invites')
      .insert({
        id: token,
        team_id: teamId,
        member_id: memberId,
        access_role: role,
        expires_at: expires,
      })
      .select()
      .single();
    if (error) raise(error, 'Could not create the invite. Run the latest schema.sql in Supabase.');
    return {
      token,
      url: inviteUrl(token),
      access_role: role,
      expires_at: data.expires_at || expires,
      team_id: teamId,
      member_id: memberId,
    };
  }

  async function status(teamId, memberId) {
    const c = requireClient();
    const { data: member, error: memberError } = await c
      .from('members')
      .select('*')
      .eq('team_id', teamId)
      .eq('id', memberId)
      .maybeSingle();
    if (memberError) raise(memberError);

    let linked = null;
    if (member?.user_id) {
      const { data: profile } = await c
        .from('profiles')
        .select('id, discord_username, avatar_url, role')
        .eq('id', member.user_id)
        .maybeSingle();
      linked = profile || { id: member.user_id };
    }

    const { data: open } = await c
      .from('invites')
      .select('id, access_role, created_at, expires_at, accepted_at')
      .eq('team_id', teamId)
      .eq('member_id', memberId)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    const invite = open && open[0] ? open[0] : null;
    return {
      linked,
      invite: invite
        ? { ...invite, url: inviteUrl(invite.id) }
        : null,
    };
  }

  async function revoke(teamId, memberId) {
    const c = requireClient();
    await c
      .from('invites')
      .update({ expires_at: new Date().toISOString() })
      .eq('team_id', teamId)
      .eq('member_id', memberId)
      .is('accepted_at', null);
    const { error } = await c
      .from('members')
      .update({ user_id: null, updated_at: new Date().toISOString() })
      .eq('team_id', teamId)
      .eq('id', memberId);
    if (error && error.code !== '42703') raise(error);
    return true;
  }

  async function redeem(token) {
    const c = requireClient();
    const use = TOKEN_RE.test(String(token || '')) ? token : await getPendingToken();
    if (!use) throw new Error('No invite to accept');
    const { data, error } = await c.rpc('redeem_invite', { invite_token: use });
    if (error) raise(error, 'Could not accept that invite. Run the latest schema.sql in Supabase.');
    const result = unwrapRpc(data, 'Could not accept that invite');
    await clearPending();
    return { token: use, ...result };
  }

  async function teamIdsForUser(userId) {
    if (!userId) return [];
    const c = requireClient();
    const { data, error } = await c.from('members').select('team_id').eq('user_id', userId);
    if (error) {
      if (error.code === '42703') return null;
      raise(error);
    }
    return [...new Set((data || []).map((row) => row.team_id).filter(Boolean))];
  }

  return {
    setPending,
    getPendingToken,
    clearPending,
    pending,
    preview,
    create,
    status,
    revoke,
    redeem,
    teamIdsForUser,
  };
}

module.exports = { createInviteService, inviteUrl, TOKEN_RE, newToken };
