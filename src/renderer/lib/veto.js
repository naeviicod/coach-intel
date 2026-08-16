// Veto Lab logic — pure, DOM-free, so it can be unit tested directly.
//
// A CDL series fixes the mode order (Game 1 Hardpoint, Game 2 Search & Destroy,
// and so on). Map selection is a ban/pick walk over each mode's pool. This module
// turns a format + the available map pools into an ordered list of steps; the UI
// assigns a map to each step and reads the resulting series back out.

// The competitive mode pattern per format. Names match the CDL ruleset's modes so
// the pools line up; unknown modes fall back to cycling whatever the ruleset has.
export const VETO_FORMATS = [
  { key: 'Bo3', label: 'Best of 3', pattern: ['Hardpoint', 'Search & Destroy', 'Overload'] },
  { key: 'Bo5', label: 'Best of 5', pattern: ['Hardpoint', 'Search & Destroy', 'Overload', 'Hardpoint', 'Search & Destroy'] },
  {
    key: 'Bo7',
    label: 'Best of 7',
    pattern: ['Hardpoint', 'Search & Destroy', 'Overload', 'Hardpoint', 'Search & Destroy', 'Overload', 'Hardpoint'],
  },
];

export function formatByKey(key) {
  return VETO_FORMATS.find((f) => f.key === key) || VETO_FORMATS[1];
}

// The ordered mode list for a series. Where the ruleset renames or is missing a
// mode, the slot is filled by cycling the ruleset's own modes so the tool never
// references a mode with no map pool.
export function seriesModes(formatKey, rulesetModes = []) {
  const format = formatByKey(formatKey);
  const available = rulesetModes.length ? rulesetModes : format.pattern;
  return format.pattern.map((mode, i) => (available.includes(mode) ? mode : available[i % available.length]));
}

// De-duplicated modes in first-appearance order, with how many games each needs.
export function modeBreakdown(modes) {
  const games = {};
  const order = [];
  for (const mode of modes) {
    if (!(mode in games)) order.push(mode);
    games[mode] = (games[mode] || 0) + 1;
  }
  return { order, games };
}

/**
 * Ordered ban/pick steps for a series.
 *
 * Turns alternate globally, starting with `first`. Within each mode the pool is
 * banned down until only the required number of picks remain, then those are
 * picked — the same shape a real veto takes.
 *
 * @returns {{ steps: Array<{action:'ban'|'pick', team:'us'|'them', mode:string, map:null}>, order: string[], games: Record<string,number> }}
 */
export function buildVetoSequence({ modes, poolsByMode = {}, first = 'us' }) {
  const { order, games } = modeBreakdown(modes);
  const steps = [];
  let turn = first === 'them' ? 'them' : 'us';
  const take = () => {
    const t = turn;
    turn = turn === 'us' ? 'them' : 'us';
    return t;
  };
  for (const mode of order) {
    const poolSize = (poolsByMode[mode] || []).length;
    const need = games[mode];
    const bans = Math.max(0, poolSize - need);
    for (let i = 0; i < bans; i++) steps.push({ action: 'ban', team: take(), mode, map: null });
    for (let i = 0; i < need; i++) steps.push({ action: 'pick', team: take(), mode, map: null });
  }
  return { steps, order, games };
}

// Maps still selectable for a step: the mode's pool minus everything already
// banned or picked in that same mode.
export function availableMaps(step, steps, poolsByMode = {}) {
  const used = new Set(steps.filter((s) => s !== step && s.mode === step.mode && s.map).map((s) => s.map));
  return (poolsByMode[step.mode] || []).filter((m) => !used.has(m));
}

// The played series in template order: Game 1..N with the map picked for each.
export function resultSeries(modes, steps) {
  const picks = {};
  for (const s of steps) {
    if (s.action === 'pick' && s.map) (picks[s.mode] = picks[s.mode] || []).push(s.map);
  }
  const cursor = {};
  return modes.map((mode, i) => {
    cursor[mode] = cursor[mode] || 0;
    const map = (picks[mode] || [])[cursor[mode]++] || null;
    return { game: i + 1, mode, map };
  });
}

export function isSequenceComplete(steps) {
  return steps.length > 0 && steps.every((s) => s.map);
}

// Adjacent steps that share a mode, in series order. The board paints one
// column per group so a Bo5 reads as HP / SnD / Overload instead of 16 rows.
export function groupStepsByMode(steps = []) {
  const groups = [];
  for (const step of steps) {
    const last = groups[groups.length - 1];
    if (!last || last.mode !== step.mode) groups.push({ mode: step.mode, steps: [step] });
    else last.steps.push(step);
  }
  return groups;
}

export const MODE_SHORT = {
  Hardpoint: 'HP',
  'Search & Destroy': 'SnD',
  Overload: 'OVL',
};

export function shortMode(mode) {
  return MODE_SHORT[mode] || String(mode || '').slice(0, 3).toUpperCase();
}
