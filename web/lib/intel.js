import { aggregate, statsByKey, statsForMember } from './stats';

const TREND_WINDOW = 3;
const TREND_THRESHOLD = 10;
const SAMPLE_MIN = 3;
const SCRIM_SAMPLE_MIN = 3;
const SCRIM_LOSS_THRESHOLD = 60;

function groupBy(arr, fn) {
  return arr.reduce((acc, item) => {
    const key = fn(item);
    (acc[key] = acc[key] || []).push(item);
    return acc;
  }, {});
}

export function buildSignals(members, matches) {
  const signals = [];
  for (const member of members) {
    const rows = statsForMember(matches, member.id).sort((a, b) => (a.match.date < b.match.date ? -1 : 1));
    const byMode = groupBy(rows, (r) => r.match.mode);
    for (const [mode, modeRows] of Object.entries(byMode)) {
      if (modeRows.length < SAMPLE_MIN) continue;
      const overall = aggregate(modeRows);
      const recent = aggregate(modeRows.slice(-TREND_WINDOW));
      if (!overall.kd) continue;
      const delta = Math.round(((recent.kd - overall.kd) / overall.kd) * 1000) / 10;
      if (Math.abs(delta) < TREND_THRESHOLD) continue;
      const up = delta > 0;
      signals.push({
        tone: up ? 'positive' : 'risk',
        glyph: up ? '▲' : '▼',
        title: 'Performance Signal',
        body: `${member.gamertag}'s ${mode} K/D has ${up ? 'increased' : 'dropped'} ${Math.abs(delta)}% over the last ${Math.min(TREND_WINDOW, modeRows.length)} matches.`,
        weight: Math.abs(delta),
      });
    }
  }

  const mapStats = statsByKey(matches, (m) => m.map).filter((s) => s.total >= SAMPLE_MIN);
  if (mapStats.length) {
    const strongest = [...mapStats].sort((a, b) => b.winRate - a.winRate)[0];
    signals.push({
      tone: 'positive',
      glyph: '■',
      title: 'Map Signal',
      body: `${strongest.key} is the roster's strongest map — ${strongest.winRate}% win rate over ${strongest.total} matches.`,
      weight: 5,
    });
    const weakest = [...mapStats].sort((a, b) => a.winRate - b.winRate)[0];
    if (weakest.winRate < 50 && weakest.key !== strongest.key) {
      signals.push({
        tone: 'risk',
        glyph: '▼',
        title: 'Risk Alert',
        body: `${weakest.key} win rate is ${weakest.winRate}% over ${weakest.total} matches — the roster's weakest map right now.`,
        weight: 100 - weakest.winRate,
      });
    }
  }

  const ranked = members
    .map((m) => {
      const rows = statsForMember(matches, m.id);
      return { member: m, kd: aggregate(rows).kd, matches: rows.length };
    })
    .filter((r) => r.kd > 0 && r.matches >= SAMPLE_MIN)
    .sort((a, b) => b.kd - a.kd);
  if (ranked.length >= 2) {
    const sample = Math.min(ranked[0].matches, ranked[1].matches);
    signals.push({
      tone: 'insight',
      glyph: '◆',
      title: 'Roster Insight',
      body: `${ranked[0].member.gamertag} + ${ranked[1].member.gamertag} currently produce the roster's strongest combined K/D, over at least ${sample} matches each.`,
      weight: 4,
    });
  }
  return signals.sort((a, b) => b.weight - a.weight);
}

export function buildScrimSignals(scrims) {
  const signals = [];
  const completed = (scrims || []).filter((s) => s.status === 'completed');
  const mapRows = completed.flatMap((s) => (s.maps || []).filter((m) => m.result).map((m) => ({ ...m, opponent: s.opponent })));
  const byMapMode = groupBy(mapRows, (m) => `${m.map || 'Unknown'}::${m.mode || 'Unknown'}`);
  for (const [key, rows] of Object.entries(byMapMode)) {
    if (rows.length < SCRIM_SAMPLE_MIN) continue;
    const losses = rows.filter((r) => r.result === 'Loss');
    const lossRate = Math.round((losses.length / rows.length) * 100);
    if (lossRate < SCRIM_LOSS_THRESHOLD) continue;
    const [map, mode] = key.split('::');
    signals.push({
      tone: 'risk',
      glyph: '▼',
      title: 'Scrim Pattern',
      body: `${map} ${mode} is a recurring scrim loss — ${losses.length} of ${rows.length} scrim maps lost.`,
      weight: lossRate,
    });
  }
  return signals.sort((a, b) => b.weight - a.weight);
}
