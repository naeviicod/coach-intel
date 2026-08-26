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
    { key: 'rounds_won', label: 'Rounds Won', short: 'RW' },
    { key: 'rounds_lost', label: 'Rounds Lost', short: 'RL' },
    { key: 'plants', label: 'Plants', short: 'Plants' },
    { key: 'defuses', label: 'Defuses', short: 'Defuses' },
  ],
  Overload: [
    { key: 'rounds_won', label: 'Rounds Won', short: 'RW' },
    { key: 'rounds_lost', label: 'Rounds Lost', short: 'RL' },
    { key: 'drives_captured', label: 'Drives Captured', short: 'Drives' },
  ],
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

export function pctDelta(recent, overall) {
  if (!overall) return null;
  return round(((recent - overall) / overall) * 100, 1);
}

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

function teamObjTotal(matches, key) {
  let total = 0;
  for (const m of matches) {
    for (const p of m.players || []) total += p[key] || 0;
  }
  return total;
}

export function advancedMetricsForMode(matches, mode) {
  if (mode === 'Hardpoint') {
    const hpMatches = matches.filter((m) => m.mode === 'Hardpoint');
    const totals = sumCounters(hpMatches, 'hp', ['holds_won', 'holds_attempted', 'breaks_won', 'breaks_attempted', 'rotations_won', 'rotations_attempted']);
    if (!totals) return null;
    return {
      hold_pct: pct(totals.holds_won, totals.holds_attempted),
      break_pct: pct(totals.breaks_won, totals.breaks_attempted),
      rotation_pct: pct(totals.rotations_won, totals.rotations_attempted),
      sample: hpMatches.filter((m) => m.hp).length,
    };
  }
  if (mode === 'Search & Destroy') {
    const sndMatches = matches.filter((m) => m.mode === 'Search & Destroy');
    const totals = sumCounters(sndMatches, 'snd', [
      'offense_rounds', 'offense_round_wins', 'defense_rounds', 'defense_round_wins',
      'first_bloods', 'first_blood_wins', 'first_deaths', 'first_death_wins',
      'post_plant_rounds', 'post_plant_wins', 'retake_rounds', 'retake_wins',
    ]);
    const withCounters = sndMatches.filter((m) => m.snd);
    const plants = teamObjTotal(withCounters, 'plants');
    const offenseRounds = withCounters.reduce((sum, m) => sum + (m.snd?.offense_rounds || 0), 0);
    if (!totals && !offenseRounds) return null;
    return {
      offense_win_pct: totals ? pct(totals.offense_round_wins, totals.offense_rounds) : null,
      defense_win_pct: totals ? pct(totals.defense_round_wins, totals.defense_rounds) : null,
      first_blood_conversion_pct: totals ? pct(totals.first_blood_wins, totals.first_bloods) : null,
      first_death_recovery_pct: totals ? pct(totals.first_death_wins, totals.first_deaths) : null,
      plant_pct: offenseRounds ? pct(plants, offenseRounds) : null,
      post_plant_win_pct: totals ? pct(totals.post_plant_wins, totals.post_plant_rounds) : null,
      retake_pct: totals ? pct(totals.retake_wins, totals.retake_rounds) : null,
      sample: withCounters.length,
    };
  }
  if (mode === 'Overload') {
    const ovlMatches = matches.filter((m) => m.mode === 'Overload');
    const totals = sumCounters(ovlMatches, 'overload', ['scoring_attempts', 'scoring_wins', 'defensive_attempts', 'defensive_stops']);
    if (!totals) return null;
    return {
      scoring_efficiency_pct: pct(totals.scoring_wins, totals.scoring_attempts),
      defensive_stop_pct: pct(totals.defensive_stops, totals.defensive_attempts),
      sample: ovlMatches.filter((m) => m.overload).length,
    };
  }
  return null;
}
