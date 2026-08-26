import { el, fmtDate, playerAvatar, OBJ_STATS, fmtObj } from '../utils.js';
import { pageHeader, emptyState, openForm, confirmModal, toast } from './planningShared.js';
import { openModal, modalActions } from '../components/modal.js';
import { collectMatchLogRows, rulesetFilterOptions } from '../lib/matchLog.js';
import { canAccessPage } from '../lib/access.js';
import { openLogSeries } from './logSeries.js';

const RESULTS = ['Win', 'Loss'];

function parseScore(score) {
  const m = String(score || '').match(/^\s*(-?\d+)\s*-\s*(-?\d+)\s*$/);
  return m ? { us: m[1], them: m[2] } : { us: '', them: '' };
}

export async function render(container, ctx) {
  const teams = await window.cci.getTeams();
  const teamScoped = teams.some((t) => t.id === ctx.param);
  const ruleset = teams.length ? await window.cci.getCdlRuleset() : null;

  function reload() {
    ctx.navigate('matches', ctx.param || undefined);
  }

  container.append(
    pageHeader(
      'Match Log',
      'Log a Best of 5, then drop scoreboards so player stats fill Statistics.',
      ctx.canEdit && teams.length
        ? el('button', { class: 'btn primary edit-only', onclick: () => openLogSeries({ teams, ruleset, onSaved: reload }) }, '+ Log Match')
        : null
    )
  );

  if (!teams.length) {
    container.append(emptyState('No teams yet', 'Create a team, then add a league match on the calendar or record maps in Scrim Hub.'));
    return;
  }

  const matchesByTeam = {};
  const eventsByTeam = {};
  const scrimsByTeam = {};
  await Promise.all(
    teams.map(async (team) => {
      const [matches, events, scrims] = await Promise.all([
        window.cci.getMatches(team.id),
        window.cci.getEvents(team.id),
        window.cci.getScrims(team.id),
      ]);
      matchesByTeam[team.id] = matches;
      eventsByTeam[team.id] = events;
      scrimsByTeam[team.id] = scrims;
    })
  );

  const allMatches = collectMatchLogRows({ teams, matchesByTeam, eventsByTeam, scrimsByTeam, ruleset });
  const { modes, maps } = rulesetFilterOptions(ruleset, allMatches);

  const filterBar = el('div', { class: 'filter-bar' }, [
    selectFilter('team-filter', 'All Teams', teams.map((t) => [t.id, t.name]), teamScoped ? ctx.param : ''),
    selectFilter('mode-filter', 'All Modes', modes.map((m) => [m, m])),
    selectFilter('map-filter', 'All Maps', maps.map((m) => [m, m])),
    selectFilter('result-filter', 'Any Result', [
      ['Win', 'Win'],
      ['Loss', 'Loss'],
    ]),
  ]);
  container.append(filterBar);

  const tableWrap = el('div', { class: 'card' });
  container.append(tableWrap);

  function draw() {
    const teamVal = filterBar.querySelector('#team-filter').value;
    const modeVal = filterBar.querySelector('#mode-filter').value;
    const mapVal = filterBar.querySelector('#map-filter').value;
    const resultVal = filterBar.querySelector('#result-filter').value;

    const filtered = allMatches.filter(
      (m) =>
        (!teamVal || m.teamId === teamVal) &&
        (!modeVal || m.mode === modeVal) &&
        (!mapVal || m.map === mapVal) &&
        (!resultVal || m.result === resultVal)
    );

    tableWrap.innerHTML = '';
    if (!filtered.length) {
      tableWrap.append(
        el('div', { class: 'empty-state' }, [
          el('div', { class: 'icon' }, '📋'),
          el('div', { class: 'title' }, allMatches.length ? 'No matches match these filters' : 'No matches yet'),
          allMatches.length
            ? null
            : el('div', {}, 'League matches from the calendar and maps recorded in Scrim Hub show up here automatically.'),
        ])
      );
      return;
    }

    function openRow(m) {
      const team = teams.find((t) => t.id === m.teamId);
      if (m.source === 'match' && m.match_id) {
        matchDetail(m, team, reload);
        return;
      }
      if (m.source === 'scrim') ctx.navigate('scrim-hub', m.teamId);
      // The org calendar is staff-only, so anyone else lands on the same event
      // in that team's Planner rather than being bounced to their home page.
      else if (canAccessPage(ctx.access?.role, 'calendar')) ctx.navigate('calendar', m.teamId);
      else ctx.navigate('team-hub', `${m.teamId}/practice`);
    }

    function resultCell(m) {
      if (!m.result) return '—';
      const cls = m.result === 'Win' ? 'win' : m.result === 'Loss' ? 'loss' : '';
      return el('span', { class: cls ? `pill ${cls}` : 'pill' }, m.result);
    }

    tableWrap.append(
      el('table', {}, [
        el('thead', {}, [
          el('tr', {}, [
            el('th', {}, 'Date'),
            el('th', {}, 'Team'),
            el('th', {}, 'Opponent'),
            el('th', {}, 'Mode'),
            el('th', {}, 'Map'),
            el('th', {}, 'Score'),
            el('th', {}, 'Result'),
            el('th', {}, 'Top Performer'),
            el('th', { class: 'edit-only' }, ''),
          ]),
        ]),
        el(
          'tbody',
          {},
          filtered.map((m) => {
            const top = [...(m.players || [])].sort((a, b) => (b.kills || 0) - (a.kills || 0))[0];
            const canDelete = m.source === 'match' && m.match_id;
            return el(
              'tr',
              { class: 'clickable-row', onclick: () => openRow(m) },
              [
                el('td', {}, fmtDate(m.date)),
                el('td', {}, m.teamName),
                el('td', {}, m.opponent || '—'),
                el('td', { class: 'mode-tag' }, m.mode || '—'),
                el('td', {}, m.map || '—'),
                el('td', {}, m.score || '—'),
                el('td', {}, resultCell(m)),
                el('td', {}, top ? `${top.member_id} (${top.kills || 0}K)` : '—'),
                el('td', { class: 'edit-only' }, canDelete
                  ? el(
                      'button',
                      {
                        class: 'btn subtle sm danger',
                        onclick: (e) => {
                          e.stopPropagation();
                          deleteMatch(m, reload);
                        },
                      },
                      'Delete'
                    )
                  : null),
              ]
            );
          })
        ),
      ])
    );
  }

  filterBar.querySelectorAll('select').forEach((s) => s.addEventListener('change', draw));
  draw();
}

function selectFilter(id, allLabel, options, selectedValue = '') {
  return el('select', { id }, [
    el('option', { value: '', selected: selectedValue === '' ? 'selected' : null }, allLabel),
    ...options.map(([value, label]) => el('option', { value, selected: value === selectedValue ? 'selected' : null }, label)),
  ]);
}

function deleteMatch(m, reload) {
  confirmModal({
    title: 'Delete match?',
    body: `${fmtDate(m.date)} vs ${m.opponent || 'opponent'} on ${m.map || 'this map'} will be removed, including any recorded player stats.`,
    onConfirm: async () => {
      await window.cci.deleteMatch(m.teamId, m.match_id);
      toast('Match deleted', 'ok');
      reload();
    },
  });
}

function matchFormFields(ruleset, { includeTeam, teams } = {}) {
  const modeNames = ruleset?.modes || ['Hardpoint', 'Search & Destroy', 'Overload'];
  const mapNames = (ruleset?.maps || []).filter((m) => m.active !== false).map((m) => m.name);
  const fields = [];
  if (includeTeam) {
    fields.push({ key: 'team_id', label: 'Team', type: 'select', required: true, options: teams.map((t) => [t.id, t.name]) });
  }
  fields.push(
    { key: 'opponent', label: 'Opponent', required: true, placeholder: 'Team name' },
    [
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'mode', label: 'Mode', type: 'select', options: modeNames },
    ],
    { key: 'map', label: 'Map', type: 'select', options: ['', ...mapNames] },
    { key: 'side', label: 'Side', placeholder: 'e.g. Offense, Defense, Attack (optional)' },
    [
      { key: 'us', label: 'Our Score', type: 'number', placeholder: '0' },
      { key: 'them', label: 'Their Score', type: 'number', placeholder: '0' },
    ],
    { key: 'result', label: 'Result', type: 'select', options: RESULTS }
  );
  return fields;
}

function advancedStatsFields(mode) {
  if (mode === 'Hardpoint') {
    return {
      key: 'hp',
      fields: [
        [
          { key: 'holds_won', label: 'Holds Won', type: 'number', placeholder: '0' },
          { key: 'holds_attempted', label: 'Holds Attempted', type: 'number', placeholder: '0' },
        ],
        [
          { key: 'breaks_won', label: 'Breaks Won', type: 'number', placeholder: '0' },
          { key: 'breaks_attempted', label: 'Breaks Attempted', type: 'number', placeholder: '0' },
        ],
        [
          { key: 'rotations_won', label: 'Rotations Won', type: 'number', placeholder: '0' },
          { key: 'rotations_attempted', label: 'Rotations Attempted', type: 'number', placeholder: '0' },
        ],
      ],
    };
  }
  if (mode === 'Search & Destroy') {
    return {
      key: 'snd',
      fields: [
        [
          { key: 'offense_rounds', label: 'Offense Rounds', type: 'number', placeholder: '0' },
          { key: 'offense_round_wins', label: 'Offense Rounds Won', type: 'number', placeholder: '0' },
        ],
        [
          { key: 'defense_rounds', label: 'Defense Rounds', type: 'number', placeholder: '0' },
          { key: 'defense_round_wins', label: 'Defense Rounds Won', type: 'number', placeholder: '0' },
        ],
        [
          { key: 'first_bloods', label: 'First Bloods', type: 'number', placeholder: '0' },
          { key: 'first_blood_wins', label: 'First Blood → Round Won', type: 'number', placeholder: '0' },
        ],
        [
          { key: 'first_deaths', label: 'First Deaths', type: 'number', placeholder: '0' },
          { key: 'first_death_wins', label: 'First Death → Round Won', type: 'number', placeholder: '0' },
        ],
        [
          { key: 'post_plant_rounds', label: 'Rounds Planted', type: 'number', placeholder: '0' },
          { key: 'post_plant_wins', label: 'Post-Plant Wins', type: 'number', placeholder: '0' },
        ],
        [
          { key: 'retake_rounds', label: 'Retake Rounds', type: 'number', placeholder: '0' },
          { key: 'retake_wins', label: 'Retakes Won', type: 'number', placeholder: '0' },
        ],
      ],
    };
  }
  if (mode === 'Overload') {
    return {
      key: 'overload',
      fields: [
        [
          { key: 'scoring_attempts', label: 'Scoring Attempts', type: 'number', placeholder: '0' },
          { key: 'scoring_wins', label: 'Scores Landed', type: 'number', placeholder: '0' },
        ],
        [
          { key: 'defensive_attempts', label: 'Defensive Attempts', type: 'number', placeholder: '0' },
          { key: 'defensive_stops', label: 'Defensive Stops', type: 'number', placeholder: '0' },
        ],
      ],
    };
  }
  return null;
}

function advancedStatsSummary(data, adv) {
  if (!data) return el('div', { class: 'field-hint', style: 'padding:6px 2px;' }, 'No advanced stats recorded yet.');
  const flat = adv.fields.flatMap((row) => (Array.isArray(row) ? row : [row]));
  const filled = flat.filter((f) => data[f.key] !== null && data[f.key] !== undefined);
  if (!filled.length) return el('div', { class: 'field-hint', style: 'padding:6px 2px;' }, 'No advanced stats recorded yet.');
  return el(
    'div',
    { style: 'display:grid;grid-template-columns:1fr 1fr;gap:4px 14px;font-size:12px;' },
    filled.map((f) => el('div', {}, [el('span', { style: 'opacity:.7;' }, `${f.label}: `), el('b', {}, String(data[f.key]))]))
  );
}

function advancedStatsForm(match, team, adv, onDone) {
  openForm({
    title: 'Advanced Stats',
    fields: adv.fields,
    values: match[adv.key] || {},
    onSubmit: async (values) => {
      match[adv.key] = values;
      await window.cci.saveMatch(team.id, match);
      toast('Advanced stats saved', 'ok');
      onDone();
    },
  });
}

function combineScore(us, them, fallback) {
  return us != null || them != null ? `${us ?? 0}-${them ?? 0}` : fallback || '';
}

function editMatch(match, team, reload) {
  window.cci.getCdlRuleset().then((ruleset) => {
    const { us, them } = parseScore(match.score);
    openForm({
      title: 'Edit Match',
      fields: matchFormFields(ruleset, { includeTeam: false }),
      values: { ...match, us, them },
      onSubmit: async (values) => {
        const { us: nUs, them: nThem, ...rest } = values;
        const score = combineScore(nUs, nThem, match.score);
        const updated = await window.cci.saveMatch(team.id, { ...match, ...rest, score });
        toast('Match updated', 'ok');
        reload();
        matchDetail(updated, team, reload);
      },
    });
  });
}

function matchDetail(match, team, reload) {
  const body = el('div', {});
  const overlay = openModal(body, { width: '640px' });

  async function draw() {
    body.innerHTML = '';
    const members = team ? await window.cci.getMembers(team.id) : [];
    const objStats = OBJ_STATS[match.mode] || [];

    body.append(
      el('h3', {}, `${match.map || 'Match'} · ${match.mode || ''}`),
      el('div', { class: 'field-hint', style: 'margin-bottom:14px;' }, [
        `${fmtDate(match.date)} · vs ${match.opponent || 'Unknown'}${match.score ? ` · ${match.score}` : ''} · `,
        el('span', { class: `pill ${match.result === 'Win' ? 'win' : 'loss'}` }, match.result || '—'),
      ])
    );

    const statsCard = el('div', { class: 'card compact', style: 'margin-bottom:14px;' }, [
      el('div', { class: 'card-head' }, [
        el('div', { class: 'card-title' }, 'Player Stats'),
        el(
          'button',
          { class: 'btn subtle sm edit-only', onclick: () => playerStatForm(match, team, members, null, draw) },
          '+ Add Player Stat'
        ),
      ]),
    ]);

    if (!(match.players || []).length) {
      statsCard.append(el('div', { class: 'field-hint', style: 'padding:6px 2px;' }, 'No player stats recorded yet.'));
    }
    for (const p of match.players || []) {
      const member = members.find((m) => m.id === p.member_id);
      const objBits = objStats.map((s) => `${s.short}: ${fmtObj(s, p[s.key])}`);
      statsCard.append(
        el('div', { class: 'crow' }, [
          member ? playerAvatar(member) : null,
          el('div', { class: 'crow-main' }, [
            el('div', { class: 'crow-title' }, member?.gamertag || p.member_id),
            el(
              'div',
              { class: 'crow-sub' },
              [`${p.kills || 0}K ${p.deaths || 0}D ${p.assists || 0}A · ${p.damage || 0} dmg`, ...objBits].join(' · ')
            ),
          ]),
          el('div', { class: 'crow-actions edit-only' }, [
            el(
              'button',
              { class: 'btn subtle sm', onclick: () => playerStatForm(match, team, members, p, draw) },
              'Edit'
            ),
            el(
              'button',
              {
                class: 'btn subtle sm danger',
                onclick: async () => {
                  match.players = (match.players || []).filter((pl) => pl.member_id !== p.member_id);
                  await window.cci.saveMatch(team.id, match);
                  draw();
                },
              },
              'Remove'
            ),
          ]),
        ])
      );
    }
    body.append(statsCard);

    const adv = advancedStatsFields(match.mode);
    if (adv) {
      const advCard = el('div', { class: 'card compact', style: 'margin-bottom:14px;' }, [
        el('div', { class: 'card-head' }, [
          el('div', { class: 'card-title' }, 'Advanced Stats'),
          el(
            'button',
            { class: 'btn subtle sm edit-only', onclick: () => advancedStatsForm(match, team, adv, draw) },
            match[adv.key] ? 'Edit' : '+ Add'
          ),
        ]),
      ]);
      advCard.append(advancedStatsSummary(match[adv.key], adv));
      body.append(advCard);
    }

    body.append(
      modalActions([
        el('button', { class: 'btn subtle', onclick: () => overlay.remove() }, 'Close'),
        el(
          'button',
          {
            class: 'btn subtle edit-only',
            onclick: () => {
              overlay.remove();
              editMatch(match, team, reload);
            },
          },
          'Edit Match'
        ),
        el(
          'button',
          {
            class: 'btn danger edit-only',
            onclick: () =>
              confirmModal({
                title: 'Delete match?',
                body: `${fmtDate(match.date)} vs ${match.opponent || 'opponent'} on ${match.map || 'this map'} will be removed, including any recorded player stats.`,
                onConfirm: async () => {
                  await window.cci.deleteMatch(team.id, match.match_id);
                  overlay.remove();
                  toast('Match deleted', 'ok');
                  reload();
                },
              }),
          },
          'Delete Match'
        ),
      ])
    );
  }

  draw();
}

function playerStatForm(match, team, members, existing, onDone) {
  const objStats = OBJ_STATS[match.mode] || [];
  const fields = [
    { key: 'member_id', label: 'Player', type: 'select', required: true, options: members.map((m) => [m.id, m.gamertag]) },
    [
      { key: 'kills', label: 'Kills', type: 'number', placeholder: '0' },
      { key: 'deaths', label: 'Deaths', type: 'number', placeholder: '0' },
    ],
    [
      { key: 'assists', label: 'Assists', type: 'number', placeholder: '0' },
      { key: 'damage', label: 'Damage', type: 'number', placeholder: '0' },
    ],
    ...objStats.map((s) => ({
      key: s.key,
      label: s.duration ? `${s.label} (seconds)` : s.label,
      type: 'number',
      placeholder: '0',
    })),
  ];
  openForm({
    title: existing ? 'Edit Player Stats' : 'Add Player Stats',
    fields,
    values: existing || {},
    onSubmit: async (values) => {
      const players = (match.players || []).filter((p) => p.member_id !== values.member_id);
      players.push(values);
      match.players = players;
      await window.cci.saveMatch(team.id, match);
      toast('Player stats saved', 'ok');
      onDone();
    },
  });
}
