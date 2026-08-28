import { icon } from './icons';

export function initials(name) {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function markSrc(value) {
  const src = String(value || '').trim();
  if (!src) return '';
  if (/^(https?:|data:|blob:)/i.test(src)) return src;
  if (src.startsWith('/') && !src.startsWith('/org/')) return src;
  const key = src.replace(/^\/+/, '');
  if (!key || key.includes('..')) return '';
  return `/api/assets/${key.split('/').map(encodeURIComponent).join('/')}`;
}

export function roleClass(role) {
  return String(role || 'Flex').replace(/\s+/g, '-');
}

export function RoleBadge({ role }) {
  const short = role || 'Flex';
  return (
    <span className={`role-badge ${roleClass(short)}`} title={short}>
      <span className="role-badge-code">{short}</span>
    </span>
  );
}

export function TeamMark({ team, className = 'team-logo' }) {
  const src = markSrc(team?.logo);
  return (
    <div className={className}>
      {src ? <img src={src} alt="" /> : initials(team?.name || team?.tag)}
    </div>
  );
}

export function OrgMark({ org, className = 'sb-org-logo' }) {
  const src = markSrc(org?.logo) || markSrc('org/logos/org-logo.webp');
  const label = org?.tag || org?.name || 'Org';
  return (
    <div className={className}>
      {src ? <img src={src} alt="" /> : initials(label)}
    </div>
  );
}

export function PlayerAvatar({ member }) {
  const src = markSrc(member?.photo) || member?.avatar_url || '';
  return (
    <div className="avatar" title={member?.gamertag || ''}>
      {src ? <img src={src} alt="" /> : initials(member?.gamertag || member?.name)}
    </div>
  );
}

export function Sparkline({ values, width = 140, height = 36, stroke = 'var(--accent)' }) {
  const list = values?.length ? values : [0, 0];
  const min = Math.min(...list);
  const max = Math.max(...list);
  const range = max - min || 1;
  const stepX = width / Math.max(list.length - 1, 1);
  const points = list
    .map((value, i) => {
      const x = i * stepX;
      const y = height - ((value - min) / range) * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} xmlns="http://www.w3.org/2000/svg">
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function teamWinRate(matches) {
  if (!matches.length) return 0;
  const wins = matches.filter((m) => String(m.result || '').toLowerCase() === 'win').length;
  return Math.round((wins / matches.length) * 100);
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

export function isMemberDisabled(member) {
  if (!member) return false;
  if (member.disabled === true) return true;
  return String(member.handles?._disabled || '') === '1';
}

export function splitRoster(members) {
  const list = (members || []).map((member) => {
    if (member?.slot === 'staff' && (isNaevii(member.gamertag) || isNaevii(member.name))) {
      return { ...member, slot: 'starter' };
    }
    return member;
  });
  const active = list.filter((m) => !isMemberDisabled(m));
  return {
    starters: active.filter((m) => m?.slot !== 'bench' && m?.slot !== 'staff' && m?.slot !== 'fa'),
    bench: active.filter((m) => m?.slot === 'bench'),
    staff: active.filter((m) => m?.slot === 'staff'),
    freeAgents: active.filter((m) => m?.slot === 'fa'),
    disabled: list.filter(isMemberDisabled),
  };
}

export function defaultSlot(members) {
  return splitRoster(members).starters.length >= 4 ? 'bench' : 'starter';
}

export function memberOrgGroup(member) {
  const title = String(member?.title || '').toLowerCase();
  if (member?.slot === 'fa' || /free\s*agent|\bf\/?a\b/.test(title)) return 'fa';
  if (/\b(org\s*owner|admin|general\s*manager|\bgm\b|super\s*admin|developer)\b/.test(title)) return 'admins';
  if (/\bcoach\b/.test(title)) return 'coaches';
  if (member?.slot === 'staff') return 'staff';
  return 'players';
}

export function fmtDue(dateStr) {
  if (!dateStr) return { label: 'No due date', overdue: false };
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return { label: String(dateStr), overdue: false };
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(d) - startOfDay(new Date())) / 86400000);
  if (dayDiff === 0) return { label: 'Due today', overdue: false };
  if (dayDiff === 1) return { label: 'Due tomorrow', overdue: false };
  if (dayDiff < 0) return { label: `Overdue ${Math.abs(dayDiff)}d`, overdue: true };
  return { label: `Due ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, overdue: false };
}

export function fmtDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function fmtStamp(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function memberIsNaevii(member) {
  return isNaevii(member?.gamertag) || isNaevii(member?.name);
}

export function memberDiscordVerified(member) {
  if (!member) return false;
  if (member.user_id || member.linked) return true;
  return memberIsNaevii(member);
}

export { showsCompetitiveStats } from './series';

export function VerifiedMark() {
  return (
    <span
      className="verified-mark"
      title="Confirmed · signed in with Discord"
      dangerouslySetInnerHTML={{ __html: icon('check', 10) }}
    />
  );
}
