export const INVITE_SITE = 'https://coach.championshipseries.eu';
export const INVITE_TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;
export const INVITE_ROLES = new Set([
  'owner', 'admin', 'developer', 'user', 'team_leader', 'coach', 'analyst', 'creative', 'free_agent',
]);
export const STAFF_INVITE_ROLES = new Set(['owner', 'admin', 'developer', 'team_leader', 'coach']);

export function inviteeSlug(gamertag) {
  const slug = String(gamertag || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return slug || 'player';
}

export function joinUrl(token, gamertag) {
  const t = String(token || '').trim();
  if (!t) return `${INVITE_SITE}/join`;
  if (!gamertag) return `${INVITE_SITE}/join/${t}`;
  return `${INVITE_SITE}/join/${inviteeSlug(gamertag)}/${t}`;
}

export function previewJoinUrl(gamertag) {
  const slug = inviteeSlug(gamertag);
  if (!String(gamertag || '').trim() || slug === 'player') return `${INVITE_SITE}/join/preview`;
  return `${INVITE_SITE}/join/${slug}/preview`;
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
      free_agent: 'Free Agent',
    }[role] || 'Player'
  );
}

function playRoleLabel(role) {
  const r = String(role || '').trim();
  if (!r || /^player$/i.test(r)) return '';
  return r;
}

export function rosterSlotLabel(slot) {
  const s = String(slot || '').toLowerCase();
  if (s === 'bench') return 'Bench';
  if (s === 'staff') return 'Staff';
  if (s === 'fa') return 'Free Agent';
  return 'Main roster';
}

export function inviteChips({ team, playRole, slot, accessRole } = {}) {
  const teamName = String(team || '').trim();
  const position = playRoleLabel(playRole);
  const s = String(slot || '').toLowerCase();
  const chips = [];
  if (teamName) chips.push(teamName);
  if (s === 'staff') {
    const staff = accessRoleLabel(accessRole);
    chips.push(staff === 'Player' ? 'Staff' : staff);
    return chips;
  }
  if (s === 'fa') {
    chips.push('Free Agent');
    return chips;
  }
  if (s === 'bench' || s === 'starter' || position) chips.push(rosterSlotLabel(slot));
  if (position) chips.push(position);
  return chips;
}

export function invitePlacement({ team, playRole, slot } = {}) {
  const teamName = String(team || '').trim();
  const position = playRoleLabel(playRole);
  const hasSlot = String(slot || '').trim() !== '';
  if (!position && !hasSlot) return '';
  const s = String(slot || 'starter').toLowerCase();
  if (s === 'staff') {
    if (teamName && position) return ` as ${position} on ${teamName}`;
    if (teamName) return ` on ${teamName}`;
    return position ? ` as ${position}` : '';
  }
  if (s === 'fa') {
    if (teamName) return ` as a free agent with ${teamName}`;
    return ' as a free agent in the org';
  }
  if (s === 'bench') {
    if (teamName && position) return ` as ${position} on ${teamName}'s bench`;
    if (teamName) return ` as a bench player on ${teamName}`;
    return position ? ` as ${position} on the bench` : ' as a bench player';
  }
  if (teamName && position) return ` as ${position} on ${teamName}'s main roster`;
  if (teamName) return ` on ${teamName}'s main roster`;
  return position ? ` as ${position} on the main roster` : ' on the main roster';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeInviteEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!email) return '';
  if (email.length > 120 || !EMAIL_RE.test(email)) {
    throw new Error('That email does not look right.');
  }
  return email;
}

export function inviteCopy(invite) {
  if (!invite) {
    return {
      kicker: 'Coach Intel',
      title: 'Sign in to your org',
      body: 'If you were invited, open the personal link they sent — it will have your gamertag on it. Staff already on Discord can sign in here.',
      detail: 'No desktop app required.',
    };
  }

  const org = String(invite.org_name || invite.team_name || '').trim() || 'the organization';
  const who = String(invite.gamertag || invite.member_name || '').trim();
  const team = String(invite.team_name || '').trim();
  const chips = inviteChips({
    team: team && team !== org ? team : team,
    playRole: invite.play_role,
    slot: invite.slot,
    accessRole: invite.access_role,
  });
  const place = invitePlacement({ team, playRole: invite.play_role, slot: invite.slot });

  return {
    kicker: "You've been invited",
    title: `Join ${org}`,
    body: who
      ? `${who}, you've been invited to ${org} on Coach Intel${place}.`
      : `You've been invited to ${org} on Coach Intel${place}.`,
    detail: chips.join(' · '),
  };
}

export function suggestedAccessRole(member) {
  const title = String(member?.title || '').toLowerCase();
  if (/\borg\s*owner\b|\bowner\b/.test(title) && !/team/.test(title)) return 'owner';
  if (/\badmin\b|\bgeneral\s*manager\b|\bgm\b/.test(title)) return 'admin';
  if (member?.slot === 'fa' || /free\s*agent|\bf\/?a\b/.test(title)) return 'free_agent';
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

export async function createMemberInvite(supabase, { teamId, memberId, accessRole, email, gamertag }) {
  const role = INVITE_ROLES.has(accessRole) ? accessRole : 'user';
  const token = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const inviteeEmail = normalizeInviteEmail(email);

  let tag = String(gamertag || '').trim();
  if (!tag) {
    const { data: member } = await supabase
      .from('members')
      .select('gamertag')
      .eq('team_id', teamId)
      .eq('id', memberId)
      .maybeSingle();
    tag = String(member?.gamertag || '').trim();
  }

  await supabase
    .from('invites')
    .update({ expires_at: new Date().toISOString() })
    .eq('team_id', teamId)
    .eq('member_id', memberId)
    .is('accepted_at', null);

  const row = {
    id: token,
    team_id: teamId,
    member_id: memberId,
    access_role: role,
    expires_at: expires,
  };
  if (inviteeEmail) row.invitee_email = inviteeEmail;

  const { data, error } = await supabase
    .from('invites')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return { token, url: joinUrl(token, tag), access_role: role, expires_at: data.expires_at || expires };
}
