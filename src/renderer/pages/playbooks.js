import { el, teamMark } from '../utils.js';
import { resolveActiveTeam } from '../prefs.js';
import { emptyState } from './planningShared.js';
import { MODES, modeByKey, statusPill, iconBtn } from './teamHub/parts.js';
import { openEditor } from './strategyBoard.js';

export const flush = true;
export const studio = true;

export async function render(container, ctx) {
  const teams = await window.cci.getTeams();
  if (!teams.length) {
    container.append(
      el('div', { style: 'padding:26px;' }, [
        emptyState(
          'No teams yet',
          'Create a team before you draw strats.',
          el('button', { class: 'btn primary', onclick: () => ctx.navigate('teams') }, 'Go to Teams')
        ),
      ])
    );
    return;
  }

  const parts = (ctx.param || '').split('/').filter(Boolean);
  const requested = parts[0];
  const team = resolveActiveTeam(
    teams,
    requested && ['edit', 'new', 'mode'].includes(requested) ? null : requested
  );

  if (team.id !== requested) {
    const tail = requested && ['edit', 'new', 'mode'].includes(requested) ? `/${parts.join('/')}` : parts.slice(1).length ? `/${parts.slice(1).join('/')}` : '';
    ctx.navigate('playbooks', `${team.id}${tail}`);
    return;
  }

  const action = parts[1] || '';
  const stratId = action === 'edit' ? parts[2] : null;
  const modeKey = action === 'mode' ? parts[2] : null;
  const editing = action === 'edit' || action === 'new';

  const [strats, ruleset] = await Promise.all([
    window.cci.getStrats(team.id),
    window.cci.getCdlRuleset(),
  ]);

  const go = (...rest) => ctx.navigate('playbooks', [team.id, ...rest.filter(Boolean)].join('/'));
  const rail = el('aside', { class: 'playbooks-rail', 'aria-label': 'Playbooks' });
  const stage = el('div', { class: 'playbooks-stage' });
  container.append(el('div', { class: 'playbooks' }, [rail, stage]));

  renderRail(rail, {
    ctx,
    team,
    teams,
    strats,
    ruleset,
    modeKey,
    stratId,
    editing,
    go,
  });

  if (editing) {
    if (!ctx.canEdit && (action === 'new' || !stratId)) {
      go();
      return;
    }
    const board = el('div', { class: 'board-studio-root' });
    stage.append(board);
    await openEditor(board, team.id, ctx, { stratId, onExit: () => go() });
    return;
  }

  stage.append(
    el('div', { class: 'playbooks-empty' }, [
      el('div', { class: 'playbooks-empty-kicker' }, team.name),
      el('div', { class: 'playbooks-empty-title' }, 'Strats & Playbooks'),
      el('div', { class: 'playbooks-empty-copy' }, 'Pick a strat from the left, or start a new one on a blueprint.'),
      el('button', { class: 'btn primary edit-only', onclick: () => go('new') }, '+ New Strat'),
    ])
  );
}

function renderRail(rail, state) {
  const { ctx, team, teams, strats, ruleset, modeKey, stratId, editing, go } = state;
  const modeFilter = modeByKey(modeKey);
  let mapFilter = '';
  let objectiveFilter = '';

  rail.append(teamBlock(team));
  rail.append(
    el('div', { class: 'playbooks-rail-head' }, [
      el('div', {}, [
        el('div', { class: 'playbooks-rail-title' }, 'Playbooks'),
        el('div', { class: 'field-hint' }, `${strats.length} strat${strats.length === 1 ? '' : 's'}`),
      ]),
      el('button', { class: 'btn primary sm edit-only', onclick: () => go('new') }, '+ New'),
    ])
  );

  const tabs = el('div', { class: 'playbooks-modes' });
  const mapSelect = el('div', { class: 'playbooks-map-filter' });
  const objectiveSelect = el('div', { class: 'playbooks-map-filter' });
  const list = el('div', { class: 'playbooks-list' });
  rail.append(tabs, mapSelect, objectiveSelect, list);

  const mapNames = [
    ...new Set([
      ...(ruleset?.maps || []).filter((m) => m.active !== false).map((m) => m.name),
      ...strats.map((s) => s.map),
    ]),
  ].filter(Boolean).sort();

  mapSelect.append(
    el(
      'select',
      { 'aria-label': 'Filter by map', onchange: (e) => { mapFilter = e.target.value; objectiveFilter = ''; draw(); } },
      [el('option', { value: '' }, 'All Maps'), ...mapNames.map((n) => el('option', { value: n }, n))]
    )
  );

  // Rebuilt on every draw so it only ever offers hill/site tags that actually
  // exist among the current map+mode filter — never a stale or invented list.
  function drawObjectiveFilter() {
    const scoped = strats.filter(
      (s) => (modeFilter ? s.mode === modeFilter.mode : true) && (mapFilter ? s.map === mapFilter : true)
    );
    const keys = [...new Set(scoped.map((s) => s.objective_key).filter(Boolean))].sort();
    objectiveSelect.innerHTML = '';
    if (!keys.length) return;
    objectiveSelect.append(
      el(
        'select',
        { 'aria-label': 'Filter by hill / site', onchange: (e) => { objectiveFilter = e.target.value; draw(); } },
        [el('option', { value: '' }, 'All Hills / Sites'), ...keys.map((k) => el('option', { value: k, selected: k === objectiveFilter ? 'selected' : null }, k))]
      )
    );
  }

  function modeCount(mode) {
    return strats.filter((s) => !mode || s.mode === mode).filter((s) => !isArchived(s)).length;
  }

  function drawTabs() {
    tabs.innerHTML = '';
    const entries = [{ key: '', label: 'All', mode: null }, ...MODES];
    for (const entry of entries) {
      const active = (entry.key || '') === (modeKey || '');
      tabs.append(
        el(
          'button',
          {
            type: 'button',
            class: `mode-chip${active ? ' active' : ''}`,
            'aria-pressed': String(active),
            onclick: () => (entry.key ? go('mode', entry.key) : go()),
          },
          `${entry.short || entry.label} · ${modeCount(entry.mode)}`
        )
      );
    }
  }

  function draw() {
    drawTabs();
    drawObjectiveFilter();
    list.innerHTML = '';
    const rows = strats
      .filter((s) => (modeFilter ? s.mode === modeFilter.mode : true))
      .filter((s) => (mapFilter ? s.map === mapFilter : true))
      .filter((s) => (objectiveFilter ? s.objective_key === objectiveFilter : true))
      .filter((s) => !isArchived(s))
      .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));

    if (!rows.length) {
      list.append(
        el('div', { class: 'field-hint', style: 'padding:10px 4px;' },
          modeFilter || mapFilter || objectiveFilter ? 'No strats match these filters.' : 'No strats yet. Draw the first one.')
      );
      return;
    }

    for (const strat of rows) {
      const open = () => go('edit', strat.strategy_id);
      const active = editing && strat.strategy_id === stratId;
      list.append(
        el(
          'div',
          {
            class: `crow playbooks-row${active ? ' active' : ''}`,
            role: 'button',
            tabindex: '0',
            'aria-current': active ? 'page' : null,
            onclick: open,
            onkeydown: (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                open();
              }
            },
          },
          [
            el('div', { class: 'crow-main' }, [
              el('div', { class: 'crow-title' }, strat.strategy_name || 'Untitled strat'),
              el('div', { class: 'crow-sub' }, [
                el('span', {}, strat.map || 'No map'),
                el('span', {}, '·'),
                el('span', {}, strat.mode || 'No mode'),
                strat.objective_key ? el('span', {}, '·') : null,
                strat.objective_key ? el('span', {}, strat.objective_key) : null,
              ]),
            ]),
            statusPill(strat.status),
            el('span', { class: 'edit-only' }, [
              iconBtn('copy', `Duplicate ${strat.strategy_name}`, async () => {
                const dup = await window.cci.duplicateStrat(team.id, strat.strategy_id);
                go('edit', dup.strategy_id);
              }),
            ]),
          ]
        )
      );
    }
  }

  draw();
}

function teamBlock(team) {
  return el('div', { class: 'playbooks-team' }, [
    el('div', { class: 'playbooks-team-id' }, [
      teamMark(team, { class: 'sb-org-logo', style: 'width:34px;height:34px;' }),
      el('div', { class: 'team-select-id' }, [
        el('div', { class: 'team-select-name' }, team.name),
        el('div', { class: 'team-select-sub' }, team.tag ? `${team.tag} · Playbooks` : 'Playbooks'),
      ]),
    ]),
  ]);
}

function isArchived(strat) {
  return String(strat.status || '').toUpperCase() === 'ARCHIVED';
}
