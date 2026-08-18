// Learns veto habits from saved plans and opponent history. Pure and DOM-free:
// the UI asks for a profile, then asks what to highlight on the current step.

function normName(name) {
  return String(name || '').trim().toLowerCase();
}

function hasMaps(veto) {
  return (veto.steps || []).some((s) => s.map);
}

/**
 * Merge this team's saved plans with every opponent's veto_history, de-duped
 * by veto_id so a plan that was synced onto a scout card is not counted twice.
 */
export function collectVetoes({ teamVetoes = [], opponents = [] } = {}) {
  const fromHistory = [];
  for (const opp of opponents) {
    for (const row of opp.veto_history || []) {
      fromHistory.push({ ...row, opponent: row.opponent || opp.name });
    }
  }
  const seen = new Set();
  const all = [];
  for (const veto of [...teamVetoes, ...fromHistory]) {
    const key = veto.veto_id || `${normName(veto.opponent)}:${veto.recorded_at || veto.updated_at || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    all.push(veto);
  }
  return all;
}

function tally(vetoes, predicate) {
  const counts = {};
  for (const veto of vetoes) {
    for (const step of veto.steps || []) {
      if (!step.map || !predicate(step, veto)) continue;
      const key = `${step.mode}::${step.map}`;
      counts[key] = counts[key] || { map: step.map, mode: step.mode, n: 0 };
      counts[key].n += 1;
    }
  }
  return Object.values(counts).sort((a, b) => b.n - a.n || a.map.localeCompare(b.map));
}

function firstBansBy(vetoes, team) {
  const counts = {};
  for (const veto of vetoes) {
    const seen = new Set();
    for (const step of veto.steps || []) {
      if (step.action !== 'ban' || step.team !== team || !step.map) continue;
      if (seen.has(step.mode)) continue;
      seen.add(step.mode);
      const key = `${step.mode}::${step.map}`;
      counts[key] = counts[key] || { map: step.map, mode: step.mode, n: 0 };
      counts[key].n += 1;
    }
  }
  return Object.values(counts).sort((a, b) => b.n - a.n || a.map.localeCompare(b.map));
}

export function profileFromVetoes(vetoes = []) {
  const rows = vetoes.filter(hasMaps);
  return {
    sample: rows.length,
    theirBans: tally(rows, (s) => s.action === 'ban' && s.team === 'them'),
    theirPicks: tally(rows, (s) => s.action === 'pick' && s.team === 'them'),
    ourBans: tally(rows, (s) => s.action === 'ban' && s.team === 'us'),
    ourPicks: tally(rows, (s) => s.action === 'pick' && s.team === 'us'),
    theirFirstBans: firstBansBy(rows, 'them'),
    ourFirstBans: firstBansBy(rows, 'us'),
    theyWentFirst: rows.filter((v) => v.first === 'them').length,
    weWentFirst: rows.filter((v) => v.first === 'us').length,
  };
}

export function intelForOpponent(name, allVetoes = []) {
  const key = normName(name);
  const mine = key ? allVetoes.filter((v) => normName(v.opponent) === key) : [];
  const others = key ? allVetoes.filter((v) => normName(v.opponent) !== key) : allVetoes;
  return {
    opponent: String(name || '').trim(),
    known: mine.length > 0,
    sample: mine.length,
    profile: profileFromVetoes(mine),
    league: profileFromVetoes(others.length ? others : allVetoes),
  };
}

function takeFrom(rows, mode, pool, why, source, limit = 3) {
  return (rows || [])
    .filter((row) => row.mode === mode && pool.has(row.map))
    .slice(0, limit)
    .map((row) => ({ map: row.map, n: row.n, why, source }));
}

/**
 * Maps worth highlighting on the current step. Known-opponent data wins;
 * league-wide habits fill in when this opponent is new.
 */
export function suggestForStep(intel, step, available = []) {
  if (!step || !available.length) return [];
  const pool = new Set(available);
  const known = intel?.known && intel.profile.sample > 0;
  const profile = known ? intel.profile : intel?.league;
  const source = known ? 'vs them' : 'league';
  if (!profile) return [];

  if (step.action === 'ban' && step.team === 'us') {
    return takeFrom(profile.theirPicks, step.mode, pool, 'They pick this', source);
  }
  if (step.action === 'ban' && step.team === 'them') {
    const first = takeFrom(profile.theirFirstBans, step.mode, pool, 'Their first ban', source);
    return first.length ? first : takeFrom(profile.theirBans, step.mode, pool, 'They ban this', source);
  }
  if (step.action === 'pick' && step.team === 'us') {
    const denied = takeFrom(profile.theirBans, step.mode, pool, 'They ban this', source);
    return denied.length ? denied : takeFrom(profile.ourPicks, step.mode, pool, 'We take this', source);
  }
  if (step.action === 'pick' && step.team === 'them') {
    return takeFrom(profile.theirPicks, step.mode, pool, 'They take this', source);
  }
  return [];
}

// ---------- Win-rate-based recommendation ----------
//
// Deliberately separate from the habit-frequency hints above, which answer
// "what does this opponent tend to ban/pick". This answers "how would we
// likely fare" — from OUR real match record on the map, plus the opponent's
// coach-entered threat rating (there is no real opponent win-rate data
// source in this app, so one is never invented). Every claim traces back to
// a real number or an explicit "no data" — never a black-box verdict.

export function mapRecommendation({ map, mode, matches = [], opponent = null }) {
  const modeMatches = matches.filter((m) => m.map === map && m.mode === mode);
  const wins = modeMatches.filter((m) => m.result === 'Win').length;
  const total = modeMatches.length;
  const winRate = total ? Math.round((wins / total) * 100) : null;

  const note = opponent?.map_notes?.find((n) => n.map === map && n.mode === mode) || null;
  const threat = note?.threat || null;

  let confidence = 'INSUFFICIENT DATA';
  if (total >= 5) confidence = 'HIGH';
  else if (total >= 2) confidence = 'MEDIUM';
  else if (total >= 1) confidence = 'LOW';

  const reasons = [];
  let lean = null;

  if (winRate !== null) {
    reasons.push(`Our record: ${wins}-${total - wins} (${winRate}%) over ${total} match${total === 1 ? '' : 'es'}.`);
    if (total >= 2 && winRate >= 60) lean = 'pick';
    else if (total >= 2 && winRate <= 40) lean = 'ban';
  } else {
    reasons.push('No matches logged yet on this map/mode.');
  }

  if (threat === 'high') {
    reasons.push(`Opponent threat rated HIGH${note.note ? ` — ${note.note}` : ''}.`);
    if (lean === 'pick') reasons.push('Our win rate says pick, but the opponent threat rating says be careful here.');
    else if (!lean) lean = 'ban';
  } else if (threat === 'low') {
    reasons.push(`Opponent threat rated LOW${note.note ? ` — ${note.note}` : ''}.`);
    if (!lean && (winRate === null || winRate >= 50)) lean = 'pick';
  } else if (threat === 'medium' && note?.note) {
    reasons.push(`Opponent threat rated MEDIUM — ${note.note}.`);
  }

  return { map, mode, winRate, total, threat, confidence, lean, reasons };
}

export function summaryLines(intel, limit = 3) {
  if (!intel) return [];
  const lines = [];
  const profile = intel.known ? intel.profile : intel.league;
  const who = intel.known ? intel.opponent : 'The league';
  if (!profile || !profile.sample) return [];

  const first = profile.theirFirstBans[0];
  if (first) lines.push(`${who} first-bans ${first.map} in ${first.mode} (${first.n}/${profile.sample}).`);

  const pick = profile.theirPicks[0];
  if (pick) lines.push(`Comfort pick: ${pick.map} ${pick.mode} (${pick.n}).`);

  const ban = profile.theirBans.find((row) => !first || row.map !== first.map || row.mode !== first.mode);
  if (ban) lines.push(`Also banned: ${ban.map} ${ban.mode} (${ban.n}).`);

  if (!intel.known && intel.league.sample) {
    lines.unshift(`No book on ${intel.opponent || 'this opponent'} yet. Using ${intel.league.sample} saved vetoes against other teams.`);
  } else if (intel.known) {
    lines.unshift(`${profile.sample} saved veto${profile.sample === 1 ? '' : 'es'} vs ${intel.opponent}.`);
  }
  return lines.slice(0, limit);
}
