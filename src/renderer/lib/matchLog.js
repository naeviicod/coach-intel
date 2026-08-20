import { leagueKey, parseMaps } from './calendar.js';

function mapKey(teamId, date, opponent, map) {
  return `${leagueKey(teamId, date, opponent)}|${String(map || '').trim().toLowerCase()}`;
}

export function inferMapMode(ruleset, mapName) {
  const name = String(mapName || '').trim().toLowerCase();
  if (!name) return '';
  const map = (ruleset?.maps || []).find((m) => String(m.name || '').trim().toLowerCase() === name && m.active !== false);
  const modes = map?.modes || [];
  return modes[0] || '';
}

export function rulesetFilterOptions(ruleset, rows = []) {
  const modeNames = [...(ruleset?.modes || [])];
  const mapNames = (ruleset?.maps || []).filter((m) => m.active !== false).map((m) => m.name).filter(Boolean);
  for (const row of rows) {
    if (row.mode && !modeNames.includes(row.mode)) modeNames.push(row.mode);
    if (row.map && !mapNames.includes(row.map)) mapNames.push(row.map);
  }
  return { modes: modeNames, maps: mapNames };
}

function scoreFrom(us, them, fallback = '') {
  if (us == null && them == null) return fallback;
  return `${us ?? 0}-${them ?? 0}`;
}

/**
 * Match Log rows: logged matches, then scrim maps, then calendar league
 * maps that are not already represented. Deduped by team + date + opponent + map.
 */
export function collectMatchLogRows({ teams = [], matchesByTeam = {}, eventsByTeam = {}, scrimsByTeam = {}, ruleset = null } = {}) {
  const rows = [];
  const seen = new Set();

  function remember(teamId, date, opponent, map) {
    const key = mapKey(teamId, date, opponent, map);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }

  for (const team of teams) {
    for (const match of matchesByTeam[team.id] || []) {
      remember(team.id, match.date, match.opponent, match.map);
      rows.push({
        ...match,
        teamId: team.id,
        teamName: team.name,
        source: 'match',
      });
    }
  }

  for (const team of teams) {
    for (const scrim of scrimsByTeam[team.id] || []) {
      if (!scrim || scrim.status === 'cancelled') continue;
      for (const game of scrim.maps || []) {
        if (!game?.map && !game?.mode) continue;
        if (!remember(team.id, scrim.date, scrim.opponent, game.map)) continue;
        rows.push({
          teamId: team.id,
          teamName: team.name,
          date: scrim.date,
          opponent: scrim.opponent || '',
          map: game.map || '',
          mode: game.mode || inferMapMode(ruleset, game.map),
          result: game.result || '',
          score: scoreFrom(game.us, game.them),
          players: [],
          source: 'scrim',
          scrim_id: scrim.scrim_id,
        });
      }
    }
  }

  for (const team of teams) {
    for (const event of eventsByTeam[team.id] || []) {
      if (!event || event.type !== 'league-match') continue;
      const maps = parseMaps(event.maps);
      const names = maps.length ? maps : [''];
      for (const mapName of names) {
        if (!remember(team.id, event.date, event.opponent, mapName)) continue;
        rows.push({
          teamId: team.id,
          teamName: team.name,
          date: event.date,
          opponent: event.opponent || '',
          map: mapName,
          mode: inferMapMode(ruleset, mapName),
          result: '',
          score: '',
          players: [],
          source: 'event',
          event_id: event.event_id,
        });
      }
    }
  }

  return rows.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return String(a.teamName || '').localeCompare(String(b.teamName || ''));
  });
}
