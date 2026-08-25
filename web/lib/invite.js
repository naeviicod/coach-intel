export const INVITE_SITE = 'https://coach.championshipseries.eu';
export const INVITE_TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;
export const INVITE_ROLES = new Set([
  'owner', 'admin', 'developer', 'user', 'team_leader', 'coach', 'analyst', 'creative',
]);
export const STAFF_INVITE_ROLES = new Set(['owner', 'admin', 'developer', 'team_leader', 'coach']);

export function joinUrl(token) {
  if (token) return `${INVITE_SITE}/join/${String(token).trim()}`;
  return `${INVITE_SITE}/join`;
}

export function accessRoleLabel(role) {
  return (
    {
      owner: 'Org owner',
      admin: 'Admin',
      developer: 'Developer',
      team_leader: 'Team leader',
      coach: 'Coach',
      analyst: 'Analyst',
      creative: 'Creative',
      user: 'Player',
    }[role] || 'Player'
  );
}

export function suggestedAccessRole(member) {
  const title = String(member?.title || '').toLowerCase();
  if (/\borg\s*owner\b|\bowner\b/.test(title) && !/team/.test(title)) return 'owner';
  if (/\badmin\b|\bgeneral\s*manager\b|\bgm\b/.test(title)) return 'admin';
  if (/team\s*leader|team\s*manager/.test(title)) return 'team_leader';
  if (/head\s*coach|\bcoach\b/.test(title)) return 'coach';
  if (/analyst/.test(title)) return 'analyst';
  if (/artist|graphic|designer|content|social|video\s*editor/.test(title)) return 'creative';
  return 'user';
}

export async function previewInvite(supabase, token) {
  if (!INVITE_TOKEN_RE.test(String(token || ''))) {
    return { ok: false, error: 'Invalid invite' };
  }
  const { data, error } = await supabase.rpc('invite_preview', { invite_token: token });
  if (error) return { ok: false, error: error.message };
  return data && typeof data === 'object' ? data : { ok: false, error: 'Invite not found' };
}

export async function redeemInvite(supabase, token) {
  if (!INVITE_TOKEN_RE.test(String(token || ''))) {
    return { ok: false, error: 'Invalid invite' };
  }
  const { data, error } = await supabase.rpc('redeem_invite', { invite_token: token });
  if (error) return { ok: false, error: error.message };
  return data && typeof data === 'object' ? data : { ok: false, error: 'Could not accept that invite' };
}

export async function createMemberInvite(supabase, { teamId, memberId, accessRole }) {
  const role = INVITE_ROLES.has(accessRole) ? accessRole : 'user';
  const token = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  await supabase
    .from('invites')
    .update({ expires_at: new Date().toISOString() })
    .eq('team_id', teamId)
    .eq('member_id', memberId)
    .is('accepted_at', null);

  const { data, error } = await supabase
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
  if (error) throw error;
  return { token, url: joinUrl(token), access_role: role, expires_at: data.expires_at || expires };
}
