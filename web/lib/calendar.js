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

export function bucketByDate(items = []) {
  const map = {};
  for (const item of items) {
    if (!item?.date) continue;
    const key = String(item.date).slice(0, 10);
    (map[key] = map[key] || []).push(item);
  }
  return map;
}

export function calendarItems({ teams, events, tasks, matches, members }) {
  const teamName = (id) => teams.find((t) => t.id === id)?.name || 'Team';
  const items = [];
  for (const event of events || []) {
    if (!event?.date) continue;
    items.push({
      date: String(event.date).slice(0, 10),
      time: event.time || '',
      type: event.type || 'other',
      title: event.title || event.type || 'Event',
      teamName: teamName(event.team_id),
    });
  }
  for (const match of matches || []) {
    const date = match.date || match.match_date;
    if (!date) continue;
    items.push({
      date: String(date).slice(0, 10),
      type: 'match',
      title: match.opponent ? `vs ${match.opponent}` : 'Match',
      teamName: teamName(match.team_id),
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
      people: assignee?.gamertag ? [assignee.gamertag] : [],
    });
  }
  return items;
}
