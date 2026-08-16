import { el, icon, fmtDate } from '../utils.js';
import { kpi, iconBtn } from './teamHub/parts.js';
import { pageHeader, teamSelect, emptyState, openForm, confirmModal, toast } from './planningShared.js';

const FORMATS = ['Bo3', 'Bo5', 'Bo7', 'Custom'];

function seriesTally(scrim) {
  let w = 0;
  let l = 0;
  for (const m of scrim.maps || []) {
    if (m.result === 'Win') w += 1;
    else if (m.result === 'Loss') l += 1;
  }
  return { w, l };
}

function seriesOutcome(scrim) {
  const { w, l } = seriesTally(scrim);
  if (!w && !l) return null;
  return w > l ? 'Win' : w < l ? 'Loss' : 'Tie';
}

export async function render(container, ctx) {
  const teams = await window.cci.getTeams();
  if (!teams.length) {
    container.append(pageHeader('Scrim Hub', 'Scrim scheduling, opponent booking and block results'));
    container.append(emptyState('No teams yet', 'Create a team before booking scrims against opponents.'));
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
  const [scrims, ruleset] = await Promise.all([window.cci.getScrims(active.id), window.cci.getCdlRuleset()]);
  const mapNames = (ruleset?.maps || []).filter((m) => m.active !== false).map((m) => m.name);
  const modeNames = ruleset?.modes || ['Hardpoint', 'Search & Destroy', 'Overload'];

  const bookBtn = el('button', { class: 'btn primary', onclick: () => bookScrim(active.id, mapNames, reload) }, [
    el('span', { class: 'icon', style: 'display:inline-flex;vertical-align:-2px;margin-right:6px;', html: icon('plus', 13) }),
    'Book Scrim',
  ]);
  container.append(
    pageHeader(
      'Scrim Hub',
      `${active.name} — scheduling and block results`,
      el('div', { style: 'display:flex;gap:10px;align-items:center;' }, [
        teamSelect(teams, active.id, (id) => ctx.navigate('scrim-hub', id)),
        bookBtn,
      ])
    )
  );

  const upcoming = scrims.filter((s) => s.status === 'scheduled');
  const past = scrims.filter((s) => s.status !== 'scheduled');
  const completed = scrims.filter((s) => s.status === 'completed');
  let blockW = 0;
  let blockL = 0;
  for (const s of completed) {
    const o = seriesOutcome(s);
    if (o === 'Win') blockW += 1;
    else if (o === 'Loss') blockL += 1;
  }
  let mapW = 0;
  let mapL = 0;
  for (const s of completed) {
    const t = seriesTally(s);
    mapW += t.w;
    mapL += t.l;
  }
  const mapWr = mapW + mapL ? Math.round((mapW / (mapW + mapL)) * 100) : 0;

  container.append(
    el('div', { class: 'kpi-row' }, [
      kpi({ label: 'Upcoming', value: upcoming.length, meta: 'Booked scrims', disabled: true }),
      kpi({ label: 'Completed', value: completed.length, meta: 'With results', disabled: true }),
      kpi({ label: 'Block Record', value: `${blockW}-${blockL}`, meta: 'Series won-lost', disabled: true, accent: blockW >= blockL && blockW > 0 }),
      kpi({ label: 'Map Win Rate', value: `${mapWr}%`, meta: `${mapW}-${mapL} maps`, disabled: true }),
    ])
  );

  if (!scrims.length) {
    container.append(
      emptyState(
        'No scrims booked yet',
        'Book a scrim to schedule an opponent, then record each map to build your block record.',
        el('button', { class: 'btn primary', onclick: () => bookScrim(active.id, mapNames, reload) }, 'Book your first scrim')
      )
    );
    return;
  }

  if (upcoming.length) {
    container.append(el('div', { class: 'section-title' }, 'Upcoming'));
    const wrap = el('div', { class: 'section' });
    for (const scrim of upcoming) wrap.append(scrimCard(scrim, active.id, mapNames, modeNames, reload));
    container.append(wrap);
  }

  if (past.length) {
    container.append(el('div', { class: 'section-title' }, 'History'));
    const wrap = el('div', {});
    for (const scrim of past) wrap.append(scrimCard(scrim, active.id, mapNames, modeNames, reload));
    container.append(wrap);
  }
}

function scrimCard(scrim, teamId, mapNames, modeNames, reload) {
  const outcome = seriesOutcome(scrim);
  const tally = seriesTally(scrim);
  const statusPill =
    scrim.status === 'completed'
      ? el('span', { class: `pill ${outcome === 'Win' ? 'win' : outcome === 'Loss' ? 'loss' : ''}` }, outcome ? `${outcome} ${tally.w}-${tally.l}` : 'Completed')
      : scrim.status === 'cancelled'
        ? el('span', { class: 'spill archived' }, 'Cancelled')
        : el('span', { class: 'spill practice' }, 'Scheduled');

  const head = el('div', { class: 'card-head' }, [
    el('div', { style: 'min-width:0;' }, [
      el('div', { style: 'font-weight:700;font-size:14px;' }, `vs ${scrim.opponent}`),
      el('div', { class: 'field-hint', style: 'margin-top:2px;' }, [
        `${fmtDate(scrim.date)}${scrim.time ? ` · ${scrim.time}` : ''} · ${scrim.format}`,
      ]),
    ]),
    el('div', { style: 'display:flex;align-items:center;gap:8px;' }, [
      statusPill,
      iconBtn('edit', 'Edit scrim', () => bookScrim(teamId, mapNames, reload, scrim)),
      iconBtn('trash', 'Delete scrim', () =>
        confirmModal({
          title: 'Delete scrim?',
          body: `The booking against ${scrim.opponent} and its recorded maps will be removed.`,
          onConfirm: async () => {
            await window.cci.deleteScrim(teamId, scrim.scrim_id);
            reload();
          },
        })
      ),
    ]),
  ]);

  const mapsWrap = el('div', {});
  (scrim.maps || []).forEach((m, i) => mapsWrap.append(mapRow(scrim, i, teamId, mapNames, modeNames, reload)));
  if (!(scrim.maps || []).length) {
    mapsWrap.append(el('div', { class: 'field-hint', style: 'padding:6px 2px;' }, 'No maps recorded yet.'));
  }

  const actions = el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;' }, [
    el('button', { class: 'btn sm', onclick: () => addMap(scrim, teamId, mapNames, modeNames, reload) }, '+ Add Map'),
    scrim.status !== 'completed'
      ? el('button', { class: 'btn sm', onclick: () => setStatus(scrim, 'completed', teamId, reload) }, 'Mark Completed')
      : el('button', { class: 'btn sm subtle', onclick: () => setStatus(scrim, 'scheduled', teamId, reload) }, 'Reopen'),
    scrim.status !== 'cancelled' && scrim.status !== 'completed'
      ? el('button', { class: 'btn sm subtle', onclick: () => setStatus(scrim, 'cancelled', teamId, reload) }, 'Cancel')
      : null,
  ]);

  return el('div', { class: 'card', style: 'margin-bottom:12px;' }, [
    head,
    scrim.notes ? el('div', { class: 'field-hint', style: 'margin:-4px 0 10px;line-height:1.5;' }, scrim.notes) : null,
    mapsWrap,
    actions,
  ]);
}

function mapRow(scrim, index, teamId, mapNames, modeNames, reload) {
  const m = scrim.maps[index];
  const resultTag = m.result
    ? el('span', { class: `pill ${m.result === 'Win' ? 'win' : 'loss'}` }, m.result)
    : el('span', { class: 'role-badge' }, 'No result');
  const score = m.us != null && m.them != null ? `${m.us}-${m.them}` : '';
  return el('div', { class: 'crow', style: 'cursor:default;' }, [
    el('div', { class: 'crow-main' }, [
      el('div', { class: 'crow-title' }, `${m.map || 'Map'} · ${m.mode || ''}`),
      score ? el('div', { class: 'crow-sub' }, score) : null,
    ]),
    resultTag,
    el('div', { class: 'crow-actions' }, [
      iconBtn('edit', 'Edit map', () => editMap(scrim, index, teamId, mapNames, modeNames, reload)),
      iconBtn('trash', 'Remove map', async () => {
        const maps = scrim.maps.slice();
        maps.splice(index, 1);
        await window.cci.saveScrim(teamId, { ...scrim, maps });
        reload();
      }),
    ]),
  ]);
}

function scrimFormFields(mapNames) {
  return [
    { key: 'opponent', label: 'Opponent', required: true, placeholder: 'Team name' },
    [
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'time', label: 'Time', type: 'time' },
    ],
    { key: 'format', label: 'Format', type: 'select', options: FORMATS },
    { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Focus for the block, opponent context…' },
  ];
}

function bookScrim(teamId, mapNames, reload, scrim = null) {
  openForm({
    title: scrim ? 'Edit Scrim' : 'Book Scrim',
    submitLabel: scrim ? 'Save' : 'Book',
    fields: scrimFormFields(mapNames),
    values: scrim || { format: 'Bo5', date: new Date().toISOString().slice(0, 10) },
    onSubmit: async (values) => {
      await window.cci.saveScrim(teamId, { ...(scrim || {}), ...values });
      toast(scrim ? 'Scrim updated' : 'Scrim booked', 'ok');
      reload();
    },
  });
}

function mapFormFields(mapNames, modeNames) {
  return [
    [
      { key: 'map', label: 'Map', type: 'select', options: ['', ...mapNames] },
      { key: 'mode', label: 'Mode', type: 'select', options: ['', ...modeNames] },
    ],
    { key: 'result', label: 'Result', type: 'select', options: [['', 'No result'], 'Win', 'Loss'] },
    [
      { key: 'us', label: 'Our Score', type: 'number', placeholder: '0' },
      { key: 'them', label: 'Their Score', type: 'number', placeholder: '0' },
    ],
  ];
}

function addMap(scrim, teamId, mapNames, modeNames, reload) {
  openForm({
    title: 'Add Map',
    fields: mapFormFields(mapNames, modeNames),
    values: { mode: modeNames[0] },
    onSubmit: async (values) => {
      const maps = [...(scrim.maps || []), values];
      await window.cci.saveScrim(teamId, { ...scrim, maps });
      reload();
    },
  });
}

function editMap(scrim, index, teamId, mapNames, modeNames, reload) {
  openForm({
    title: 'Edit Map',
    fields: mapFormFields(mapNames, modeNames),
    values: scrim.maps[index],
    onSubmit: async (values) => {
      const maps = scrim.maps.slice();
      maps[index] = values;
      await window.cci.saveScrim(teamId, { ...scrim, maps });
      reload();
    },
  });
}

async function setStatus(scrim, status, teamId, reload) {
  await window.cci.saveScrim(teamId, { ...scrim, status });
  reload();
}
