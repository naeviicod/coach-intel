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
