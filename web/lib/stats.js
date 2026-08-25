export function round(num, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((num + Number.EPSILON) * factor) / factor;
}

export function kd(kills, deaths) {
  if (!deaths) return kills || 0;
  return round(kills / deaths, 2);
}

export const OBJ_STATS = {
  Hardpoint: [{ key: 'hill_time', label: 'Hill Time', short: 'Hill', duration: true }],
  'Search & Destroy': [
    { key: 'plants', label: 'Plants', short: 'Plants' },
    { key: 'defuses', label: 'Defuses', short: 'Defuses' },
  ],
  Overload: [{ key: 'drives_captured', label: 'Drives Captured', short: 'Drives' }],
};

export const OBJ_KEYS = [...new Set(Object.values(OBJ_STATS).flatMap((stats) => stats.map((s) => s.key)))];

export function fmtObj(stat, value) {
  const raw = value || 0;
  if (stat.duration) {
    const n = Math.round(raw);
    return n < 60 ? `${n}s` : `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
  }
  return String(Math.round(raw));
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
  const wins = matches.filter((m) => String(m.result || '').toLowerCase() === 'win').length;
  return round((wins / matches.length) * 100, 0);
}

export function statsByKey(matches, keyFn) {
  const map = {};
  for (const m of matches) {
    const k = keyFn(m);
    if (!map[k]) map[k] = { key: k, total: 0, wins: 0, losses: 0 };
    map[k].total += 1;
    if (String(m.result || '').toLowerCase() === 'win') map[k].wins += 1;
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
