export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function isoDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - first.getDay());
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

export function shiftMonth(year, month, delta) {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function todayIso() {
  const d = new Date();
  return isoDate(d.getFullYear(), d.getMonth(), d.getDate());
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

export const TYPE_META = {
  match: { label: 'League match', cls: 'match' },
  'league-match': { label: 'League match', cls: 'match' },
  scrim: { label: 'Scrim', cls: 'scrim' },
  'scrim-block': { label: 'Scrim', cls: 'scrim' },
  'vod-review': { label: 'VOD review', cls: 'vod' },
  meeting: { label: 'Meeting', cls: 'meeting' },
  training: { label: 'Training', cls: 'training' },
  practice: { label: 'Training', cls: 'training' },
  task: { label: 'Task', cls: 'task' },
  other: { label: 'Other', cls: 'other' },
};

export function chipClass(type) {
  return CHIP_CLS[type] || TYPE_META[type]?.cls || 'other';
}

export function bucketByDate(items = []) {
  const map = {};
  for (const item of items) {
    if (!item?.date) continue;
    const key = String(item.date).slice(0, 10);
    (map[key] = map[key] || []).push(item);
  }
  return map;
}

export function calendarItems({ teams, events, tasks, matches, members, scrims, org }) {
  const teamName = (id) => {
    if (!id) return org?.name || org?.tag || 'Org';
    return teams.find((t) => t.id === id)?.name || 'Team';
  };
  const matchKey = (teamId, date, opponent) =>
    `${teamId || ''}|${String(date || '').slice(0, 10)}|${String(opponent || '').trim().toLowerCase()}`;
  const items = [];
  const seenMatch = new Set();
  const seenScrim = new Set();

  for (const event of events || []) {
    if (!event?.date) continue;
    const type = event.type || 'other';
    if (type === 'league-match' || type === 'match') seenMatch.add(matchKey(event.team_id, event.date, event.opponent));
    if (type === 'scrim' || type === 'scrim-block') seenScrim.add(matchKey(event.team_id, event.date, event.opponent));
    items.push({
      date: String(event.date).slice(0, 10),
      time: event.time || '',
      type,
      title: event.title || event.type || 'Event',
      teamName: teamName(event.team_id),
      teamId: event.team_id,
    });
  }
  for (const scrim of scrims || []) {
    if (!scrim?.date) continue;
    const key = matchKey(scrim.team_id, scrim.date, scrim.opponent);
    if (seenScrim.has(key)) continue;
    seenScrim.add(key);
    items.push({
      date: String(scrim.date).slice(0, 10),
      time: scrim.time || '',
      type: 'scrim',
      title: scrim.opponent ? `Scrim vs ${scrim.opponent}` : 'Scrim',
      teamName: teamName(scrim.team_id),
      teamId: scrim.team_id,
    });
  }
  for (const match of matches || []) {
    const date = match.date || match.match_date;
    if (!date) continue;
    const key = matchKey(match.team_id, date, match.opponent);
    if (seenMatch.has(key)) continue;
    seenMatch.add(key);
    items.push({
      date: String(date).slice(0, 10),
      type: 'match',
      title: match.opponent ? `vs ${match.opponent}` : 'Match',
      teamName: teamName(match.team_id),
      teamId: match.team_id,
    });
  }
  for (const task of tasks || []) {
    if (!task?.due || task.done) continue;
    const assignee = (members || []).find((m) => m.id === task.assignee_id);
    items.push({
      date: String(task.due).slice(0, 10),
      type: 'task',
      title: task.title || 'Task',
      teamName: teamName(task.team_id),
      teamId: task.team_id,
      people: assignee?.gamertag ? [assignee.gamertag] : [],
    });
  }
  return items;
}
