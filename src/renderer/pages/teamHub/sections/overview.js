import {
  el, icon, fmtStamp, teamWinRate, teamKD, statsByKey, pctDelta, round, advancedMetricsForMode,
} from '../../../utils.js';
import { kpi, metricRow, miniEmpty, MODES, modeKeyFor } from '../parts.js';
import { scoreboardDrop } from '../../../components/scoreboardDrop.js';

const RECENT_WINDOW = 5;

export async function render(root, hub) {
  const [matches, strats, ruleset, notes, boards] = await Promise.all([
    window.cci.getMatches(hub.team.id),
    window.cci.getStrats(hub.team.id),
    window.cci.getCdlRuleset(),
    window.cci.getNotes(hub.team.id),
    window.cci.listScoreboards(hub.team.id).catch(() => []),
  ]);

  const activeMaps = (ruleset?.maps || []).filter((m) => m.active !== false);

  if (hub.ctxToggle) {
    root.append(el('div', { class: 'hub-head', style: 'justify-content:flex-end;' }, [
      el('div', { class: 'page-header-actions' }, [hub.ctxToggle]),
    ]));
  }
  root.append(kpiRow(hub, { matches, strats, activeMaps }));
  root.append(scoreboardCard(hub, boards));

  const grid = el('div', { class: 'grid cols-2', style: 'margin-bottom:14px;' });
  grid.append(seasonSummary(matches));
  grid.append(notesCard(hub, notes));
  root.append(grid);

  root.append(mapPoolCard(hub, { activeMaps, matches, strats, ruleset }));
  root.append(advancedStatsCard(matches, ruleset));
}

function metricRowsFor(mode, m) {
  if (mode === 'Hardpoint') return [['Hold %', m.hold_pct], ['Break %', m.break_pct], ['Rotation %', m.rotation_pct]];
  if (mode === 'Search & Destroy') {
    return [
      ['Offense Win %', m.offense_win_pct],
      ['Defense Win %', m.defense_win_pct],
      ['First Blood Conv. %', m.first_blood_conversion_pct],
      ['First Death Rec. %', m.first_death_recovery_pct],
      ['Plant %', m.plant_pct],
      ['Post-Plant Win %', m.post_plant_win_pct],
      ['Retake %', m.retake_pct],
    ];
  }
  if (mode === 'Overload') return [['Scoring Efficiency %', m.scoring_efficiency_pct], ['Defensive Stop %', m.defensive_stop_pct]];
  return [];
}

function advancedStatsCard(matches, ruleset) {
  const card = el('div', { class: 'card compact', style: 'margin-top:14px;' });
  card.append(el('div', { class: 'card-head' }, [el('h2', {}, 'Advanced Stats')]));

  const rulesetModes = ruleset?.modes || ['Hardpoint', 'Search & Destroy', 'Overload'];
  const availableModes = rulesetModes.filter((mode) => advancedMetricsForMode(matches, mode));
  if (!availableModes.length) {
    card.append(
      miniEmpty(
        'No advanced stats yet',
        'Open a match and add hold/break/rotation, opening-duel, or scoring detail under "Advanced Stats" to see hold %, break %, retake %, and more here.'
      )
    );
    return card;
  }

  const tabs = el('div', { class: 'filter-bar' });
  const body = el('div', {});
  card.append(tabs, body);
  let active = availableModes[0];

  function drawTabs() {
    tabs.innerHTML = '';
    for (const mode of availableModes) {
      tabs.append(
        el(
          'button',
          {
            type: 'button',
            class: `mode-chip${mode === active ? ' active' : ''}`,
            'aria-pressed': String(mode === active),
            onclick: () => { active = mode; drawTabs(); drawBody(); },
          },
          mode
        )
      );
    }
  }

  function drawBody() {
    body.innerHTML = '';
    const m = advancedMetricsForMode(matches, active);
    const rows = metricRowsFor(active, m).filter(([, value]) => value !== undefined);
    body.append(
      el(
        'div',
        { class: 'grid cols-3' },
        rows.map(([label, value]) =>
          el('div', { class: 'card stat-card', style: 'padding:12px 14px;' }, [
            el('div', { class: 'stat-label' }, label),
            el('div', { class: 'stat-value', style: 'font-size:17px;' }, value === null ? '—' : `${value}%`),
          ])
        )
      ),
      el('div', { class: 'field-hint', style: 'margin-top:8px;' }, `From ${m.sample} match${m.sample === 1 ? '' : 'es'} with advanced stats recorded.`)
    );
  }

  drawTabs();
  drawBody();
  return card;
}

function kpiRow(hub, { matches, strats, activeMaps }) {
  const liveStrats = strats.filter((s) => String(s.status).toUpperCase() !== 'ARCHIVED');
  return el('div', { class: 'kpi-row' }, [
    kpi({
      label: 'Strats',
      value: liveStrats.length,
      meta: strats.length === liveStrats.length ? 'Active playbook' : `${strats.length - liveStrats.length} archived`,
      accent: true,
      onClick: () => hub.openPlaybooks(),
    }),
    kpi({
      label: 'Maps',
      value: activeMaps.length,
      meta: 'CDL pool',
      onClick: hub.canEdit ? () => hub.navigate('maps-modes', hub.team.id) : undefined,
    }),
    kpi({
      label: 'Matches',
      value: matches.length,
      meta: matches.length ? `Season · ${teamWinRate(matches)}% win rate` : 'None logged',
      onClick: () => hub.navigate('matches', hub.team.id),
    }),
    // Scheduling has no data model yet, so this states that rather than
    // inventing a countdown.
    kpi({ label: 'Next Match', value: '—', meta: 'Not scheduled', disabled: true }),
  ]);
}

function scoreboardCard(hub, boards) {
  const count = (boards || []).length;
  return el('div', { class: 'card sb-drop-card', style: 'margin-bottom:14px;' }, [
    el('div', { class: 'card-head' }, [
      el('h2', {}, 'Scoreboard inbox'),
      el('button', { class: 'btn subtle sm', onclick: () => hub.navigate('needs-review', hub.team.id) },
        count ? `${count} waiting →` : 'Open inbox →'),
    ]),
    scoreboardDrop({
      teamId: hub.team.id,
      compact: true,
      onImported: () => hub.go('overview'),
    }),
  ]);
}

function seasonSummary(matches) {
  const card = el('div', { class: 'card compact' }, [
    el('div', { class: 'card-head' }, [el('h2', {}, 'Season Summary')]),
  ]);

  if (!matches.length) {
    card.append(miniEmpty('No matches logged', 'Win rate, K/D and form appear once matches are recorded.'));
    return card;
  }

  const recent = matches.slice(0, RECENT_WINDOW);
  const wins = matches.filter((m) => m.result === 'Win').length;
  const winRate = teamWinRate(matches);
  const kdAll = teamKD(matches);

  card.append(metricRow('Win Rate', `${winRate}%`, pctDelta(teamWinRate(recent), winRate)));
  card.append(metricRow('Avg K/D', kdAll.toFixed(2), pctDelta(teamKD(recent), kdAll)));
  card.append(metricRow('Record', `${wins}W–${matches.length - wins}L`, null));

  const form = matches.slice(0, 8);
  card.append(
    el('div', {}, [
      el('div', { class: 'field-hint', style: 'margin-top:12px;' }, `Last ${form.length} matches — newest first`),
      el(
        'div',
        { class: 'form-strip' },
        form.map((m) =>
          el('span', { class: `form-cell ${m.result === 'Win' ? 'win' : 'loss'}`, title: `${m.map} · ${m.mode}` },
            m.result === 'Win' ? 'W' : 'L')
        )
      ),
    ])
  );
  return card;
}

function notesCard(hub, notes) {
  const card = el('div', { class: 'card compact' }, [
    el('div', { class: 'card-head' }, [
      el('h2', {}, 'Team Notes'),
      el('button', { class: 'btn subtle sm edit-only', onclick: () => hub.go('notes', 'new') }, '+ New note'),
    ]),
  ]);

  if (!notes.length) {
    card.append(
      miniEmpty(
        'No notes yet',
        'Capture practice focus, scrim takeaways and map issues so they survive the week.',
        el('button', { class: 'btn primary sm edit-only', onclick: () => hub.go('notes', 'new') }, 'Write first note')
      )
    );
    return card;
  }

  for (const note of notes.slice(0, 5)) {
    card.append(
      el('button', { type: 'button', class: 'note-row', onclick: () => hub.go('notes', note.note_id) }, [
        el('div', { class: 'note-title' }, note.title),
        el('div', { class: 'note-meta' }, `${note.author} · ${fmtStamp(note.updated_at)}`),
      ])
    );
  }
  if (notes.length > 5) {
    card.append(
      el('button', { class: 'btn subtle sm', style: 'margin-top:10px;', onclick: () => hub.go('notes') },
        `View all ${notes.length} notes →`)
    );
  }
  return card;
}

function mapPoolCard(hub, { activeMaps, matches, strats, ruleset }) {
  const card = el('div', { class: 'card compact' });
  const head = el('div', { class: 'card-head' }, [
    el('h2', {}, 'Map Pool'),
    el('button', { class: 'btn subtle sm edit-only', onclick: () => hub.navigate('maps-modes', hub.team.id) }, 'Manage maps →'),
  ]);
  card.append(head);

  if (!activeMaps.length) {
    card.append(miniEmpty('No active maps', 'Add maps to the CDL pool from Maps & Modes.'));
    return card;
  }

  // Only offer mode tabs the ruleset actually enables.
  const rulesetModes = ruleset?.modes || [];
  const modes = MODES.filter((m) => rulesetModes.includes(m.mode));
  const tabs = el('div', { class: 'filter-bar' });
  const grid = el('div', { class: 'pool-grid' });
  card.append(tabs, grid);

  let active = modes[0]?.mode || null;

  function drawTabs() {
    tabs.innerHTML = '';
    for (const m of modes) {
      tabs.append(
        el(
          'button',
          {
            type: 'button',
            class: `mode-chip${m.mode === active ? ' active' : ''}`,
            'aria-pressed': String(m.mode === active),
            onclick: () => {
              active = m.mode;
              drawTabs();
              drawGrid();
            },
          },
          m.label
        )
      );
    }
  }

  function drawGrid() {
    grid.innerHTML = '';
    const modeMaps = activeMaps.filter((m) => (m.modes || []).includes(active));
    if (!modeMaps.length) {
      grid.append(el('div', { class: 'field-hint' }, `No maps enabled for ${active}.`));
      return;
    }
    const modeMatches = matches.filter((m) => m.mode === active);
    const byMap = Object.fromEntries(statsByKey(modeMatches, (m) => m.map).map((s) => [s.key, s]));

    for (const map of modeMaps) {
      const stat = byMap[map.name];
      const stratCount = strats.filter((s) => s.map === map.name && s.mode === active).length;
      grid.append(
        el(
          'button',
          {
            type: 'button',
            class: 'pool-tile',
            title: `${map.name} — ${active}`,
            onclick: () => {
              const key = modeKeyFor(active);
              return key ? hub.openPlaybooks('mode', key) : hub.openPlaybooks();
            },
          },
          [
            el('div', { class: 'pool-name' }, map.name),
            el('div', { class: 'pool-stats' }, [
              stat
                ? el('span', { class: 'pool-wr' }, `${stat.winRate}%`)
                : el('span', { class: 'pool-wr none' }, 'No data'),
              el('span', { class: 'pool-sub' }, stat ? `${stat.total} played` : ''),
            ]),
            el('div', { class: 'pool-sub', style: 'margin-top:2px;' },
              `${stratCount} strat${stratCount === 1 ? '' : 's'}`),
            el('div', { class: 'pool-bar' }, [
              el('span', { style: `width:${stat ? Math.max(3, round(stat.winRate, 0)) : 0}%;` }),
            ]),
          ]
        )
      );
    }
  }

  drawTabs();
  drawGrid();
  return card;
}
