// Pre-Match War Room — everything needed to prep for a series against one
// opponent on one screen: readiness per map, expected veto, opponent intel,
// prepared strats, and recent VOD/notes tied to them. Nothing here is
// computed from data that doesn't exist — every card has an honest empty
// state instead of a filled-in placeholder.

import { el, fmtDate, fmtStamp } from '../utils.js';
import { pageHeader, emptyState } from './planningShared.js';
import { resolveActiveTeam } from '../prefs.js';
import { intelForOpponent, summaryLines } from '../lib/vetoIntel.js';
import { mapReadiness } from '../lib/readiness.js';

export async function render(container, ctx) {
  const teams = await window.cci.getTeams();
  if (!teams.length) {
    container.append(pageHeader('War Room', 'Everything for the upcoming series, in one place'));
    container.append(emptyState('No teams yet', 'Create a team before prepping for a match.'));
    return;
  }
  const [teamId, opponentId] = (ctx.param || '').split('/');
  const active = resolveActiveTeam(teams, teamId);
  const reload = () => ctx.navigate('war-room', [active.id, opponentId].filter(Boolean).join('/'));
  await draw(container, ctx, teams, active, opponentId, reload);
}

async function draw(container, ctx, teams, active, opponentId, reload) {
  const [opponents, ruleset, matches, strats, vods, notes, vetoes] = await Promise.all([
    window.cci.getOpponents(),
    window.cci.getCdlRuleset(),
    window.cci.getMatches(active.id),
    window.cci.getStrats(active.id),
    window.cci.getVods(active.id),
    window.cci.getNotes(active.id),
    window.cci.getVetoes(active.id),
  ]);

  container.append(
    pageHeader('War Room', `${active.name} — prep for the upcoming series`)
  );

  const opponentSelect = el(
    'select',
    {
      'aria-label': 'Opponent',
      onchange: (e) => ctx.navigate('war-room', `${active.id}/${e.target.value}`),
    },
    [el('option', { value: '' }, 'Select an opponent…'), ...opponents.map((o) => el('option', { value: o.opponent_id, selected: o.opponent_id === opponentId ? 'selected' : null }, o.name))]
  );
  container.append(el('div', { class: 'filter-bar' }, [opponentSelect]));

  if (!opponents.length) {
    container.append(
      emptyState('No opponents scouted yet', 'Scout an opponent first — War Room pulls its intel, veto book and readiness from that profile.', el('button', { class: 'btn primary', onclick: () => ctx.navigate('scouting') }, 'Go to Scouting'))
    );
    return;
  }

  const opponent = opponents.find((o) => o.opponent_id === opponentId) || null;
  if (!opponent) {
    container.append(emptyState('Pick an opponent', 'Choose who you\'re about to play from the dropdown above.'));
    return;
  }

  const h2h = matches.filter((m) => (m.opponent || '').toLowerCase() === opponent.name.toLowerCase());
  const h2hWins = h2h.filter((m) => m.result === 'Win').length;
  const oppVods = vods.filter((v) => (v.opponent || '').toLowerCase() === opponent.name.toLowerCase());
  const oppNotes = notes.filter((n) => (n.links?.opponent || '').toLowerCase() === opponent.name.toLowerCase());
  const oppVetoes = [...(active ? vetoes : [])].filter((v) => (v.opponent || '').toLowerCase() === opponent.name.toLowerCase());

  const pool = [];
  for (const map of (ruleset?.maps || []).filter((m) => m.active !== false)) {
    for (const mode of map.modes || []) pool.push({ map: map.name, mode });
  }
  const readinessRows = pool.map(({ map, mode }) => mapReadiness(map, mode, { strats, vods: oppVods, opponent, matches }));
  const overall = readinessRows.length
    ? Math.round(readinessRows.reduce((sum, r) => sum + r.score, 0) / readinessRows.length)
    : null;

  container.append(
    el('div', { class: 'kpi-row' }, [
      kpiStatic('Readiness', overall === null ? '—' : `${overall}%`, `${readinessRows.length} map/mode pairs`),
      kpiStatic('Head-to-Head', `${h2hWins}-${h2h.length - h2hWins}`, `${h2h.length} matches`),
      kpiStatic('Strats Ready', strats.filter((s) => ['APPROVED', 'MATCH READY', 'IN PRACTICE'].includes(String(s.status).toUpperCase())).length, `${strats.length} total`),
      kpiStatic('Veto Book', oppVetoes.length, 'saved plans vs them'),
    ])
  );

  const grid = el('div', { class: 'grid cols-2', style: 'align-items:start;margin-bottom:14px;' });
  grid.append(readinessCard(readinessRows, ctx, active));
  grid.append(vetoCard(opponent, oppVetoes, ctx));
  container.append(grid);

  const grid2 = el('div', { class: 'grid cols-2', style: 'align-items:start;margin-bottom:14px;' });
  grid2.append(opponentIntelCard(opponent, ctx));
  grid2.append(preparedStratsCard(strats, readinessRows, ctx, active));
  container.append(grid2);

  const grid3 = el('div', { class: 'grid cols-2', style: 'align-items:start;' });
  grid3.append(vodCard(oppVods, ctx, active, opponent));
  grid3.append(notesCard(oppNotes, ctx, active));
  container.append(grid3);
}

function kpiStatic(label, value, meta) {
  return el('div', { class: 'kpi', style: 'cursor:default;' }, [
    el('div', { class: 'kpi-label' }, label),
    el('div', { class: 'kpi-value' }, String(value)),
    el('div', { class: 'kpi-meta' }, meta),
  ]);
}

function scoreColor(score) {
  if (score >= 80) return 'var(--win)';
  if (score >= 50) return '#ffb870';
  return 'var(--loss)';
}

function readinessCard(rows, ctx, team) {
  const card = el('div', { class: 'card compact' }, [el('div', { class: 'card-head' }, [el('h2', {}, 'Map Readiness')])]);
  if (!rows.length) {
    card.append(el('div', { class: 'field-hint', style: 'padding:6px 2px;' }, 'No active maps in the current CDL pool.'));
    return card;
  }
  const sorted = [...rows].sort((a, b) => a.score - b.score);
  for (const r of sorted) {
    card.append(
      el(
        'div',
        { class: 'crow', role: 'button', tabindex: '0', onclick: () => ctx.navigate('playbooks', team.id) },
        [
          el('div', { class: 'crow-main' }, [
            el('div', { class: 'crow-title' }, `${r.map} · ${r.mode}`),
            el('div', { class: 'crow-sub' }, r.signals.filter((s) => !s.done).map((s) => s.label).join(', ') || 'All signals covered'),
          ]),
          el('div', { style: `font-weight:700;font-family:var(--font-mono);color:${scoreColor(r.score)};` }, `${r.score}%`),
        ]
      )
    );
  }
  return card;
}

function vetoCard(opponent, oppVetoes, ctx) {
  const card = el('div', { class: 'card compact' }, [
    el('div', { class: 'card-head' }, [
      el('h2', {}, 'Expected Veto'),
      el('button', { class: 'btn subtle sm', onclick: () => ctx.navigate('veto-lab') }, 'Open Veto Lab →'),
    ]),
  ]);
  const intel = intelForOpponent(opponent.name, (opponent.veto_history || []).map((row) => ({ ...row, opponent: opponent.name })));
  const lines = summaryLines(intel, 4);
  if (!lines.length) {
    card.append(el('div', { class: 'field-hint', style: 'padding:6px 2px;' }, 'No veto book on this opponent yet — model one in Veto Lab.'));
    return card;
  }
  for (const line of lines) card.append(el('div', { class: 'veto-intel-line', style: 'margin-bottom:6px;' }, line));
  return card;
}

function opponentIntelCard(opponent, ctx) {
  const card = el('div', { class: 'card compact' }, [
    el('div', { class: 'card-head' }, [
      el('h2', {}, 'Opponent Intel'),
      el('button', { class: 'btn subtle sm', onclick: () => ctx.navigate('scouting', opponent.opponent_id) }, 'Full profile →'),
    ]),
  ]);
  const strong = (opponent.map_notes || []).filter((n) => n.threat === 'low').slice(0, 3);
  const weak = (opponent.map_notes || []).filter((n) => n.threat === 'high').slice(0, 3);
  const topIntel = [...(opponent.intel || [])].filter((i) => i.confidence === 'CONFIRMED' || i.confidence === 'LIKELY').slice(0, 3);

  if (!strong.length && !weak.length && !topIntel.length) {
    card.append(el('div', { class: 'field-hint', style: 'padding:6px 2px;' }, 'No rated map threats or intel yet — add them from the Scouting profile.'));
    return card;
  }
  if (weak.length) {
    card.append(el('div', { class: 'field-hint', style: 'margin-bottom:4px;' }, 'Their strong maps (our risk)'));
    for (const n of weak) card.append(el('div', { style: 'font-size:12.5px;margin-bottom:6px;' }, `${n.map} · ${n.mode} — ${n.note || 'rated HIGH threat'}`));
  }
  if (strong.length) {
    card.append(el('div', { class: 'field-hint', style: 'margin:8px 0 4px;' }, 'Their weak maps (our opportunity)'));
    for (const n of strong) card.append(el('div', { style: 'font-size:12.5px;margin-bottom:6px;' }, `${n.map} · ${n.mode} — ${n.note || 'rated LOW threat'}`));
  }
  if (topIntel.length) {
    card.append(el('div', { class: 'field-hint', style: 'margin:8px 0 4px;' }, 'Confirmed / likely reads'));
    for (const it of topIntel) card.append(el('div', { style: 'font-size:12.5px;margin-bottom:6px;' }, it.text));
  }
  return card;
}

function preparedStratsCard(strats, readinessRows, ctx, team) {
  const card = el('div', { class: 'card compact' }, [
    el('div', { class: 'card-head' }, [
      el('h2', {}, 'Prepared Strats'),
      el('button', { class: 'btn subtle sm', onclick: () => ctx.navigate('playbooks', team.id) }, 'Open Playbooks →'),
    ]),
  ]);
  const ready = strats
    .filter((s) => ['APPROVED', 'MATCH READY', 'IN PRACTICE'].includes(String(s.status).toUpperCase()))
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    .slice(0, 6);
  if (!ready.length) {
    card.append(el('div', { class: 'field-hint', style: 'padding:6px 2px;' }, 'Nothing approved yet — draft strats show up here once marked Approved, Match Ready, or In Practice.'));
    return card;
  }
  for (const s of ready) {
    card.append(
      el('div', { class: 'crow', role: 'button', tabindex: '0', onclick: () => ctx.navigate('playbooks', `${team.id}/edit/${s.strategy_id}`) }, [
        el('div', { class: 'crow-main' }, [
          el('div', { class: 'crow-title' }, s.strategy_name || 'Untitled strat'),
          el('div', { class: 'crow-sub' }, `${s.map} · ${s.mode}${s.objective_key ? ` · ${s.objective_key}` : ''}`),
        ]),
        el('span', { class: 'pill win' }, s.status),
      ])
    );
  }
  return card;
}

function vodCard(oppVods, ctx, team, opponent) {
  const card = el('div', { class: 'card compact' }, [
    el('div', { class: 'card-head' }, [
      el('h2', {}, 'Recent VOD'),
      el('button', { class: 'btn subtle sm', onclick: () => ctx.navigate('vod-library', team.id) }, 'VOD Library →'),
    ]),
  ]);
  const recent = [...oppVods].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);
  if (!recent.length) {
    card.append(el('div', { class: 'field-hint', style: 'padding:6px 2px;' }, `No VOD linked to ${opponent.name} yet.`));
    return card;
  }
  for (const v of recent) {
    card.append(
      el('div', { class: 'crow', style: 'cursor:default;' }, [
        el('div', { class: 'crow-main' }, [
          el('div', { class: 'crow-title' }, v.title || 'Untitled VOD'),
          el('div', { class: 'crow-sub' }, [v.map, v.mode].filter(Boolean).join(' · ') || v.source),
        ]),
        el('div', { class: 'crow-meta' }, fmtDate(v.date)),
      ])
    );
  }
  return card;
}

function notesCard(oppNotes, ctx, team) {
  const card = el('div', { class: 'card compact' }, [
    el('div', { class: 'card-head' }, [
      el('h2', {}, 'Coach Notes'),
      el('button', { class: 'btn subtle sm edit-only', onclick: () => ctx.navigate('team-hub', `${team.id}/notes`) }, 'Team Notes →'),
    ]),
  ]);
  const recent = [...oppNotes].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)).slice(0, 5);
  if (!recent.length) {
    card.append(el('div', { class: 'field-hint', style: 'padding:6px 2px;' }, 'No team notes linked to this opponent yet.'));
    return card;
  }
  for (const n of recent) {
    card.append(
      el('div', { class: 'crow', style: 'cursor:default;' }, [
        el('div', { class: 'crow-main' }, [
          el('div', { class: 'crow-title' }, n.title),
          el('div', { class: 'crow-sub' }, `${n.author} · ${fmtStamp(n.updated_at)}`),
        ]),
      ])
    );
  }
  return card;
}
