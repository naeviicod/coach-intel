import { el, icon, fmtStamp } from '../utils.js';
import { iconBtn } from './teamHub/parts.js';
import { pageHeader, teamSelect, emptyState, confirmModal, toast } from './planningShared.js';
import { VETO_FORMATS, seriesModes, buildVetoSequence, availableMaps, resultSeries, isSequenceComplete, groupStepsByMode, shortMode } from '../lib/veto.js';
import { collectVetoes, intelForOpponent, suggestForStep, summaryLines, mapRecommendation } from '../lib/vetoIntel.js';

export async function render(container, ctx) {
  const teams = await window.cci.getTeams();
  if (!teams.length) {
    container.append(pageHeader('Veto Lab', 'Model veto trees against an opponent before the match'));
    container.append(emptyState('No teams yet', 'Create a team to model vetoes against your opponents.'));
    return;
  }
  const active = teams.find((t) => t.id === ctx.param) || teams[0];
  const reload = () => {
    container.innerHTML = '';
    return draw(container, ctx, teams, active, reload);
  };
  await draw(container, ctx, teams, active, reload);
}

async function draw(container, ctx, teams, active, reload) {
  const [vetoes, opponents, ruleset, matches] = await Promise.all([
    window.cci.getVetoes(active.id),
    window.cci.getOpponents(),
    window.cci.getCdlRuleset(),
    window.cci.getMatches(active.id),
  ]);
  const rulesetModes = ruleset?.modes || ['Hardpoint', 'Search & Destroy', 'Overload'];
  const poolsByMode = {};
  for (const mode of rulesetModes) {
    poolsByMode[mode] = (ruleset?.maps || [])
      .filter((m) => m.active !== false && (m.modes || []).includes(mode))
      .map((m) => m.name);
  }

  const catalog = collectVetoes({ teamVetoes: vetoes, opponents });
  const state = { opponent: '', format: 'Bo5', first: 'us', steps: [], modes: [], loadedId: null };

  function rebuild() {
    state.modes = seriesModes(state.format, rulesetModes);
    state.steps = buildVetoSequence({ modes: state.modes, poolsByMode, first: state.first }).steps;
  }
  rebuild();

  container.append(
    pageHeader(
      'Veto Lab',
      `${active.name}: model the map veto, then keep the book`,
      teamSelect(teams, active.id, (id) => ctx.navigate('veto-lab', id))
    )
  );

  const listId = 'veto-opp-list';
  const opponentInput = el('input', {
    type: 'text',
    placeholder: 'Opponent',
    value: state.opponent,
    list: listId,
    oninput: (e) => { state.opponent = e.target.value; paintIntel(); paintBoard(); },
  });
  const formatSelect = el(
    'select',
    { onchange: (e) => { state.format = e.target.value; rebuild(); paint(); } },
    VETO_FORMATS.map((f) => el('option', { value: f.key, selected: f.key === state.format ? 'selected' : null }, f.label))
  );
  const firstSelect = el(
    'select',
    { onchange: (e) => { state.first = e.target.value; rebuild(); paint(); } },
    [
      el('option', { value: 'us', selected: 'selected' }, 'We veto first'),
      el('option', { value: 'them' }, 'They veto first'),
    ]
  );

  container.append(
    el('div', { class: 'veto-config' }, [
      opponentInput,
      el('datalist', { id: listId }, opponents.map((o) => el('option', { value: o.name }))),
      formatSelect,
      firstSelect,
      el('div', { style: 'flex:1;' }),
      el('button', { class: 'btn sm subtle edit-only', onclick: () => { rebuild(); paint(); toast('Veto reset', 'ok'); } }, 'Reset'),
      el('button', { class: 'btn sm primary edit-only', onclick: savePlan }, 'Save Plan'),
    ])
  );

  const intelHost = el('div');
  const boardHost = el('div');
  container.append(intelHost, boardHost);

  function cursorIndex() {
    return state.steps.findIndex((s) => !s.map);
  }

  function currentIntel() {
    return intelForOpponent(state.opponent, catalog);
  }

  function currentOpponentRecord() {
    const name = state.opponent.trim().toLowerCase();
    if (!name) return null;
    return opponents.find((o) => String(o.name || '').trim().toLowerCase() === name) || null;
  }

  function assign(map) {
    const idx = cursorIndex();
    if (idx === -1) return;
    state.steps[idx].map = map;
    paintBoard();
  }

  function undoTo(index) {
    for (let i = index; i < state.steps.length; i++) state.steps[i].map = null;
    paintBoard();
  }

  function paintIntel() {
    intelHost.innerHTML = '';
    const intel = currentIntel();
    const lines = summaryLines(intel, 3);
    if (!state.opponent.trim() && !intel.league.sample) return;
    if (!lines.length) return;
    intelHost.append(
      el('div', { class: 'veto-intel' }, [
        el('div', { class: 'veto-intel-kicker' }, intel.known ? `Book vs ${intel.opponent}` : 'League book'),
        ...lines.map((line) => el('div', { class: 'veto-intel-line' }, line)),
      ])
    );
  }

  function paintBoard() {
    opponentInput.value = state.opponent;
    formatSelect.value = state.format;
    firstSelect.value = state.first;
    boardHost.innerHTML = '';

    const cursor = cursorIndex();
    const intel = currentIntel();
    const groups = groupStepsByMode(state.steps);

    const modes = el('div', {
      class: 'grid veto-modes',
      style: `display:grid;grid-template-columns:repeat(${Math.max(groups.length, 1)},minmax(0,1fr));gap:10px;`,
    });
    let stepOffset = 0;
    for (const group of groups) {
      const col = el('div', { class: 'veto-col' }, [el('div', { class: 'veto-col-mode' }, group.mode)]);
      group.steps.forEach((step, local) => {
        const i = stepOffset + local;
        const isCurrent = i === cursor;
        col.append(
          el('div', { class: `veto-step${isCurrent ? ' current' : ''}${step.map ? ' done' : ''}` }, [
            el('span', { class: `veto-turn ${step.team}` }, step.team === 'us' ? 'US' : 'THEM'),
            el('span', { class: `veto-act ${step.action}` }, step.action === 'pick' ? 'PICK' : 'BAN'),
            el('span', { class: 'veto-map' }, step.map || (isCurrent ? 'Choose' : 'open')),
            step.map ? iconBtn('trash', 'Undo from here', () => undoTo(i)) : null,
          ])
        );
      });
      stepOffset += group.steps.length;
      modes.append(col);
    }
    boardHost.append(modes);

    if (cursor === -1) {
      boardHost.append(
        el('div', { class: 'card', style: 'margin-bottom:14px;' }, [
          el('div', { class: 'intel-signal' }, [
            el('div', { class: 'intel-signal-icon positive', html: icon('check', 12) }),
            el('div', {}, [
              el('div', { class: 'intel-signal-title' }, 'Veto complete'),
              el('div', { class: 'intel-signal-body' }, 'Every map is locked. Save the plan to keep it on this opponent\'s scout card.'),
            ]),
          ]),
        ])
      );
    } else {
      const step = state.steps[cursor];
      const maps = availableMaps(step, state.steps, poolsByMode);
      const hints = suggestForStep(intel, step, maps);
      const hintFor = Object.fromEntries(hints.map((h) => [h.map, h]));
      const picker = el('div', { class: 'card', style: 'margin-bottom:14px;' }, [
        el('div', { class: 'card-head' }, [
          el('div', { class: 'card-title' }, `${step.team === 'us' ? 'Your' : 'Their'} ${step.action} · ${step.mode}`),
          hints.length ? el('div', { class: 'card-meta' }, 'Highlighted from the book') : null,
        ]),
      ]);
      if (!maps.length) {
        picker.append(el('div', { class: 'field-hint', style: 'padding:6px 2px;' }, 'No maps left in this pool.'));
      } else {
        const opponentRecord = currentOpponentRecord();
        picker.append(
          el(
            'div',
            { class: 'grid veto-pool', style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:8px;' },
            maps.map((map) => {
              const hint = hintFor[map];
              // Separate from the habit hint above: this is our real win rate
              // on the map plus the opponent's coach-entered threat rating —
              // never a fabricated opponent win rate.
              const rec = mapRecommendation({ map, mode: step.mode, matches, opponent: opponentRecord });
              return el('button', { class: `veto-tile ${step.action}${hint ? ' hint' : ''}`, onclick: () => assign(map) }, [
                el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:6px;' }, [
                  el('span', { class: 'veto-tile-name' }, map),
                  rec.lean
                    ? el('span', { class: `pill ${rec.lean === 'pick' ? 'win' : 'loss'}`, title: rec.reasons.join(' ') }, rec.lean.toUpperCase())
                    : null,
                ]),
                hint ? el('span', { class: 'veto-tile-why' }, `${hint.why} · ${hint.source} (${hint.n})`) : null,
                rec.total ? el('span', { class: 'veto-tile-why' }, rec.reasons[0]) : null,
              ]);
            })
          )
        );
      }
      boardHost.append(picker);
    }

    const series = resultSeries(state.modes, state.steps);
    const banned = state.steps.filter((s) => s.action === 'ban' && s.map);
    const result = el('div', { class: 'card', style: 'margin-bottom:24px;' }, [
      el('div', { class: 'card-head' }, [el('div', { class: 'card-title' }, 'Resulting Series')]),
      el(
        'div',
        { class: 'veto-series' },
        series.map((game) =>
          el('div', { class: 'veto-game' }, [
            el('div', { class: 'veto-game-n' }, `Game ${game.game}`),
            el('div', { class: `veto-game-map${game.map ? '' : ' pending'}` }, game.map || 'Pending'),
            el('div', { class: 'veto-game-mode' }, `${shortMode(game.mode)} · ${game.mode}`),
          ])
        )
      ),
      banned.length
        ? el('div', { class: 'field-hint', style: 'margin-top:10px;' }, `Banned: ${banned.map((s) => `${s.map} (${shortMode(s.mode)})`).join(', ')}`)
        : null,
    ]);
    boardHost.append(result);
  }

  function paint() {
    paintIntel();
    paintBoard();
  }
  paint();

  container.append(el('div', { class: 'section-title' }, 'Saved Plans'));
  if (!vetoes.length) {
    container.append(el('div', { class: 'card' }, el('div', { class: 'field-hint', style: 'padding:6px;' }, 'No saved veto plans yet. Model a veto above and hit Save Plan.')));
  } else {
    const list = el('div', { class: 'card' });
    for (const veto of vetoes) list.append(savedRow(veto));
    container.append(list);
  }

  function savedRow(veto) {
    const complete = isSequenceComplete(veto.steps || []);
    return el('div', { class: 'crow' }, [
      el('div', {
        class: 'crow-main',
        role: 'button',
        tabindex: '0',
        style: 'cursor:pointer;',
        onclick: () => loadPlan(veto),
        onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); loadPlan(veto); } },
      }, [
        el('div', { class: 'crow-title' }, `vs ${veto.opponent}`),
        el('div', { class: 'crow-sub' }, `${veto.format} · ${veto.first === 'us' ? 'we veto first' : 'they veto first'} · updated ${fmtStamp(veto.updated_at)}`),
      ]),
      el('span', { class: `pill ${complete ? 'matchready' : 'draft'}` }, complete ? 'Complete' : 'Draft'),
      el('div', { class: 'crow-actions' }, [
        iconBtn('trash', 'Delete plan', () =>
          confirmModal({
            title: 'Delete veto plan?',
            body: `The saved veto against ${veto.opponent} will be removed from this team and their scout card.`,
            onConfirm: async () => {
              await window.cci.deleteVeto(active.id, veto.veto_id);
              reload();
            },
          })
        ),
      ]),
    ]);
  }

  function loadPlan(veto) {
    state.opponent = veto.opponent || '';
    state.format = veto.format || 'Bo5';
    state.first = veto.first || 'us';
    state.loadedId = veto.veto_id;
    state.modes = seriesModes(state.format, rulesetModes);
    const skeleton = buildVetoSequence({ modes: state.modes, poolsByMode, first: state.first }).steps;
    (veto.steps || []).forEach((saved, i) => {
      if (skeleton[i] && saved.map) skeleton[i].map = saved.map;
    });
    state.steps = skeleton;
    paint();
    toast(`Loaded veto vs ${veto.opponent}`, 'ok');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function savePlan() {
    if (!state.opponent.trim()) {
      toast('Name the opponent before saving', 'error');
      return;
    }
    const saved = await window.cci.saveVeto(active.id, {
      veto_id: state.loadedId || undefined,
      opponent: state.opponent.trim(),
      format: state.format,
      first: state.first,
      steps: state.steps,
    });
    state.loadedId = saved.veto_id;
    toast(`Saved vs ${saved.opponent}. The book updates for the next series.`, 'ok');
    reload();
  }
}
