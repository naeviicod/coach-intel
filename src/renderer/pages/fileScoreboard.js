import { el } from '../utils.js';
import { openModal, modalActions, toast } from '../components/modal.js';
import {
  applyScoreboardToRoster,
  bo5Modes,
  emptyPlayerLine,
  findSeriesMatch,
  guessMapFromName,
  nextUnfiledGame,
  playingRoster,
} from '../lib/series.js';

const MODE_SHORT = {
  Hardpoint: 'HP',
  'Search & Destroy': 'SnD',
  Overload: 'OL',
};

export async function openFileScoreboard({ item, team, onSaved }) {
  const [members, matches, ruleset] = await Promise.all([
    window.cci.getMembers(team.id),
    window.cci.getMatches(team.id),
    window.cci.getCdlRuleset(),
  ]);
  const maps = (ruleset?.maps || []).filter((m) => m.active !== false).map((m) => m.name);
  const modes = ruleset?.modes || ['Hardpoint', 'Search & Destroy', 'Overload'];
  const bo5 = bo5Modes(modes);
  const roster = playingRoster(members);
  const date = item.date || new Date().toISOString().slice(0, 10);
  const game = nextUnfiledGame(matches, { teamId: team.id, date });
  const preview = el('div', { class: 'sb-read-preview' });
  if (item.relative) {
    window.cci.dataUrlForPath(item.relative).then((url) => {
      if (url) preview.prepend(el('img', { src: url, alt: item.filename || item.name }));
    });
  }
  preview.append(el('div', { class: 'field-hint' }, item.filename || item.name));

  const opponent = el('input', { required: true, placeholder: 'Opponent' });
  const dateInput = el('input', { type: 'date', value: date });
  const gameSel = el(
    'select',
    {},
    bo5.map((mode, i) => el('option', { value: String(i + 1), selected: i + 1 === game ? 'selected' : null }, `G${i + 1} · ${MODE_SHORT[mode] || mode}`))
  );
  const mapSel = el('select', {}, [el('option', { value: '' }, '—'), ...maps.map((m) => el('option', { value: m, selected: m === guessMapFromName(item.filename || item.name, maps) ? 'selected' : null }, m))]);
  const resultSel = el('select', {}, [el('option', {}, 'Win'), el('option', {}, 'Loss')]);
  const score = el('input', { placeholder: '250-180' });
  const paste = el('textarea', { rows: 4, placeholder: 'NaeviiSZN 27/23 1:49' });

  const playerState = roster.map(emptyPlayerLine);
  const table = playerTable(playerState, bo5[game - 1] || 'Hardpoint');
  function modeForGame() {
    return bo5[Number(gameSel.value) - 1] || bo5[0] || 'Hardpoint';
  }
  gameSel.addEventListener('change', () => redrawTable(table, playerState, modeForGame()));

  const body = el('div', {});
  const overlay = openModal(body, { width: '860px' });
  body.append(el('h3', {}, 'File scoreboard into stats'));
  body.append(
    el('div', { class: 'sb-read' }, [
      preview,
      el('div', {}, [
        el('div', { class: 'inline-fields' }, [
          field('Opponent', opponent),
          field('Date', dateInput),
          field('Game', gameSel),
        ]),
        el('div', { class: 'inline-fields' }, [
          field('Map', mapSel),
          field('Result', resultSel),
          field('Points', score),
        ]),
        el('div', { class: 'field-hint', style: 'margin:8px 0;' }, 'Names are matched to this roster from the board. HP uses hill time; SnD and Overload use rounds won/lost.'),
        table,
        field('Board lines (paste to match this roster)', paste),
        el('button', {
          type: 'button',
          class: 'btn sm',
          onclick: () => {
            const next = applyScoreboardToRoster(paste.value, roster, { matchedOnly: true });
            playerState.splice(0, playerState.length, ...(next.length ? next : roster.map(emptyPlayerLine)));
            redrawTable(table, playerState, modeForGame());
          },
        }, 'Match pasted lines to roster'),
      ]),
    ])
  );
  body.append(
    modalActions([
      el('button', {
        class: 'btn subtle',
        type: 'button',
        onclick: async () => {
          await window.cci.deleteScoreboard(item.teamId || team.id, item.key || item.filename, item.bucket);
          overlay.remove();
          onSaved?.();
        },
      }, 'Remove scoreboard'),
      el('button', { class: 'btn subtle', type: 'button', onclick: () => overlay.remove() }, 'Cancel'),
      el('button', {
        class: 'btn primary',
        type: 'button',
        onclick: async () => {
          const gameNum = Number(gameSel.value) || 1;
          const mode = bo5[gameNum - 1] || bo5[0];
          const hit = findSeriesMatch(matches, { teamId: team.id, date: dateInput.value, game: gameNum, mode, map: mapSel.value });
          await window.cci.saveMatch(team.id, {
            ...(hit || {}),
            match_id: hit?.match_id || `series-${dateInput.value}-${team.id}-g${gameNum}`,
            series_id: hit?.series_id || `series-${dateInput.value}-${team.id}`,
            game: gameNum,
            format: 'Bo5',
            date: dateInput.value,
            opponent: opponent.value.trim(),
            map: mapSel.value,
            mode,
            result: resultSel.value,
            score: score.value.trim(),
            players: readPlayerInputs(table, playerState, mode),
            scoreboard_path: item.key || item.relative || '',
          });
          toast('Player stats saved', 'ok');
          overlay.remove();
          onSaved?.();
        },
      }, 'Save into stats'),
    ])
  );
}

function field(label, control) {
  return el('div', { class: 'field' }, [el('label', {}, label), control]);
}

function clockValue(seconds) {
  const n = Math.max(0, Number(seconds) || 0);
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}

function parseClockInput(value) {
  const clock = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function playerTable(rows, mode) {
  const table = el('table', { class: 'sb-stat-table' });
  redrawTable(table, rows, mode);
  return table;
}

function redrawTable(table, rows, mode) {
  const hp = mode === 'Hardpoint';
  const rounds = mode === 'Search & Destroy' || mode === 'Overload';
  table.innerHTML = '';
  table.append(
    el('thead', {}, [el('tr', {}, [
      el('th', {}, 'Player'),
      el('th', {}, 'K'),
      el('th', {}, 'D'),
      hp ? el('th', {}, 'Time') : null,
      rounds ? el('th', {}, 'Rnd W') : null,
      rounds ? el('th', {}, 'Rnd L') : null,
    ])]),
    el(
      'tbody',
      {},
      rows.map((row) =>
        el('tr', { 'data-member': row.member_id }, [
          el('td', {}, row.gamertag),
          el('td', {}, el('input', { type: 'number', min: '0', value: String(row.kills || 0) })),
          el('td', {}, el('input', { type: 'number', min: '0', value: String(row.deaths || 0) })),
          hp ? el('td', {}, el('input', { value: clockValue(row.hill_time) })) : null,
          rounds ? el('td', {}, el('input', { type: 'number', min: '0', value: String(row.rounds_won || 0) })) : null,
          rounds ? el('td', {}, el('input', { type: 'number', min: '0', value: String(row.rounds_lost || 0) })) : null,
        ])
      )
    )
  );
}

function readPlayerInputs(table, fallback, mode) {
  const hp = mode === 'Hardpoint';
  const rounds = mode === 'Search & Destroy' || mode === 'Overload';
  return [...table.querySelectorAll('tbody tr')].map((tr, i) => {
    const inputs = [...tr.querySelectorAll('input')];
    const row = {
      member_id: tr.getAttribute('data-member') || fallback[i]?.member_id,
      gamertag: fallback[i]?.gamertag,
      kills: Number(inputs[0]?.value) || 0,
      deaths: Number(inputs[1]?.value) || 0,
      assists: fallback[i]?.assists || 0,
      damage: fallback[i]?.damage || 0,
      hill_time: hp ? parseClockInput(inputs[2]?.value) : fallback[i]?.hill_time || 0,
      rounds_won: rounds ? Number(inputs[2]?.value) || 0 : fallback[i]?.rounds_won || 0,
      rounds_lost: rounds ? Number(inputs[3]?.value) || 0 : fallback[i]?.rounds_lost || 0,
    };
    return row;
  });
}
