import { el, icon, fmtDate } from '../utils.js';
import { iconBtn } from './teamHub/parts.js';
import { openModal, modalActions } from '../components/modal.js';
import { pageHeader, teamSelect, emptyState, openForm, confirmModal, toast } from './planningShared.js';

const SOURCES = ['Link', 'YouTube', 'Twitch', 'Local File', 'Other'];

function fmtClock(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

function parseClock(str) {
  const parts = String(str || '').trim().split(':').map((p) => parseInt(p, 10));
  if (parts.some((p) => Number.isNaN(p))) return 0;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

export async function render(container, ctx) {
  const teams = await window.cci.getTeams();
  if (!teams.length) {
    container.append(pageHeader('VOD Library', 'Clip storage and timestamped review'));
    container.append(emptyState('No teams yet', 'Create a team to start building a VOD library.'));
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
  const [vods, ruleset, matches, strats] = await Promise.all([
    window.cci.getVods(active.id),
    window.cci.getCdlRuleset(),
    window.cci.getMatches(active.id),
    window.cci.getStrats(active.id),
  ]);
  const mapNames = (ruleset?.maps || []).filter((m) => m.active !== false).map((m) => m.name);
  const modeNames = ruleset?.modes || ['Hardpoint', 'Search & Destroy', 'Overload'];

  container.append(
    pageHeader(
      'VOD Library',
      `${active.name} — clips and timestamped review`,
      el('div', { style: 'display:flex;gap:10px;align-items:center;' }, [
        teamSelect(teams, active.id, (id) => ctx.navigate('vod-library', id)),
        el('button', { class: 'btn primary', onclick: () => vodForm(active.id, mapNames, modeNames, matches, strats, reload) }, [
          el('span', { class: 'icon', style: 'display:inline-flex;vertical-align:-2px;margin-right:6px;', html: icon('plus', 13) }),
          'Add VOD',
        ]),
      ])
    )
  );

  if (!vods.length) {
    container.append(
      emptyState(
        'No VODs yet',
        'Add a VOD to store its link and drop timestamped notes tied to the maps, matches and strats you review.',
        el('button', { class: 'btn primary', onclick: () => vodForm(active.id, mapNames, modeNames, matches, strats, reload) }, 'Add your first VOD')
      )
    );
    return;
  }

  const modes = [...new Set(vods.map((v) => v.mode).filter(Boolean))];
  const maps = [...new Set(vods.map((v) => v.map).filter(Boolean))];
  const filter = { mode: '', map: '', q: '' };

  const grid = el('div', { class: 'grid cols-2' });
  const bar = el('div', { class: 'filter-bar' }, [
    filterSelect('All Modes', modes, (v) => { filter.mode = v; drawGrid(); }),
    filterSelect('All Maps', maps, (v) => { filter.map = v; drawGrid(); }),
    el('input', { type: 'search', placeholder: 'Search title / opponent…', oninput: (e) => { filter.q = e.target.value.toLowerCase(); drawGrid(); } }),
  ]);
  container.append(bar);
  container.append(grid);

  function drawGrid() {
    grid.innerHTML = '';
    const filtered = vods.filter(
      (v) =>
        (!filter.mode || v.mode === filter.mode) &&
        (!filter.map || v.map === filter.map) &&
        (!filter.q || `${v.title} ${v.opponent}`.toLowerCase().includes(filter.q))
    );
    if (!filtered.length) {
      grid.append(el('div', { class: 'card', style: 'grid-column:1/-1;' }, el('div', { class: 'field-hint', style: 'padding:6px;' }, 'No VODs match these filters.')));
      return;
    }
    for (const vod of filtered) {
      grid.append(vodCard(vod, active.id, mapNames, modeNames, matches, strats, reload));
    }
  }
  drawGrid();
}

function filterSelect(allLabel, options, onChange) {
  return el('select', { onchange: (e) => onChange(e.target.value) }, [
    el('option', { value: '' }, allLabel),
    ...options.map((o) => el('option', { value: o }, o)),
  ]);
}

function vodCard(vod, teamId, mapNames, modeNames, matches, strats, reload) {
  const tags = [vod.mode, vod.map, vod.opponent ? `vs ${vod.opponent}` : null].filter(Boolean);
  return el('div', { class: 'card' }, [
    el('div', { class: 'card-head' }, [
      el('div', { style: 'min-width:0;' }, [
        el('div', { style: 'font-weight:700;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;' }, vod.title),
        el('div', { class: 'field-hint', style: 'margin-top:2px;' }, `${vod.source} · ${fmtDate(vod.date)}`),
      ]),
      el('div', { class: 'crow-actions' }, [
        iconBtn('edit', 'Edit VOD', () => vodForm(teamId, mapNames, modeNames, matches, strats, reload, vod)),
        iconBtn('trash', 'Delete VOD', () =>
          confirmModal({
            title: 'Delete VOD?',
            body: `“${vod.title}” and its ${(vod.markers || []).length} marker(s) will be removed.`,
            onConfirm: async () => {
              await window.cci.deleteVod(teamId, vod.vod_id);
              reload();
            },
          })
        ),
      ]),
    ]),
    tags.length
      ? el('div', { style: 'display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px;' }, tags.map((t) => el('span', { class: 'role-badge' }, t)))
      : null,
    vod.notes ? el('div', { class: 'field-hint', style: 'line-height:1.5;margin-bottom:10px;' }, vod.notes) : null,
    el('div', { style: 'display:flex;gap:8px;align-items:center;' }, [
      el('button', { class: 'btn sm', onclick: () => openReview(vod, teamId, reload) }, [`Review · ${(vod.markers || []).length} marker${(vod.markers || []).length === 1 ? '' : 's'}`]),
      vod.url ? el('button', { class: 'btn sm subtle', onclick: () => copyLink(vod.url) }, 'Copy link') : null,
    ]),
  ]);
}

async function copyLink(url) {
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied', 'ok');
  } catch {
    toast('Could not copy link', 'error');
  }
}

function openReview(vod, teamId, reload) {
  const body = el('div', {}, [
    el('h3', {}, vod.title),
    vod.url ? el('div', { class: 'field-hint', style: 'margin:-8px 0 12px;word-break:break-all;' }, vod.url) : null,
  ]);
  const list = el('div', {});
  const renderMarkers = () => {
    list.innerHTML = '';
    const markers = [...(vod.markers || [])].sort((a, b) => a.t - b.t);
    if (!markers.length) list.append(el('div', { class: 'field-hint', style: 'padding:6px 2px;' }, 'No markers yet. Add timestamps to review key moments.'));
    for (const marker of markers) {
      list.append(
        el('div', { class: 'crow', style: 'cursor:default;align-items:flex-start;' }, [
          el('span', { class: 'vod-ts' }, fmtClock(marker.t)),
          el('div', { class: 'crow-main' }, [
            el('div', { class: 'crow-title', style: 'white-space:normal;' }, marker.label || 'Marker'),
            marker.note ? el('div', { class: 'field-hint', style: 'margin-top:3px;line-height:1.5;' }, marker.note) : null,
          ]),
          el('div', { class: 'crow-actions' }, [
            iconBtn('trash', 'Remove marker', async () => {
              const markersNext = (vod.markers || []).filter((m) => m.id !== marker.id);
              vod.markers = markersNext;
              await window.cci.saveVod(teamId, { ...vod, markers: markersNext });
              renderMarkers();
            }),
          ]),
        ])
      );
    }
  };
  renderMarkers();
  body.append(list);
  body.append(
    modalActions([
      el('button', { class: 'btn subtle', onclick: () => overlay.remove() }, 'Close'),
      el('button', { class: 'btn primary', onclick: () => addMarker(vod, teamId, renderMarkers) }, '+ Add Marker'),
    ])
  );
  const overlay = openModal(body, { width: '500px' });
}

function addMarker(vod, teamId, renderMarkers) {
  openForm({
    title: 'Add Marker',
    fields: [
      { key: 'time', label: 'Timestamp', placeholder: 'mm:ss (e.g. 4:12)', hint: 'Minutes:seconds into the VOD.' },
      { key: 'label', label: 'Label', required: true, placeholder: 'Rotation, bad trade, great flank…' },
      { key: 'note', label: 'Note', type: 'textarea', placeholder: 'What to take away from this moment' },
    ],
    onSubmit: async (values) => {
      const marker = { id: `m${Date.now().toString(36)}`, t: parseClock(values.time), label: values.label, note: values.note };
      const markers = [...(vod.markers || []), marker];
      vod.markers = markers;
      await window.cci.saveVod(teamId, { ...vod, markers });
      renderMarkers();
    },
  });
}

function vodForm(teamId, mapNames, modeNames, matches, strats, reload, vod = null) {
  const matchOptions = [['', 'None'], ...matches.map((m) => [m.match_id, `${m.date} vs ${m.opponent || '?'} (${m.map || ''})`])];
  const stratOptions = [['', 'None'], ...strats.map((s) => [s.strategy_id, `${s.strategy_name} — ${s.map || ''}`])];
  openForm({
    title: vod ? 'Edit VOD' : 'Add VOD',
    width: '520px',
    fields: [
      { key: 'title', label: 'Title', required: true, placeholder: 'Grand Finals G3 vs …' },
      { key: 'url', label: 'Link', placeholder: 'https:// or local path' },
      [
        { key: 'source', label: 'Source', type: 'select', options: SOURCES },
        { key: 'date', label: 'Date', type: 'date' },
      ],
      [
        { key: 'map', label: 'Map', type: 'select', options: ['', ...mapNames] },
        { key: 'mode', label: 'Mode', type: 'select', options: ['', ...modeNames] },
      ],
      { key: 'opponent', label: 'Opponent', placeholder: 'Team faced (optional)' },
      { key: 'match_id', label: 'Linked Match', type: 'select', options: matchOptions },
      { key: 'strategy_id', label: 'Linked Strat', type: 'select', options: stratOptions },
      { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'What this VOD is for' },
    ],
    values: vod || { source: 'Link', date: new Date().toISOString().slice(0, 10) },
    onSubmit: async (values) => {
      await window.cci.saveVod(teamId, { ...(vod || {}), ...values });
      toast(vod ? 'VOD updated' : 'VOD added', 'ok');
      reload();
    },
  });
}
