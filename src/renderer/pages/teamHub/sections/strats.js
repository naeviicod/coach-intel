import { el, icon, fmtStamp } from '../../../utils.js';
import { hubHead, statusPill, avatarStack, iconBtn, miniEmpty, MODES, modeByKey } from '../parts.js';
import { openEditor } from '../../strategyBoard.js';

const SORTS = [
  { key: 'recent', label: 'Recent', cmp: (a, b) => (a.updated_at < b.updated_at ? 1 : -1) },
  { key: 'name', label: 'Name', cmp: (a, b) => a.strategy_name.localeCompare(b.strategy_name) },
  { key: 'map', label: 'Map', cmp: (a, b) => a.map.localeCompare(b.map) || a.strategy_name.localeCompare(b.strategy_name) },
  { key: 'status', label: 'Status', cmp: (a, b) => String(a.status).localeCompare(String(b.status)) },
];

export async function render(root, hub) {
  // `strats/edit/<id>` opens the board; `strats/mode/<key>` filters the list.
  if (hub.sub[0] === 'edit' || hub.sub[0] === 'new') {
    return renderEditor(root, hub, hub.sub[0] === 'edit' ? hub.sub[1] : null);
  }
  return renderList(root, hub);
}

async function renderEditor(root, hub, stratId) {
  root.closest('.hub')?.classList.add('board-studio');
  const board = el('div', { class: 'board-studio-root' });
  root.append(board);
  await openEditor(board, hub.team.id, hub, { stratId, onExit: () => hub.go('strats') });
}

async function renderList(root, hub) {
  const [strats, members, ruleset] = await Promise.all([
    window.cci.getStrats(hub.team.id),
    window.cci.getMembers(hub.team.id),
    window.cci.getCdlRuleset(),
  ]);

  const railMode = hub.sub[0] === 'mode' ? modeByKey(hub.sub[1]) : null;
  let mapFilter = '';
  let sort = 'recent';
  let showArchived = false;

  root.append(
    hubHead('Strats & Playbooks', `${hub.team.name} — every strat belongs to this team`, [
      el('button', { class: 'btn primary', onclick: () => hub.go('strats', 'new') }, '+ New Strat'),
      hub.ctxToggle,
    ])
  );

  const controls = el('div', { class: 'filter-bar' });
  const tabs = el('div', { class: 'filter-bar' });
  const list = el('div', { class: 'card compact' });
  root.append(controls, tabs, list);

  // Only offer maps that actually appear in the pool or in an existing strat, so
  // the filter can never point at nothing.
  const mapNames = [
    ...new Set([
      ...(ruleset?.maps || []).filter((m) => m.active !== false).map((m) => m.name),
      ...strats.map((s) => s.map),
    ]),
  ].filter(Boolean).sort();

  controls.append(
    el(
      'select',
      { 'aria-label': 'Filter by map', onchange: (e) => { mapFilter = e.target.value; draw(); } },
      [el('option', { value: '' }, 'All Maps'), ...mapNames.map((n) => el('option', { value: n }, n))]
    ),
    el(
      'select',
      { 'aria-label': 'Sort strats', onchange: (e) => { sort = e.target.value; draw(); } },
      SORTS.map((s) => el('option', { value: s.key }, `Sort: ${s.label}`))
    ),
    el('label', { class: 'field-hint', style: 'display:flex;align-items:center;gap:6px;margin-left:auto;cursor:pointer;' }, [
      el('input', { type: 'checkbox', onchange: (e) => { showArchived = e.target.checked; draw(); } }),
      'Show archived',
    ])
  );

  function modeCount(mode) {
    return strats.filter((s) => (!mode || s.mode === mode) && (showArchived || !isArchived(s))).length;
  }

  function drawTabs() {
    tabs.innerHTML = '';
    const active = railMode?.mode || null;
    const entries = [{ key: 'all', label: 'All Strats', mode: null }, ...MODES];
    for (const entry of entries) {
      const isActive = (entry.mode || null) === active;
      tabs.append(
        el(
          'button',
          {
            type: 'button',
            class: `mode-chip${isActive ? ' active' : ''}`,
            'aria-pressed': String(isActive),
            onclick: () => (entry.mode ? hub.go('strats', 'mode', entry.key) : hub.go('strats')),
          },
          `${entry.label} · ${modeCount(entry.mode)}`
        )
      );
    }
  }

  function draw() {
    drawTabs();
    list.innerHTML = '';

    const rows = strats
      .filter((s) => (railMode ? s.mode === railMode.mode : true))
      .filter((s) => (mapFilter ? s.map === mapFilter : true))
      .filter((s) => showArchived || !isArchived(s))
      .sort(SORTS.find((s) => s.key === sort).cmp);

    if (!rows.length) {
      const filtered = mapFilter || railMode;
      list.append(
        miniEmpty(
          filtered ? 'No strats match these filters' : 'No strats saved yet',
          filtered
            ? 'Clear the map or mode filter, or draw a new strat for this matchup.'
            : 'Place your roster on a map, draw the routes, and save the first strat for this team.',
          el('button', { class: 'btn primary sm', onclick: () => hub.go('strats', 'new') }, '+ New Strat')
        )
      );
      return;
    }

    for (const strat of rows) {
      list.append(stratRow(hub, strat, members));
    }
  }

  draw();
}

function isArchived(strat) {
  return String(strat.status || '').toUpperCase() === 'ARCHIVED';
}

function stratRow(hub, strat, members) {
  const assigned = (strat.player_positions || [])
    .map((p) => members.find((m) => m.id === p.member_id))
    .filter(Boolean);
  const unique = [...new Map(assigned.map((m) => [m.id, m])).values()];
  const open = () => hub.go('strats', 'edit', strat.strategy_id);

  return el(
    'div',
    {
      class: 'crow',
      role: 'button',
      tabindex: '0',
      'aria-label': `${strat.strategy_name}, ${strat.mode} on ${strat.map}, ${strat.status}`,
      onclick: open,
      onkeydown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      },
    },
    [
      el('div', { class: 'crow-thumb', 'aria-hidden': 'true', html: icon('mapsModes', 16) }),
      el('div', { class: 'crow-main' }, [
        el('div', { class: 'crow-title' }, strat.strategy_name || 'Untitled strat'),
        el('div', { class: 'crow-sub' }, [
          el('span', {}, strat.map || 'No map'),
          el('span', {}, '·'),
          el('span', {}, strat.mode || 'No mode'),
          el('span', {}, '·'),
          el('span', {}, `v${(strat.versions || []).length || 1}`),
        ]),
      ]),
      unique.length ? avatarStack(unique) : null,
      statusPill(strat.status),
      el('div', { class: 'crow-meta' }, `Updated ${fmtStamp(strat.updated_at)}`),
      el('div', { class: 'crow-actions' }, [
        iconBtn('copy', `Duplicate ${strat.strategy_name}`, async () => {
          const dup = await window.cci.duplicateStrat(hub.team.id, strat.strategy_id);
          hub.go('strats', 'edit', dup.strategy_id);
        }),
      ]),
    ]
  );
}
