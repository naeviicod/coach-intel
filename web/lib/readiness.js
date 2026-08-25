// Map/mode readiness — how prepared the team actually is for a specific
// map+mode, computed from workflow completion (strategy prepared/approved,
// opponent reviewed, VOD reviewed, our own match sample), not from win rate
// alone. Every signal traces back to a real record; nothing here is guessed.

const READY_STATUSES = ['APPROVED', 'MATCH READY', 'IN PRACTICE'];

export function mapReadiness(map, mode, { strats = [], vods = [], opponent = null, matches = [] } = {}) {
  const mapStrats = strats.filter((s) => s.map === map && s.mode === mode);
  const hasStrat = mapStrats.length > 0;
  const hasApprovedStrat = mapStrats.some((s) => READY_STATUSES.includes(String(s.status || '').toUpperCase()));
  const hasVod = vods.some((v) => v.map === map && v.mode === mode);
  const oppNote = opponent?.map_notes?.find((n) => n.map === map && n.mode === mode) || null;
  const ourMatches = matches.filter((m) => m.map === map && m.mode === mode);

  const signals = [
    { key: 'strategy', label: 'Strategy prepared', done: hasStrat },
    { key: 'strategy_approved', label: 'Strategy approved', done: hasApprovedStrat },
    { key: 'opponent', label: 'Opponent reviewed', done: !!oppNote },
    { key: 'vod', label: 'VOD reviewed', done: hasVod },
    { key: 'sample', label: 'Our own match sample', done: ourMatches.length > 0 },
  ];
  const score = Math.round((signals.filter((s) => s.done).length / signals.length) * 100);
  return { map, mode, score, signals, stratCount: mapStrats.length, ourMatches: ourMatches.length, threat: oppNote?.threat || null };
}

export function poolReadiness(pool, { strats, vods, opponent, matches } = {}) {
  return pool.map(({ map, mode }) => mapReadiness(map, mode, { strats, vods, opponent, matches }));
}

export function overallReadiness(rows) {
  if (!rows.length) return null;
  return Math.round(rows.reduce((sum, r) => sum + r.score, 0) / rows.length);
}
