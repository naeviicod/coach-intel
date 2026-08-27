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

export function groupMatchLogRows(rows = []) {
  const groups = [];
  const byKey = new Map();
  for (const row of rows) {
    const date = String(row.date || '').slice(0, 10);
    const key = row.series_id || `${row.teamId || row.team_id || ''}|${date}|${row.opponent || ''}`;
    let group = byKey.get(key);
    if (!group) {
      group = { key, maps: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.maps.push(row);
  }
  for (const group of groups) {
    group.maps.sort((a, b) => (Number(a.game) || 0) - (Number(b.game) || 0) || String(a.map || '').localeCompare(String(b.map || '')));
    group.head = group.maps[0];
    group.wins = group.maps.filter((m) => String(m.result || '').toLowerCase() === 'win').length;
    group.losses = group.maps.filter((m) => String(m.result || '').toLowerCase() === 'loss').length;
    group.seriesScore = group.wins || group.losses ? `${group.wins}-${group.losses}` : '';
  }
  return groups;
}

export function advancedStatsFields(mode) {
  if (mode === 'Hardpoint') {
    return {
      key: 'hp',
      fields: [
        [{ key: 'holds_won', label: 'Holds Won', type: 'number', placeholder: '0' }, { key: 'holds_attempted', label: 'Holds Attempted', type: 'number', placeholder: '0' }],
        [{ key: 'breaks_won', label: 'Breaks Won', type: 'number', placeholder: '0' }, { key: 'breaks_attempted', label: 'Breaks Attempted', type: 'number', placeholder: '0' }],
        [{ key: 'rotations_won', label: 'Rotations Won', type: 'number', placeholder: '0' }, { key: 'rotations_attempted', label: 'Rotations Attempted', type: 'number', placeholder: '0' }],
      ],
    };
  }
  if (mode === 'Search & Destroy') {
    return {
      key: 'snd',
      fields: [
        [{ key: 'offense_rounds', label: 'Offense Rounds', type: 'number', placeholder: '0' }, { key: 'offense_round_wins', label: 'Offense Rounds Won', type: 'number', placeholder: '0' }],
        [{ key: 'defense_rounds', label: 'Defense Rounds', type: 'number', placeholder: '0' }, { key: 'defense_round_wins', label: 'Defense Rounds Won', type: 'number', placeholder: '0' }],
        [{ key: 'first_bloods', label: 'First Bloods', type: 'number', placeholder: '0' }, { key: 'first_blood_wins', label: 'First Blood → Round Won', type: 'number', placeholder: '0' }],
        [{ key: 'first_deaths', label: 'First Deaths', type: 'number', placeholder: '0' }, { key: 'first_death_wins', label: 'First Death → Round Won', type: 'number', placeholder: '0' }],
        [{ key: 'post_plant_rounds', label: 'Rounds Planted', type: 'number', placeholder: '0' }, { key: 'post_plant_wins', label: 'Post-Plant Wins', type: 'number', placeholder: '0' }],
        [{ key: 'retake_rounds', label: 'Retake Rounds', type: 'number', placeholder: '0' }, { key: 'retake_wins', label: 'Retakes Won', type: 'number', placeholder: '0' }],
      ],
    };
  }
  if (mode === 'Overload') {
    return {
      key: 'overload',
      fields: [
        [{ key: 'scoring_attempts', label: 'Scoring Attempts', type: 'number', placeholder: '0' }, { key: 'scoring_wins', label: 'Scores Landed', type: 'number', placeholder: '0' }],
        [{ key: 'defensive_attempts', label: 'Defensive Attempts', type: 'number', placeholder: '0' }, { key: 'defensive_stops', label: 'Defensive Stops', type: 'number', placeholder: '0' }],
      ],
    };
  }
  return null;
}
