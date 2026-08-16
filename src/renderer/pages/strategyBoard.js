import { el, icon, fmtDate } from '../utils.js';
import { shareButton } from '../components/discordShare.js';
import { resolveMapLayout, modeLayoutKey } from '../lib/maps.js';
import { paintDrawings, paintOne, hitDrawingIndex, DRAW_COLOR } from './stratBoard/draw.js';
import { defaultPositions, normalizePos, nextOpponentSlot, renderPiece, MAX_PER_TEAM } from './stratBoard/pieces.js';
import { toolRail, bindShortcuts } from './stratBoard/tools.js';

const STATUSES = ['DRAFT', 'READY FOR REVIEW', 'APPROVED', 'IN PRACTICE', 'MATCH READY', 'ARCHIVED'];

const exitHandlers = new WeakMap();

export async function render(container, ctx) {
  const teamId = ctx.param;
  const [team, members, ruleset] = await Promise.all([
    window.cci.getTeam(teamId),
    window.cci.getMembers(teamId),
    window.cci.getCdlRuleset(),
  ]);
  const root = el('div', {});
  container.append(root);
  await showPlaybook(root, teamId, team, members, ruleset, ctx);
}

export async function openEditor(root, teamId, ctx, { stratId = null, onExit } = {}) {
  const [team, members, ruleset] = await Promise.all([
    window.cci.getTeam(teamId),
    window.cci.getMembers(teamId),
    window.cci.getCdlRuleset(),
  ]);
  if (onExit) exitHandlers.set(root, onExit);
  await showBoard(root, teamId, team, members, ruleset, ctx, stratId);
}

async function showPlaybook(root, teamId, team, members, ruleset, ctx) {
  const onExit = exitHandlers.get(root);
  if (onExit) return onExit();

  root.innerHTML = '';
  const strats = await window.cci.getStrats(teamId);

  root.append(
    el('div', { style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;' }, [
      el('div', { class: 'field-hint' }, `${strats.length} saved strat${strats.length === 1 ? '' : 's'} for ${team.name}`),
      el(
        'button',
        { class: 'btn primary', onclick: () => showBoard(root, teamId, team, members, ruleset, ctx, null) },
        '+ New Strat'
      ),
    ])
  );

  if (!strats.length) {
    root.append(
      el('div', { class: 'card empty-state' }, [
        el('div', { class: 'icon' }, '🗺'),
        el('div', { class: 'title' }, 'No strats saved yet'),
        el('div', {}, 'Place four triangles a side, draw routes, and save your first strat.'),
      ])
    );
    return;
  }

  root.append(
    el(
      'div',
      { class: 'grid cols-3' },
      strats.map((s) =>
        el('div', { class: 'card clickable', onclick: () => showBoard(root, teamId, team, members, ruleset, ctx, s.strategy_id) }, [
          el('div', { style: 'display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;' }, [
            el('div', { style: 'font-weight:700;font-size:13px;' }, s.strategy_name),
            el('span', { class: 'pill win' }, s.status),
          ]),
          el('div', { class: 'field-hint', style: 'margin-bottom:10px;' }, `${s.map} · ${s.mode}`),
          el('div', { class: 'field-hint' }, `v${s.versions.length} · updated ${fmtDate(s.updated_at)}`),
        ])
      )
    )
  );
}

async function showBoard(root, teamId, team, members, ruleset, ctx, stratId) {
  root.innerHTML = '';
  const existing = stratId ? await window.cci.getStrat(teamId, stratId) : null;

  const state = {
    strategy_id: existing?.strategy_id || null,
    strategy_name: existing?.strategy_name || '',
    map: existing?.map || ruleset?.maps?.find((m) => m.active !== false)?.name || '',
    mode: existing?.mode || ruleset?.modes?.[0] || '',
    status: existing?.status || 'DRAFT',
    player_positions: existing
      ? existing.player_positions.map(normalizePos)
      : defaultPositions(members),
    drawings: existing ? [...existing.drawings] : [],
    notes: existing?.notes || '',
    versions: existing?.versions || [],
  };
  let tool = 'select';
  let dirty = false;
  let selected = null;
  const history = { stack: [JSON.parse(JSON.stringify(state.drawings))], i: 0 };

  const nameInput = el('input', {
    type: 'text',
    value: state.strategy_name,
    placeholder: 'Strat name (auto-numbered if left blank)',
    style: 'font-weight:700;font-size:14px;width:220px;',
  });
  const mapSelect = el(
    'select',
    { onchange: (e) => { state.map = e.target.value; dirty = true; applyMap(); } },
    (ruleset?.maps || []).filter((m) => m.active !== false).map((m) =>
      el('option', { value: m.name, selected: m.name === state.map ? 'selected' : null }, m.name)
    )
  );
  const modeSelect = el(
    'select',
    { onchange: (e) => { state.mode = e.target.value; dirty = true; applyMap(); } },
    (ruleset?.modes || []).map((m) => el('option', { value: m, selected: m === state.mode ? 'selected' : null }, m))
  );
  const statusSelect = el(
    'select',
    { onchange: (e) => { state.status = e.target.value; dirty = true; } },
    STATUSES.map((s) => el('option', { value: s, selected: s === state.status ? 'selected' : null }, s))
  );

  function setTool(next) {
    tool = next;
    markersLayer.classList.toggle('drawing', tool !== 'select');
    railApi?.paint();
    stage?.focus();
  }

  const boardWrap = el('div', { class: 'board-wrap' });
  const canvas = el('canvas', { class: 'board-canvas' });
  const bg = el('div', { class: 'board-bg' });
  const bgImg = el('img', { class: 'board-map', alt: '' });
  const bgLabel = el('div', { class: 'board-bg-label' }, state.map || 'Select a map');
  bg.append(bgImg, bgLabel);
  const markersLayer = el('div', { class: 'board-markers' });
  boardWrap.append(bg, canvas, markersLayer);

  async function applyMap() {
    const key = modeLayoutKey(state.mode);
    bgLabel.textContent = state.map || 'Select a map';
    bg.dataset.layout = key || 'cover';
    bgImg.onload = () => bg.classList.add('has-map');
    bgImg.onerror = () => bg.classList.remove('has-map');
    const src = await resolveMapLayout(state.map, state.mode);
    if (src) {
      bgImg.alt = key ? `${state.map} ${state.mode} layout` : state.map;
      bgImg.src = src;
    } else {
      bgImg.removeAttribute('src');
      bg.classList.remove('has-map');
    }
  }

  function memberById(id) {
    return members.find((m) => m.id === id);
  }

  function markDirty() {
    dirty = true;
  }

  function removePos(pos) {
    state.player_positions = state.player_positions.filter((p) => p !== pos);
    if (selected === pos) selected = null;
    dirty = true;
    redrawMarkers();
    renderBench();
  }

  function redrawMarkers() {
    markersLayer.innerHTML = '';
    let usN = 0;
    let themN = 4;
    for (const pos of state.player_positions) {
      const number = pos.opponent ? (themN += 1) : (usN += 1);
      pos._slot = number;
      markersLayer.append(
        renderPiece(pos, memberById(pos.member_id), {
          board: boardWrap,
          number,
          selected: selected === pos,
          onChange: markDirty,
          onSelect: (pieceEl) => {
            selected = pos;
            markersLayer.querySelectorAll('.board-piece').forEach((n) => n.classList.remove('selected'));
            pieceEl?.classList.add('selected');
          },
          onRemove: () => removePos(pos),
        })
      );
    }
  }

  const bench = el('div', { class: 'card board-roster' });

  function renderBench() {
    bench.innerHTML = '';
    const us = state.player_positions.filter((p) => !p.opponent);
    const them = state.player_positions.filter((p) => p.opponent);
    const placed = new Set(us.map((p) => p.member_id));

    bench.append(el('div', { class: 'section-title' }, 'Roster'));
    bench.append(el('div', { class: 'board-roster-kicker' }, `Us · ${us.length}/${MAX_PER_TEAM}`));
    us.forEach((pos, i) => {
      const member = memberById(pos.member_id);
      bench.append(rosterRow(`${i + 1}  ${member?.gamertag || 'Player'}`, {
        onBoard: true,
        onDelete: () => removePos(pos),
      }));
    });
    for (const member of members.filter((m) => !placed.has(m.id))) {
      bench.append(rosterRow(member.gamertag, {
        draggable: true,
        onDrag: (e) => e.dataTransfer.setData('text/member-id', member.id),
      }));
    }

    bench.append(el('div', { class: 'board-roster-kicker' }, `Opponent · ${them.length}/${MAX_PER_TEAM}`));
    them.forEach((pos, i) => {
      bench.append(rosterRow(`${i + 5}  Opponent`, { onBoard: true, opponent: true, onDelete: () => removePos(pos) }));
    });
    if (them.length < MAX_PER_TEAM) {
      bench.append(
        el('button', {
          type: 'button',
          class: 'btn subtle',
          style: 'width:100%;margin-top:8px;',
          onclick: () => {
            const slot = nextOpponentSlot(state.player_positions);
            if (!slot) return;
            state.player_positions.push(slot);
            dirty = true;
            redrawMarkers();
            renderBench();
          },
        }, '+ Opponent')
      );
    }
  }

  function resizeCanvas() {
    const rect = boardWrap.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    redrawDrawings();
  }

  function redrawDrawings() {
    paintDrawings(canvas.getContext('2d'), state.drawings, canvas.width, canvas.height);
  }

  function commitDraw() {
    history.stack = history.stack.slice(0, history.i + 1);
    history.stack.push(JSON.parse(JSON.stringify(state.drawings)));
    if (history.stack.length > 40) history.stack.shift();
    history.i = history.stack.length - 1;
  }

  function undo() {
    if (history.i <= 0) return;
    history.i -= 1;
    state.drawings = JSON.parse(JSON.stringify(history.stack[history.i]));
    dirty = true;
    redrawDrawings();
  }

  function redo() {
    if (history.i >= history.stack.length - 1) return;
    history.i += 1;
    state.drawings = JSON.parse(JSON.stringify(history.stack[history.i]));
    dirty = true;
    redrawDrawings();
  }

  let stroke = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const { x, y } = norm(e, canvas);
    if (tool === 'select') {
      selected = null;
      redrawMarkers();
      return;
    }
    if (['pen', 'arrow', 'line', 'zone', 'rect'].includes(tool)) canvas.setPointerCapture(e.pointerId);
    if (tool === 'pen') stroke = { type: 'path', color: DRAW_COLOR, points: [[x, y]] };
    else if (tool === 'arrow' || tool === 'line') stroke = { type: tool, color: DRAW_COLOR, from: [x, y], to: [x, y] };
    else if (tool === 'zone') stroke = { type: 'zone', color: DRAW_COLOR, cx: x, cy: y, r: 0 };
    else if (tool === 'rect') stroke = { type: 'rect', color: DRAW_COLOR, a: [x, y], b: [x, y] };
    else if (tool === 'text') {
      const text = prompt('Label text:');
      if (text) {
        state.drawings.push({ type: 'text', color: DRAW_COLOR, x, y, text });
        dirty = true;
        commitDraw();
        redrawDrawings();
      }
    } else if (tool === 'erase') {
      const idx = hitDrawingIndex(state.drawings, x, y);
      if (idx >= 0) {
        state.drawings.splice(idx, 1);
        dirty = true;
        commitDraw();
        redrawDrawings();
      }
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!stroke) return;
    const { x, y } = norm(e, canvas);
    if (stroke.type === 'path') stroke.points.push([x, y]);
    else if (stroke.type === 'arrow' || stroke.type === 'line') stroke.to = [x, y];
    else if (stroke.type === 'zone') stroke.r = Math.hypot(x - stroke.cx, y - stroke.cy);
    else if (stroke.type === 'rect') stroke.b = [x, y];
    redrawDrawings();
    paintOne(canvas.getContext('2d'), stroke, canvas.width, canvas.height);
  });
  canvas.addEventListener('pointerup', (e) => {
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    if (!stroke) return;
    const keep =
      (stroke.type === 'path' && stroke.points.length > 1) ||
      ((stroke.type === 'arrow' || stroke.type === 'line') && Math.hypot(stroke.to[0] - stroke.from[0], stroke.to[1] - stroke.from[1]) > 0.01) ||
      (stroke.type === 'zone' && stroke.r > 0.015) ||
      (stroke.type === 'rect' && Math.hypot(stroke.b[0] - stroke.a[0], stroke.b[1] - stroke.a[1]) > 0.01);
    if (keep) {
      state.drawings.push(stroke);
      dirty = true;
      commitDraw();
    }
    stroke = null;
    redrawDrawings();
  });

  boardWrap.addEventListener('dragover', (e) => e.preventDefault());
  boardWrap.addEventListener('drop', (e) => {
    e.preventDefault();
    const memberId = e.dataTransfer.getData('text/member-id');
    if (!memberId) return;
    const rect = boardWrap.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    const usCount = state.player_positions.filter((p) => !p.opponent).length;
    const found = state.player_positions.find((p) => p.member_id === memberId);
    if (found) {
      found.x = x;
      found.y = y;
    } else if (usCount < MAX_PER_TEAM) {
      state.player_positions.push(normalizePos({ member_id: memberId, x, y, facing: 0 }));
    }
    dirty = true;
    redrawMarkers();
    renderBench();
  });

  const railApi = toolRail({ getTool: () => tool, setTool, onUndo: undo, onRedo: redo });
  const stage = el('div', { class: 'board-stage' }, [
    railApi.rail,
    boardWrap,
  ]);
  bindShortcuts(stage, {
    setTool,
    getTool: () => tool,
    undo,
    redo,
    deleteSelected: () => { if (selected) removePos(selected); },
    deselect: () => { selected = null; redrawMarkers(); },
    isTyping: () => {
      const tag = document.activeElement?.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    },
  });
  boardWrap.addEventListener('contextmenu', (e) => e.preventDefault());

  const saveBtn = el('button', { class: 'btn primary', onclick: async () => {
    const saved = await window.cci.saveStrat(teamId, {
      ...state,
      strategy_name: nameInput.value.trim() || undefined,
      player_positions: state.player_positions.map(({ _slot, ...pos }) => pos),
    });
    dirty = false;
    await showBoard(root, teamId, team, members, ruleset, ctx, saved.strategy_id);
  } }, existing ? 'Save New Version' : 'Save Strat');

  root.className = 'board-studio-root';
  root.append(
    el('div', { class: 'board-studio-bar' }, [
      el('button', { class: 'btn subtle', onclick: () => {
        if (dirty && !confirm('Discard unsaved changes?')) return;
        showPlaybook(root, teamId, team, members, ruleset, ctx);
      } }, '← Playbook'),
      nameInput,
      mapSelect,
      modeSelect,
      statusSelect,
      existing
        ? el('button', { class: 'btn subtle', onclick: () => openVersions(root, teamId, team, members, ruleset, ctx, state) }, `Versions (${state.versions.length})`)
        : null,
      existing ? el('button', { class: 'btn subtle', onclick: async () => {
        const dup = await window.cci.duplicateStrat(teamId, existing.strategy_id);
        showBoard(root, teamId, team, members, ruleset, ctx, dup.strategy_id);
      } }, 'Duplicate') : null,
      existing
        ? shareButton(() => ({
            kind: 'Strat',
            title: [state.map, state.mode].filter(Boolean).join(' · ') || state.strategy_name,
            subtitle: state.strategy_name,
            summary: state.notes,
            status: state.status,
            team,
            route: `team-hub/${teamId}/strats/edit/${existing.strategy_id}`,
            defaultPurpose: 'strats',
          }))
        : null,
      existing ? el('button', { class: 'btn subtle danger', onclick: async () => {
        if (!confirm(`Delete "${state.strategy_name}"? This cannot be undone.`)) return;
        await window.cci.deleteStrat(teamId, existing.strategy_id);
        showPlaybook(root, teamId, team, members, ruleset, ctx);
      } }, 'Delete') : null,
      el('div', { style: 'flex:1;' }),
      saveBtn,
    ])
  );
  root.append(el('div', { class: 'board-hint' }, 'S select · D draw · A arrow · R rect · C circle · T text · E erase · right-click rotate · Del remove'));
  root.append(el('div', { class: 'board-studio-body' }, [bench, stage]));

  applyMap();
  renderBench();
  redrawMarkers();
  requestAnimationFrame(resizeCanvas);
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => resizeCanvas());
    ro.observe(boardWrap);
  }
}

function rosterRow(name, { onBoard, opponent, draggable, onDrag, onDelete } = {}) {
  return el('div', {
    class: `roster-row board-roster-row${opponent ? ' opponent' : ''}`,
    draggable: draggable ? 'true' : null,
    ondragstart: onDrag || null,
  }, [
    el('span', { class: `board-roster-tri${opponent ? ' opponent' : ''}`, 'aria-hidden': 'true' }),
    el('div', { class: 'board-roster-copy' }, [
      el('div', { class: 'gamertag board-roster-name', title: name }, name),
      onBoard ? el('span', { class: 'board-roster-on' }, 'On map') : el('span', { class: 'board-roster-on' }, 'Bench'),
    ]),
    onDelete
      ? el('button', {
          type: 'button',
          class: 'btn subtle sm board-roster-del',
          'aria-label': `Remove ${name}`,
          title: 'Remove from board',
          html: icon('trash', 12),
          onclick: (e) => { e.stopPropagation(); onDelete(); },
        })
      : null,
  ]);
}

function norm(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) / rect.width,
    y: (e.clientY - rect.top) / rect.height,
  };
}

function openVersions(root, teamId, team, members, ruleset, ctx, state) {
  const overlay = el('div', { class: 'modal-overlay', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
  const body = el('div', {}, [
    el('h3', {}, `${state.strategy_name} — Version History`),
    ...[...state.versions].reverse().map((v) =>
      el('div', { class: 'list-item-row' }, [
        el('div', {}, [
          el('div', { style: 'font-weight:700;font-size:12.5px;' }, `v${v.version}`),
          el('div', { class: 'field-hint' }, `${v.label} · ${fmtDate(v.created_at)}`),
        ]),
        el('button', { class: 'btn subtle', onclick: async () => {
          await window.cci.restoreStratVersion(teamId, state.strategy_id, v.version);
          overlay.remove();
          showBoard(root, teamId, team, members, ruleset, ctx, state.strategy_id);
        } }, 'Restore'),
      ])
    ),
  ]);
  overlay.append(el('div', { class: 'modal' }, body));
  document.body.append(overlay);
}
