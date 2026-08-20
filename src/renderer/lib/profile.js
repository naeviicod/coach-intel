// Signed-in person in the top bar, and roster social handles.

export const HANDLE_FIELDS = [
  { key: 'activision', label: 'Activision ID', placeholder: 'Name#1234567' },
  { key: 'checkmate', label: 'Checkmate Gaming', placeholder: 'checkmategaming.com/player/…' },
  { key: 'discord', label: 'Discord', placeholder: 'username' },
  { key: 'twitch', label: 'Twitch', placeholder: 'twitch.tv/…' },
  { key: 'twitter', label: 'X / Twitter', placeholder: '@handle' },
  { key: 'youtube', label: 'YouTube', placeholder: '@channel' },
  { key: 'instagram', label: 'Instagram', placeholder: '@handle' },
  { key: 'other', label: 'Other', placeholder: 'Platform + handle' },
];

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

const STAFF_TITLE_RE = /\b(org\s*owner|owner|admin|general\s*manager|\bgm\b|team\s*manager|head\s*coach|coach|team\s*leader|analyst|artist|graphic\s*designer|designer|content(\s*creator)?|social(\s*media)?|video\s*editor|developer)\b/i;

export function isOrgStaffTitle(title) {
  const t = String(title || '').trim();
  if (!t || /^player$/i.test(t)) return false;
  return STAFF_TITLE_RE.test(t);
}

export function isNaevii(value) {
  const s = String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return s === 'naevii' || s === 'naeviiszn' || s.startsWith('naeviiszn');
}

export function memberStaffTitle(member) {
  const explicit = String(member?.title || '').trim();
  if (explicit) return explicit;
  if (isNaevii(member?.gamertag) || isNaevii(member?.name)) return 'Developer';
  return '';
}

export function orgTitles(member) {
  const raw = memberStaffTitle(member) || '';
  return [...new Set(raw.split(/[,/|&]+/).map((s) => s.trim()).filter(Boolean))];
}

export function normalizeHandles(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const { key } of HANDLE_FIELDS) {
    const value = String(raw[key] || '').trim();
    if (value) out[key] = value.slice(0, 120);
  }
  return out;
}

export function memberDiscordVerified(member) {
  return Boolean(member?.user_id || member?.linked);
}

export function chipIdentity(org, access) {
  const me = access?.me;
  const name = String(org?.profileName || me?.discord_username || org?.coachName || '').trim() || 'Coach';
  let title = String(org?.profileTitle || '').trim();
  if (!title) {
    if (isNaevii(name) || isNaevii(me?.discord_username)) title = 'Developer';
    else if (access?.local) title = 'Local';
    else title = '';
  }
  const role = access?.local ? '' : (access?.role || '');
  return {
    name,
    title,
    role,
    verified: Boolean(!access?.local && me),
    photo: org?.profilePhoto || null,
    avatarUrl: me?.avatar_url || null,
  };
}
