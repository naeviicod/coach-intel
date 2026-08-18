// Calendar logic — pure, DOM-free. Builds the month grid and buckets planning
// items onto days. The renderer supplies the items; this only arranges them.

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function isoDate(year, month, day) {
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

export function todayIso() {
  const d = new Date();
  return isoDate(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * A six-row month grid (Sunday-first) of { date, day, inMonth } cells, so the
 * calendar always has a stable height regardless of how the month falls.
 */
export function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const startOffset = first.getDay(); // 0 = Sunday
  const gridStart = new Date(year, month, 1 - startOffset);
  const weeks = [];
  for (let w = 0; w < 6; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const cur = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + (w * 7 + d));
      days.push({
        date: isoDate(cur.getFullYear(), cur.getMonth(), cur.getDate()),
        day: cur.getDate(),
        inMonth: cur.getMonth() === month,
      });
    }
    weeks.push(days);
  }
  return weeks;
}

// Move a { year, month } pointer by whole months, rolling the year over.
export function shiftMonth(year, month, delta) {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

/**
 * Group planning items by their `date` (YYYY-MM-DD) into a lookup keyed by day.
 * Each item keeps its own shape; only the bucketing is done here.
 */
export function bucketByDate(items = []) {
  const map = {};
  for (const item of items) {
    if (!item || !item.date) continue;
    const key = String(item.date).slice(0, 10);
    (map[key] = map[key] || []).push(item);
  }
  return map;
}

export function normOpponent(value) {
  return String(value || '').trim().toLowerCase();
}

export function parseMaps(value) {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,;\n]+/)
      : [];
  const out = [];
  for (const entry of raw) {
    const name = typeof entry === 'string'
      ? entry.trim()
      : String(entry?.map || entry?.name || '').trim();
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

export function formatMaps(maps) {
  return parseMaps(maps).join(', ');
}

export function leagueKey(teamId, date, opponent) {
  return `${teamId || ''}|${String(date || '').slice(0, 10)}|${normOpponent(opponent)}`;
}

function chipLabel(team, opponent) {
  const who = team?.tag || team?.name || 'Team';
  return `${who} vs ${opponent || 'TBD'}`;
}

/**
 * Org Calendar items: league-match events plus logged matches for one team.
 * Same-day / same-opponent map-log rows collapse into a single series.
 */
export function leagueItemsForTeam(team, { events = [], matches = [] } = {}) {
  const byKey = new Map();

  function upsert(partial) {
    const key = leagueKey(partial.teamId, partial.date, partial.opponent);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, partial);
      return partial;
    }
    if (!existing.time && partial.time) existing.time = partial.time;
    if (partial.event && !existing.event) existing.event = partial.event;
    if (partial.result && !existing.result) existing.result = partial.result;
    if (partial.route && !existing.route) {
      existing.route = partial.route;
      existing.param = partial.param;
    }
    for (const name of partial.maps || []) {
      if (!existing.maps.includes(name)) existing.maps.push(name);
    }
    return existing;
  }

  for (const event of events) {
    if (!event || event.type !== 'league-match') continue;
    upsert({
      type: 'league-match',
      date: event.date,
      time: event.time || '',
      teamId: team.id,
      teamName: team.name || 'Team',
      teamTag: team.tag || '',
      opponent: event.opponent || '',
      maps: parseMaps(event.maps),
      title: chipLabel(team, event.opponent),
      event,
      source: 'event',
    });
  }

  for (const match of matches) {
    if (!match) continue;
    upsert({
      type: 'league-match',
      date: match.date,
      time: match.time || '',
      teamId: team.id,
      teamName: team.name || 'Team',
      teamTag: team.tag || '',
      opponent: match.opponent || '',
      maps: parseMaps(match.map),
      result: match.result || '',
      title: chipLabel(team, match.opponent),
      route: 'matches',
      source: 'match',
    });
  }

  const items = [...byKey.values()];
  for (const item of items) {
    const maps = formatMaps(item.maps);
    item.title = chipLabel({ name: item.teamName, tag: item.teamTag }, item.opponent);
    item.sub = [maps, item.time, item.result].filter(Boolean).join(' · ');
  }
  return items.sort(byWhen);
}

const CHIP_CLS = {
  'league-match': 'match',
  match: 'match',
  scrim: 'scrim',
  'scrim-block': 'scrim',
  'vod-review': 'vod',
  meeting: 'meeting',
  training: 'training',
  practice: 'training',
  task: 'task',
  other: 'other',
};

export function chipClass(type) {
  return CHIP_CLS[type] || 'other';
}

function memberName(members, id) {
  return (members || []).find((m) => m.id === id)?.gamertag || '';
}

function byWhen(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return (a.time || '').localeCompare(b.time || '');
}

/**
 * Org calendar: every team's matches, meetings, reviews, scrims and open
 * tasks with a due date. Staff, creatives and marketing read this as one
 * overview rather than hopping team planners.
 */
export function orgCalendarItems(team, { events = [], matches = [], tasks = [], scrims = [], members = [] } = {}) {
  const items = leagueItemsForTeam(team, { events, matches });
  const seenScrim = new Set();

  for (const event of events) {
    if (!event || event.type === 'league-match') continue;
    const people = (event.attendee_ids || []).map((id) => memberName(members, id)).filter(Boolean);
    if (event.type === 'scrim' || event.type === 'scrim-block') {
      seenScrim.add(leagueKey(team.id, event.date, event.opponent));
    }
    items.push({
      type: event.type,
      date: event.date,
      time: event.time || '',
      teamId: team.id,
      teamName: team.name || 'Team',
      title: event.title || event.type,
      people,
      opponent: event.opponent || '',
      event,
      source: 'event',
      route: event.type === 'vod-review' ? 'vod-library' : null,
      param: team.id,
    });
  }

  for (const scrim of scrims) {
    if (!scrim?.date) continue;
    const key = leagueKey(team.id, scrim.date, scrim.opponent);
    if (seenScrim.has(key)) continue;
    seenScrim.add(key);
    items.push({
      type: 'scrim',
      date: scrim.date,
      time: scrim.time || '',
      teamId: team.id,
      teamName: team.name || 'Team',
      title: `Scrim vs ${scrim.opponent || 'TBD'}`,
      opponent: scrim.opponent || '',
      source: 'scrim',
      route: 'scrim-hub',
      param: team.id,
    });
  }

  for (const task of tasks) {
    if (!task?.due || task.done) continue;
    const assignee = memberName(members, task.assignee_id);
    items.push({
      type: 'task',
      date: String(task.due).slice(0, 10),
      time: '',
      teamId: team.id,
      teamName: team.name || 'Team',
      title: task.title || 'Task',
      people: assignee ? [assignee] : [],
      source: 'task',
      route: 'tasks',
      param: team.id,
      task,
    });
  }

  return items.sort(byWhen);
}
