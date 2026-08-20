import { asset } from './lib/assets.js';

const ICON_SHAPES = {
  commandCenter: '<rect x="2" y="3" width="12" height="9" rx="1.5"/><path d="M6 15h4"/>',
  teams: '<path d="M8 1.5l5.5 2v4.2c0 3.6-2.3 6.1-5.5 7.3-3.2-1.2-5.5-3.7-5.5-7.3V3.5L8 1.5z"/>',
  players: '<circle cx="8" cy="5.5" r="2.5"/><path d="M2.5 14.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/>',
  roster: '<circle cx="6" cy="5" r="2"/><circle cx="11.3" cy="6.2" r="1.5"/><path d="M2 14c0-2.5 1.8-4 4-4s4 1.5 4 4M9.6 10.3c1.7.2 2.9 1.4 2.9 3.2"/>',
  scouting: '<circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2.6"/><circle cx="8" cy="8" r="0.6" fill="currentColor" stroke="none"/>',
  database: '<ellipse cx="8" cy="3.5" rx="5.5" ry="2"/><path d="M2.5 3.5v9c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2v-9"/><path d="M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2"/>',
  review: '<path d="M8 2l6.2 11H1.8L8 2z"/><path d="M8 6.6v3.1"/><circle cx="8" cy="11.6" r="0.65" fill="currentColor" stroke="none"/>',
  scoreboard: '<rect x="1.8" y="3" width="12.4" height="10" rx="1.6"/><path d="M1.8 6.2h12.4M5.4 6.2v6.8M8 8.4v2.2M10.4 8.4v2.2"/>',
  settings: '<circle cx="8" cy="8" r="2.3"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/>',
  strats: '<path d="M2 4l4-1.5 4 1.5 4-1.5v9.5l-4 1.5-4-1.5-4 1.5V4z"/><path d="M6 2.5v9.5M10 4v9.5"/>',
  matches: '<path d="M3 4h10M3 8h10M3 12h6"/>',
  performance: '<path d="M3 13.5V9M7 13.5V5M11 13.5V7M2.5 13.5h11"/>',
  mapsModes: '<path d="M8 1.5l5.5 3.25v6.5L8 14.5l-5.5-3.25v-6.5L8 1.5z"/>',
  intel: '<path d="M8 2l4 6-4 6-4-6 4-6z"/>',
  dashboard: '<rect x="2" y="2.5" width="5.2" height="5.2" rx="1.2"/><rect x="8.8" y="2.5" width="5.2" height="3.2" rx="1.2"/><rect x="2" y="9.3" width="5.2" height="4.2" rx="1.2"/><rect x="8.8" y="7.3" width="5.2" height="6.2" rx="1.2"/>',
  calendar: '<rect x="2" y="3.2" width="12" height="10.8" rx="1.6"/><path d="M2 6.6h12M5.3 1.8v2.6M10.7 1.8v2.6"/>',
  tasks: '<path d="M2.2 4.4l1.5 1.5 2.6-2.8M2.2 11.4l1.5 1.5 2.6-2.8"/><path d="M8.4 4.3h5.4M8.4 11.3h5.4"/>',
  vod: '<rect x="1.8" y="3.2" width="12.4" height="9.6" rx="1.8"/><path d="M6.8 6.4l3.4 1.85-3.4 1.85V6.4z" fill="currentColor" stroke="none"/>',
  teamHub: '<circle cx="8" cy="8" r="2"/><circle cx="8" cy="2.4" r="1.3"/><circle cx="13" cy="10.6" r="1.3"/><circle cx="3" cy="10.6" r="1.3"/><path d="M8 6V3.7M9.7 9l2 1.05M6.3 9l-2 1.05"/>',
  scrim: '<path d="M2.2 5.2h4.3l1.5 5.6h4.3"/><path d="M10.6 3.3l1.9 1.9-1.9 1.9M5.4 12.7l-1.9-1.9 1.9-1.9"/>',
  veto: '<circle cx="8" cy="8" r="6"/><path d="M3.9 3.9l8.2 8.2"/>',
  reports: '<path d="M3.4 1.9h6l3.2 3.2v9H3.4v-12z"/><path d="M9.2 1.9v3.4h3.4"/><path d="M5.8 8.4h4.4M5.8 11h3"/>',
  rankings: '<path d="M6 13.6V6.2h4v7.4"/><path d="M2 13.6V9.4h4M10 13.6V7.8h4v5.8"/><path d="M1.4 13.6h13.2"/>',
  integrations: '<path d="M6.6 2.4H3.4a1 1 0 00-1 1v3.2"/><rect x="2.4" y="6.6" width="5" height="7" rx="1"/><rect x="8.6" y="2.4" width="5" height="7" rx="1"/><path d="M9.4 9.6v3.2a1 1 0 001 1h3.2"/>',
  notes: '<path d="M3.4 2.2h9.2v11.6H3.4z"/><path d="M5.8 5.4h4.4M5.8 8h4.4M5.8 10.6h2.6"/>',
  objectives: '<circle cx="8" cy="8" r="5.6"/><circle cx="8" cy="8" r="2.4"/><path d="M8 2.4v-1M8 14.6v-1M2.4 8h-1M14.6 8h-1"/>',
  practice: '<circle cx="8" cy="8.6" r="5.2"/><path d="M8 5.8v2.8l1.9 1.2"/><path d="M6.2 1.6h3.6"/>',
  chevronDown: '<path d="M4 6.3L8 10l4-3.7"/>',
  chevronLeft: '<path d="M9.8 3.6L5.6 8l4.2 4.4"/>',
  chevronRight: '<path d="M6.2 3.6L10.4 8l-4.2 4.4"/>',
  bell: '<path d="M4 6.8a4 4 0 018 0c0 3 1.1 4.1 1.1 4.1H2.9S4 9.8 4 6.8z"/><path d="M6.6 13a1.6 1.6 0 002.8 0"/>',
  help: '<circle cx="8" cy="8" r="6"/><path d="M6.3 6.2a1.75 1.75 0 013.4.6c0 1.2-1.7 1.5-1.7 2.6"/><circle cx="8" cy="11.6" r="0.6" fill="currentColor" stroke="none"/>',
  check: '<path d="M3.2 8.4l3 3 6.6-7"/>',
  plus: '<path d="M8 3.2v9.6M3.2 8h9.6"/>',
  more: '<circle cx="3.4" cy="8" r="1" fill="currentColor" stroke="none"/><circle cx="8" cy="8" r="1" fill="currentColor" stroke="none"/><circle cx="12.6" cy="8" r="1" fill="currentColor" stroke="none"/>',
  panel: '<rect x="1.8" y="3" width="12.4" height="10" rx="1.6"/><path d="M10 3v10"/>',
  edit: '<path d="M3 13l.9-3.1 6.6-6.6 2.2 2.2-6.6 6.6L3 13z"/><path d="M9.4 4.4l2.2 2.2"/>',
  trash: '<path d="M2.9 4.4h10.2M6.4 4.4V3a.8.8 0 01.8-.8h1.6a.8.8 0 01.8.8v1.4"/><path d="M4.4 4.4l.6 8.3a1 1 0 001 .9h4a1 1 0 001-.9l.6-8.3"/>',
  copy: '<rect x="5.4" y="5.4" width="8" height="8" rx="1.4"/><path d="M10.6 5.4V4a1.4 1.4 0 00-1.4-1.4H4a1.4 1.4 0 00-1.4 1.4v5.2A1.4 1.4 0 004 10.6h1.4"/>',
  feedback: '<path d="M2 3.4h12v7.6H8.6L5.6 13.6v-2.6H2z"/><path d="M5 6.4h6M5 8.4h3.6"/>',
};

export function icon(name, size = 15) {
  const shape = ICON_SHAPES[name] || ICON_SHAPES.settings;
  return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${shape}</svg>`;
}

export function verifiedMark() {
  return el('span', {
    class: 'verified-mark',
    title: 'Confirmed · signed in with Discord',
    html: icon('check', 9),
  });
}

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (key === 'class') node.className = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if ((tag === 'input' || tag === 'textarea' || tag === 'select') && key === 'value') {
      node.value = value;
    } else if (value !== null && value !== undefined) {
      node.setAttribute(key, value);
    }
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

// Text input with a custom-styled suggestion dropdown, replacing native
// <datalist> (Chromium renders that popup with OS chrome no page CSS can
// reach). Free text is always allowed — this only ever suggests, never
// restricts. Shows every option on focus with nothing typed yet, filters as
// the user types, and lets a click fill the input.
export function comboInput({ id, value = '', placeholder = '', options = [] } = {}) {
  const input = el('input', { type: 'text', id, value, placeholder, autocomplete: 'off' });
  const results = el('div', { class: 'combo-results' });
  results.style.display = 'none';

  function renderList() {
    const q = input.value.trim().toLowerCase();
    const list = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
    results.innerHTML = '';
    if (!list.length) {
      results.style.display = 'none';
      return;
    }
    for (const opt of list) {
      results.append(
        el(
          'div',
          {
            class: 'combo-row',
            // mousedown (not click) fires before the input's blur handler hides the list.
            onmousedown: (e) => {
              e.preventDefault();
              input.value = opt;
              results.style.display = 'none';
            },
          },
          opt
        )
      );
    }
    results.style.display = 'block';
  }

  input.addEventListener('focus', renderList);
  input.addEventListener('input', renderList);
  input.addEventListener('blur', () => setTimeout(() => (results.style.display = 'none'), 150));

  return el('div', { class: 'combo-wrap' }, [input, results]);
}

const AVATAR_COUNT = 5;

export function playerAvatarSrc(seed) {
  const str = String(seed || '');
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  const idx = (hash % AVATAR_COUNT) + 1;
  return asset(`avatars/soldier-${idx}.png`);
}

export function playerAvatar(member, attrs = {}) {
  const classAttr = attrs.class ? `avatar ${attrs.class}` : 'avatar';
  const mark = el('div', { ...attrs, class: classAttr }, [
    el('img', { src: playerAvatarSrc(member?.id || member?.gamertag), alt: member?.gamertag || 'Player' }),
  ]);
  if (member?.photo && window.cci?.dataUrlForPath) {
    window.cci.dataUrlForPath(member.photo).then((url) => {
      if (!url) return;
      const img = el('img', { src: url, alt: member.gamertag || '' });
      img.onerror = () => {};
      mark.replaceChildren(img);
    });
  }
  return mark;
}

export function faceMark({ photo, avatarUrl, name, size = 28 } = {}) {
  const mark = el('div', { class: 'avatar', style: `width:${size}px;height:${size}px;` }, initials(name));
  if (photo && window.cci?.dataUrlForPath) {
    window.cci.dataUrlForPath(photo).then((url) => {
      if (!url) return;
      mark.replaceChildren(el('img', { src: url, alt: name || '' }));
    });
    return mark;
  }
  if (avatarUrl) {
    const img = el('img', { src: avatarUrl, alt: name || '' });
    img.onerror = () => { img.remove(); mark.textContent = initials(name); };
    mark.replaceChildren(img);
  }
  return mark;
}

export function roleClass(role) {
  return String(role || 'Flex').replace(/\s+/g, '-');
}

const ROLE_LABELS = {
  IGL: 'In-Game Lead',
  AR: 'Assault Rifle',
  SMG: 'Submachine Gun',
  Sniper: 'Sniper',
  Flex: 'Flex',
  'Main Sub': 'Main Sub',
  'Main AR': 'Main Assault Rifle',
  Coach: 'Coach',
  Analyst: 'Analyst',
};

export function roleLabel(role) {
  return ROLE_LABELS[role] || role || 'Player';
}

export function roleBadge(role) {
  const short = role || 'Flex';
  const full = roleLabel(short);
  return el('span', { class: `role-badge ${roleClass(short)}`, title: full }, [
    el('span', { class: 'role-badge-code' }, short),
    full !== short ? el('span', { class: 'role-badge-name' }, full) : null,
  ]);
}

function loadMark(logos, name, attrs) {
  const paths = (Array.isArray(logos) ? logos : [logos]).filter(Boolean);
  const mark = el('div', attrs, initials(name));
  if (!paths.length || !window.cci?.dataUrlForPath) return mark;
  (async () => {
    for (const logo of paths) {
      const url = await window.cci.dataUrlForPath(logo);
      if (!url) continue;
      const img = el('img', { src: url, alt: name || '' });
      img.onerror = () => {
        img.remove();
        if (!mark.querySelector('img')) mark.textContent = initials(name);
      };
      mark.replaceChildren(img);
      return;
    }
  })();
  return mark;
}

export function orgMark(org, attrs = {}) {
  const { fallbackLogo, ...rest } = attrs;
  return loadMark(
    [
      org?.logo,
      fallbackLogo,
      'org/logos/org-logo.png',
      'org/logos/org-logo.jpg',
      'org/logos/org-logo.jpeg',
      'org/logos/org-logo.webp',
    ],
    org?.name || 'CI',
    { ...rest, class: rest.class || 'sb-org-logo' }
  );
}

export function teamMark(team, attrs = {}) {
  return loadMark(team?.logo, team?.name, { ...attrs, class: attrs.class || 'team-logo' });
}

export function initials(name) {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Timestamps on notes/tasks are full ISO strings, unlike the YYYY-MM-DD used by
// matches, so they can render as "Today 14:32" rather than just a date.
export function fmtStamp(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso || '');
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
  if (dayDiff === 0) return `Today ${time}`;
  if (dayDiff === 1) return `Yesterday ${time}`;
  if (dayDiff > 1 && dayDiff < 7) return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${time}`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function fmtDue(dateStr) {
  if (!dateStr) return { label: 'No due date', overdue: false };
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return { label: String(dateStr), overdue: false };
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(d) - startOfDay(new Date())) / 86400000);
  if (dayDiff === 0) return { label: 'Due today', overdue: false };
  if (dayDiff === 1) return { label: 'Due tomorrow', overdue: false };
  if (dayDiff < 0) return { label: `Overdue ${Math.abs(dayDiff)}d`, overdue: true };
  return { label: `Due ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, overdue: false };
}

export function round(num, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((num + Number.EPSILON) * factor) / factor;
}

export function kd(kills, deaths) {
  if (!deaths) return kills || 0;
  return round(kills / deaths, 2);
}

// ---------- Objective stats ----------

// Each mode scores its objective differently, so the columns and cards that
// surface OBJ play have to swap with the mode being looked at.
export const OBJ_STATS = {
  Hardpoint: [{ key: 'hill_time', label: 'Hill Time', short: 'Hill', duration: true }],
  'Search & Destroy': [
    { key: 'plants', label: 'Plants', short: 'Plants' },
    { key: 'defuses', label: 'Defuses', short: 'Defuses' },
  ],
  Overload: [{ key: 'drives_captured', label: 'Drives Captured', short: 'Drives' }],
};

export const OBJ_KEYS = [...new Set(Object.values(OBJ_STATS).flatMap((stats) => stats.map((s) => s.key)))];

export function fmtObj(stat, value, { precise = false } = {}) {
  const raw = value || 0;
  if (stat.duration) {
    const n = Math.round(raw);
    return n < 60 ? `${n}s` : `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
  }
  return String(precise ? round(raw, 1) : Math.round(raw));
}

export function objStatsForModes(modes) {
  const seen = new Set();
  const out = [];
  for (const mode of modes) {
    for (const stat of OBJ_STATS[mode] || []) {
      if (seen.has(stat.key)) continue;
      seen.add(stat.key);
      out.push(stat);
    }
  }
  return out;
}

export function objModesInMatches(matches) {
  return Object.keys(OBJ_STATS).filter((mode) => matches.some((m) => m.mode === mode));
}

export function teamObjTotal(matches, key) {
  let total = 0;
  for (const m of matches) {
    for (const p of m.players || []) total += p[key] || 0;
  }
  return total;
}

// ---------- Advanced CoD metrics (from match.hp / match.snd / match.overload) ----------
//
// These read the optional team-level round/hill counters a coach can add to a
// match under "Advanced Stats". Every function returns null — not a fabricated
// 0% — when nothing has been recorded, so the UI can show "no data" instead of
// a misleadingly confident number.

function sumCounters(matches, modeKey, fields) {
  const totals = Object.fromEntries(fields.map((f) => [f, 0]));
  let any = false;
  for (const m of matches) {
    const data = m[modeKey];
    if (!data) continue;
    for (const f of fields) {
      if (data[f] !== null && data[f] !== undefined) {
        totals[f] += data[f];
        any = true;
      }
    }
  }
  return any ? totals : null;
}

function pct(part, whole) {
  if (!whole) return null;
  return round((part / whole) * 100, 1);
}

const HP_COUNTER_KEYS = ['holds_won', 'holds_attempted', 'breaks_won', 'breaks_attempted', 'rotations_won', 'rotations_attempted'];
const SND_COUNTER_KEYS = [
  'offense_rounds', 'offense_round_wins', 'defense_rounds', 'defense_round_wins',
  'first_bloods', 'first_blood_wins', 'first_deaths', 'first_death_wins',
  'post_plant_rounds', 'post_plant_wins', 'retake_rounds', 'retake_wins',
];
const OVERLOAD_COUNTER_KEYS = ['scoring_attempts', 'scoring_wins', 'defensive_attempts', 'defensive_stops'];

export function hpAdvancedMetrics(matches) {
  const hpMatches = matches.filter((m) => m.mode === 'Hardpoint');
  const totals = sumCounters(hpMatches, 'hp', HP_COUNTER_KEYS);
  if (!totals) return null;
  return {
    hold_pct: pct(totals.holds_won, totals.holds_attempted),
    break_pct: pct(totals.breaks_won, totals.breaks_attempted),
    rotation_pct: pct(totals.rotations_won, totals.rotations_attempted),
    sample: hpMatches.filter((m) => m.hp).length,
  };
}

export function sndAdvancedMetrics(matches) {
  const sndMatches = matches.filter((m) => m.mode === 'Search & Destroy');
  const totals = sumCounters(sndMatches, 'snd', SND_COUNTER_KEYS);
  const withCounters = sndMatches.filter((m) => m.snd);
  const plants = teamObjTotal(withCounters, 'plants');
  const offenseRounds = withCounters.reduce((sum, m) => sum + (m.snd?.offense_rounds || 0), 0);
  if (!totals && !offenseRounds) return null;
  return {
    offense_win_pct: totals ? pct(totals.offense_round_wins, totals.offense_rounds) : null,
    defense_win_pct: totals ? pct(totals.defense_round_wins, totals.defense_rounds) : null,
    first_blood_conversion_pct: totals ? pct(totals.first_blood_wins, totals.first_bloods) : null,
    first_death_recovery_pct: totals ? pct(totals.first_death_wins, totals.first_deaths) : null,
    // Reuses the existing per-player `plants` count against the new team-level
    // offense-round total, rather than tracking plants a second time.
    plant_pct: offenseRounds ? pct(plants, offenseRounds) : null,
    post_plant_win_pct: totals ? pct(totals.post_plant_wins, totals.post_plant_rounds) : null,
    retake_pct: totals ? pct(totals.retake_wins, totals.retake_rounds) : null,
    sample: withCounters.length,
  };
}

export function overloadAdvancedMetrics(matches) {
  const ovlMatches = matches.filter((m) => m.mode === 'Overload');
  const totals = sumCounters(ovlMatches, 'overload', OVERLOAD_COUNTER_KEYS);
  if (!totals) return null;
  return {
    scoring_efficiency_pct: pct(totals.scoring_wins, totals.scoring_attempts),
    defensive_stop_pct: pct(totals.defensive_stops, totals.defensive_attempts),
    sample: ovlMatches.filter((m) => m.overload).length,
  };
}

export function advancedMetricsForMode(matches, mode) {
  if (mode === 'Hardpoint') return hpAdvancedMetrics(matches);
  if (mode === 'Search & Destroy') return sndAdvancedMetrics(matches);
  if (mode === 'Overload') return overloadAdvancedMetrics(matches);
  return null;
}

// Side performance: win rate grouped by the free-text `side` a coach enters
// per match/scrim-map (e.g. "Offense" / "Defense" / "Attack") — reuses the
// same statsByKey shape (key, total, wins, losses, winRate) as map/mode stats.
export function sidePerformance(matches) {
  return statsByKey(
    matches.filter((m) => m.side),
    (m) => m.side
  );
}

// ---------- Stat aggregation across matches for one member ----------

export function statsForMember(matches, memberId) {
  const rows = [];
  for (const match of matches) {
    const p = (match.players || []).find((pl) => pl.member_id === memberId);
    if (p) rows.push({ match, player: p });
  }
  return rows;
}

export function aggregate(rows) {
  const obj = Object.fromEntries(OBJ_KEYS.map((k) => [k, 0]));
  if (!rows.length) {
    return { matches: 0, kills: 0, deaths: 0, assists: 0, damage: 0, kd: 0, wins: 0, winRate: 0, obj };
  }
  const totals = rows.reduce(
    (acc, r) => {
      acc.kills += r.player.kills || 0;
      acc.deaths += r.player.deaths || 0;
      acc.assists += r.player.assists || 0;
      acc.damage += r.player.damage || 0;
      for (const key of OBJ_KEYS) acc.obj[key] += r.player[key] || 0;
      if (r.match.result === 'Win') acc.wins += 1;
      return acc;
    },
    { kills: 0, deaths: 0, assists: 0, damage: 0, wins: 0, obj }
  );
  return {
    matches: rows.length,
    ...totals,
    kd: kd(totals.kills, totals.deaths),
    winRate: round((totals.wins / rows.length) * 100, 0),
  };
}

export function teamWinRate(matches) {
  if (!matches.length) return 0;
  const wins = matches.filter((m) => m.result === 'Win').length;
  return round((wins / matches.length) * 100, 0);
}

export function statsByKey(matches, keyFn) {
  const map = {};
  for (const m of matches) {
    const k = keyFn(m);
    if (!map[k]) map[k] = { key: k, total: 0, wins: 0, losses: 0 };
    map[k].total += 1;
    if (m.result === 'Win') map[k].wins += 1;
    else map[k].losses += 1;
  }
  return Object.values(map)
    .map((s) => ({ ...s, winRate: round((s.wins / s.total) * 100, 0) }))
    .sort((a, b) => b.total - a.total);
}

export function teamKD(matches) {
  let k = 0;
  let d = 0;
  for (const m of matches) {
    for (const p of m.players || []) {
      k += p.kills || 0;
      d += p.deaths || 0;
    }
  }
  return d ? round(k / d, 2) : k;
}

export function teamAvgDamage(matches) {
  let total = 0;
  let count = 0;
  for (const m of matches) {
    for (const p of m.players || []) {
      total += p.damage || 0;
      count += 1;
    }
  }
  return count ? Math.round(total / count) : 0;
}

export function pctDelta(recent, overall) {
  if (!overall) return null;
  return round(((recent - overall) / overall) * 100, 1);
}

// ---------- Inline SVG charts (no dependency) ----------

export function sparkline(values, { width = 140, height = 36, stroke = '#b6f542' } = {}) {
  if (!values.length) return svgEmpty(width, height);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / Math.max(values.length - 1, 1);
  const points = values.map((v, i) => {
    const x = round(i * stepX, 2);
    const y = round(height - ((v - min) / range) * (height - 6) - 3, 2);
    return `${x},${y}`;
  });
  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <polyline points="${points.join(' ')}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`;
}

function svgEmpty(width, height) {
  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"></svg>`;
}

export function barRow(label, value, max, color = '#b6f542') {
  const pct = max > 0 ? Math.max(4, round((value / max) * 100, 1)) : 0;
  return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
    <div style="width:78px;font-size:11px;color:#8d969f;flex-shrink:0;">${label}</div>
    <div style="flex:1;background:#1c2027;border-radius:5px;height:8px;overflow:hidden;">
      <div style="width:${pct}%;background:${color};height:100%;border-radius:5px;"></div>
    </div>
    <div style="width:34px;text-align:right;font-size:11px;font-weight:700;">${value}</div>
  </div>`;
}
