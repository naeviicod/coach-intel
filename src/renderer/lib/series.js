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

export function parsePlayerLine(line) {
  const parts = String(line || '').trim().split(/\s+/);
  if (parts.length < 3) return null;
  const nums = [];
  const nameParts = [];
  for (const part of parts) {
    if (/^\d+$/.test(part)) nums.push(Number(part));
    else if (!nums.length) nameParts.push(part);
  }
  if (!nameParts.length || nums.length < 2) return null;
  return {
    name: nameParts.join(' '),
    kills: nums[0] || 0,
    deaths: nums[1] || 0,
    assists: nums[2] || 0,
    damage: nums[3] || 0,
  };
}

export function applyScoreboardToRoster(text, members) {
  const roster = playingRoster(members);
  const players = roster.map(emptyPlayerLine);
  const byId = Object.fromEntries(players.map((row) => [row.member_id, row]));
  const byKey = new Map();
  for (const member of roster) {
    for (const key of memberMatchKeys(member)) byKey.set(key, member);
  }
  for (const line of String(text || '').split(/\r?\n/)) {
    const parsed = parsePlayerLine(line);
    if (!parsed) continue;
    const key = norm(parsed.name);
    let member = byKey.get(key);
    if (!member) {
      member = roster.find((row) => memberMatchKeys(row).some((k) => k && (key.includes(k) || k.includes(key))));
    }
    if (!member) continue;
    Object.assign(byId[member.id], {
      kills: parsed.kills,
      deaths: parsed.deaths,
      assists: parsed.assists,
      damage: parsed.damage,
    });
  }
  return players;
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
