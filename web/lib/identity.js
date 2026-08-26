import { resolveAccessRole, roleLabel } from './access.js';

function isNaevii(value) {
  const s = String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return s === 'naevii' || s === 'naeviiszn' || s.startsWith('naeviiszn');
}

export const TITLE_SUGGESTIONS = [
  'Player',
  'Org Owner',
  'Admin',
  'General Manager',
  'Team Manager',
  'Head Coach',
  'Coach',
  'Team Leader',
  'Analyst',
  'Artist',
  'Graphic Designer',
  'Content Creator',
  'Social Media',
  'Video Editor',
  'Developer',
];

export function linkedMember(members, userId) {
  if (!userId) return null;
  return (members || []).find((m) => m.user_id === userId) || null;
}

export function sessionIdentity({ user, profile, members = [], org = null }) {
  const me = linkedMember(members, user?.id);
  const discord =
    profile?.discord_username ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.custom_claims?.global_name ||
    user?.email ||
    '';
  const staffChip = !me && ['owner', 'admin', 'developer'].includes(String(profile?.role || ''))
    ? String(org?.profileName || '').trim()
    : '';
  const name =
    String(profile?.display_name || me?.gamertag || me?.name || staffChip || discord || '').trim() || 'Signed in';
  let title = String(profile?.title || me?.title || (!me ? org?.profileTitle : '') || '').trim();
  if (!title) {
    if (isNaevii(name) || isNaevii(discord)) title = 'Developer';
    else title = roleLabel(profile?.role);
  }
  return {
    name,
    title,
    role: resolveAccessRole(profile, { names: [name, me?.gamertag, me?.name, discord] }),
    avatarUrl: profile?.avatar_url || null,
    photo: me?.photo || null,
    member: me,
  };
}
