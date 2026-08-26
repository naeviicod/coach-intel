import { seriesModes } from './veto.js';

export const BO5_KEY = 'Bo5';

export function bo5Modes(rulesetModes = []) {
  return seriesModes(BO5_KEY, rulesetModes);
}

export function emptyMapSlot(mode, index) {
  return { index, mode, map: '', result: '', score: '' };
}

export function emptyBo5(rulesetModes = []) {
  return bo5Modes(rulesetModes).map((mode, i) => emptyMapSlot(mode, i));
}

export function filledMaps(maps = []) {
  return maps.filter((slot) => slot.map || slot.score || slot.result);
}

function seriesIdFor({ teamId, date, opponent, seriesId }) {
  if (seriesId) return seriesId;
  const tag = String(opponent || 'series')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24) || 'series';
  return `series-${date || 'undated'}-${teamId}-${tag}`;
}

export function seriesMatchRecords({
  teamId,
  opponent,
  date,
  seriesId,
  maps,
  playersByGame = {},
  scoreboardByGame = {},
}) {
  const series_id = seriesIdFor({ teamId, date, opponent, seriesId });
  return filledMaps(maps).map((slot) => {
    const game = slot.index + 1;
    const id = `${series_id}-g${game}`;
    return {
      id,
      teamId,
      payload: {
        match_id: id,
        series_id,
        game,
        format: BO5_KEY,
        team_id: teamId,
        opponent,
        date,
        map: slot.map,
        mode: slot.mode,
        result: slot.result,
        score: slot.score,
        players: playersByGame[game] || playersByGame[slot.index] || [],
        scoreboard_path: scoreboardByGame[game] || scoreboardByGame[slot.index] || '',
      },
    };
  });
}

export function findSeriesMatch(matches, { teamId, date, game, mode, map, seriesId }) {
  const list = matches || [];
  if (seriesId) {
    const bySeries = list.find((m) => m.series_id === seriesId && Number(m.game) === Number(game));
    if (bySeries) return bySeries;
  }
  const sameDay = list.filter((m) => m.team_id === teamId && String(m.date || '').slice(0, 10) === String(date || '').slice(0, 10));
  const byGame = sameDay.find((m) => Number(m.game) === Number(game));
  if (byGame) return byGame;
  return sameDay.find((m) => m.mode === mode && (!map || m.map === map)) || null;
}

export function nextUnfiledGame(matches, { teamId, date }) {
  const filed = new Set(
    (matches || [])
      .filter((m) => m.team_id === teamId && String(m.date || '').slice(0, 10) === String(date || '').slice(0, 10) && m.scoreboard_path)
      .map((m) => Number(m.game) || 0)
      .filter(Boolean)
  );
  for (let game = 1; game <= 5; game += 1) {
    if (!filed.has(game)) return game;
  }
  return 1;
}

export function playingRoster(members = []) {
  return members.filter((m) => m && m.slot !== 'staff' && m.slot !== 'fa');
}

export function emptyPlayerLine(member) {
  return {
    member_id: member.id,
    gamertag: member.gamertag,
    kills: 0,
    deaths: 0,
    assists: 0,
    damage: 0,
    hill_time: 0,
    rounds_won: 0,
    rounds_lost: 0,
  };
}

function norm(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function memberMatchKeys(member) {
  return [member?.gamertag, member?.name, ...(member?.aliases || [])].map(norm).filter(Boolean);
}

export function parseClockToSeconds(token) {
  const m = String(token || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function isStatToken(token) {
  return /^\d+$/.test(token) || /^\d+\/\d+$/.test(token) || /^\d+:\d{2}$/.test(token) || /^\d+-\d+$/.test(token);
}

export function matchRosterMember(name, roster) {
  const key = norm(name);
  if (!key) return null;
  const stripped = key.replace(/\d+$/, '');
  let best = null;
  let bestScore = 0;
  for (const member of roster || []) {
    for (const k of memberMatchKeys(member)) {
      if (k.length < 3) continue;
      if (k === key || (stripped && k === stripped)) return member;
      const a = stripped || key;
      if (a.length >= 3 && (k.startsWith(a) || a.startsWith(k) || k.includes(a) || a.includes(k))) {
        const score = Math.min(k.length, a.length);
        if (score > bestScore) {
          best = member;
          bestScore = score;
        }
      }
    }
  }
  return bestScore >= 4 ? best : null;
}

export function parsePlayerLine(line) {
  const tokens = String(line || '').replace(/,/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;
  const nameTokens = [];
  const statTokens = [];
  for (const token of tokens) {
    if (isStatToken(token)) statTokens.push(token);
    else if (!statTokens.length) nameTokens.push(token);
  }
  if (!nameTokens.length || !statTokens.length) return null;

  let kills = 0;
  let deaths = 0;
  let assists = 0;
  let damage = 0;
  let hill_time = 0;
  let rounds_won = 0;
  let rounds_lost = 0;
  const nums = [];
  for (const token of statTokens) {
    const clock = parseClockToSeconds(token);
    if (clock != null) {
      hill_time = clock;
      continue;
    }
    const slash = token.match(/^(\d+)\/(\d+)$/);
    if (slash) {
      kills = Number(slash[1]);
      deaths = Number(slash[2]);
      continue;
    }
    const pair = token.match(/^(\d+)-(\d+)$/);
    if (pair) {
      rounds_won = Number(pair[1]);
      rounds_lost = Number(pair[2]);
      continue;
    }
    nums.push(Number(token));
  }
  if (nums.length >= 2 && !kills && !deaths) {
    kills = nums.shift();
    deaths = nums.shift();
  }
  if (nums.length) assists = nums.shift() || 0;
  if (nums.length) {
    const next = nums.shift();
    if (next >= 200) damage = next;
    else if (!hill_time && next > 20) hill_time = next;
    else if (!rounds_won) rounds_won = next;
  }
  if (nums.length && !rounds_lost) rounds_lost = nums.shift() || 0;
  if (!kills && !deaths && !hill_time && !rounds_won) return null;
  return {
    name: nameTokens.join(' '),
    kills,
    deaths,
    assists,
    damage,
    hill_time,
    rounds_won,
    rounds_lost,
  };
}

function lineStats(parsed) {
  return {
    kills: parsed.kills || 0,
    deaths: parsed.deaths || 0,
    assists: parsed.assists || 0,
    damage: parsed.damage || 0,
    hill_time: parsed.hill_time || 0,
    rounds_won: parsed.rounds_won || 0,
    rounds_lost: parsed.rounds_lost || 0,
  };
}

export function applyScoreboardToRoster(text, members, { matchedOnly = false } = {}) {
  const roster = playingRoster(members);
  const players = roster.map(emptyPlayerLine);
  const byId = Object.fromEntries(players.map((row) => [row.member_id, row]));
  const matched = new Set();
  for (const line of String(text || '').split(/\r?\n/)) {
    const parsed = parsePlayerLine(line);
    if (!parsed) continue;
    const member = matchRosterMember(parsed.name, roster);
    if (!member) continue;
    Object.assign(byId[member.id], lineStats(parsed));
    matched.add(member.id);
  }
  if (!matchedOnly) return players;
  return players.filter((row) => matched.has(row.member_id));
}

export function guessMapFromName(filename, maps = []) {
  const stem = norm(String(filename || '').replace(/\.[^.]+$/, ''));
  if (!stem) return '';
  return maps.find((name) => stem.includes(norm(name))) || '';
}

export function guessModeFromName(filename, modes = []) {
  const stem = String(filename || '').toLowerCase();
  const aliases = [
    [/hardpoint|\bhp\b/, 'Hardpoint'],
    [/search|s&d|snd|\bsd\b/, 'Search & Destroy'],
    [/overload|\bol\b|control/, 'Overload'],
  ];
  for (const [re, mode] of aliases) {
    if (re.test(stem) && (!modes.length || modes.includes(mode))) return mode;
  }
  return '';
}

export function filedPaths(matches = []) {
  return new Set((matches || []).map((m) => m.scoreboard_path).filter(Boolean));
}

export function groupSeries(matches = []) {
  const groups = [];
  const byId = new Map();
  for (const match of matches) {
    const seriesKey = match.series_id || (match.game ? `${match.team_id}-${String(match.date || '').slice(0, 10)}-${match.opponent || ''}` : '');
    if (!seriesKey) {
      groups.push({ key: match.id || match.match_id, maps: [match], standalone: true });
      continue;
    }
    let group = byId.get(seriesKey);
    if (!group) {
      group = { key: seriesKey, maps: [], standalone: false };
      byId.set(seriesKey, group);
      groups.push(group);
    }
    group.maps.push(match);
  }
  for (const group of groups) group.maps.sort((a, b) => (Number(a.game) || 0) - (Number(b.game) || 0));
  return groups;
}
