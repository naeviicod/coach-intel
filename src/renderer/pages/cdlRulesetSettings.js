import { el, fmtDate } from '../utils.js';
import { resolveMapImage } from '../lib/maps.js';
import { openModal } from '../components/modal.js';

const CDL_MODES = ['Hardpoint', 'Search & Destroy', 'Overload'];
const LAYOUTS = [
  { key: 'hp', label: 'Hardpoint layout (hills)' },
  { key: 'snd', label: 'S&D layout (bombsites)' },
  { key: 'ovl', label: 'Overload layout (goals)' },
];

export function cdlRulesetCard(ruleset, onChange) {
  const card = el('div', { class: 'card section' });
  card.append(
    el('div', { class: 'section-title' }, [
      ruleset.label || 'Ruleset',
      el('button', { class: 'btn primary', onclick: () => openMapModal(onChange) }, '+ Add Map'),
    ])
  );
  card.append(
    el('div', { class: 'list-item-row' }, [
      el('div', {}, [
        el('div', { style: 'font-weight:700;font-size:12.5px;' }, `${ruleset.game} · Season ${ruleset.season} · v${ruleset.version}`),
        el('div', { class: 'field-hint' }, ruleset.source),
      ]),
      el('div', { style: 'display:flex;align-items:center;gap:6px;' }, [
        el('span', { class: 'pill win' }, ruleset.status),
        el('span', { class: 'field-hint' }, `checked ${fmtDate(ruleset.last_checked)}`),
      ]),
    ])
  );

  const activeMaps = ruleset.maps.filter((m) => m.active !== false);
  const retiredMaps = ruleset.maps.filter((m) => m.active === false);

  if (!activeMaps.length) card.append(el('div', { class: 'field-hint', style: 'margin-top:10px;' }, 'No active maps.'));
  for (const map of activeMaps) card.append(mapRow(map, onChange));

  if (retiredMaps.length) {
    card.append(el('div', { class: 'field-hint', style: 'margin-top:16px;margin-bottom:2px;text-transform:uppercase;letter-spacing:.05em;' }, 'Retired'));
    for (const map of retiredMaps) card.append(mapRow(map, onChange));
  }

  return card;
}

function mapRow(map, onChange) {
  const isActive = map.active !== false;
  const thumb = el('div', { class: 'map-thumb' });
  resolveMapImage(map.name).then((src) => {
    if (!src) return;
    const img = el('img', { src, alt: map.name });
    img.onerror = () => img.remove();
    thumb.append(img);
  });

  const nameBlock = el('div', { style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;' }, [
    thumb,
    el('b', {}, map.name),
    el('div', { style: 'display:flex;gap:5px;flex-wrap:wrap;' }, map.modes.map((m) => el('span', { class: 'role-badge' }, modeAbbrev(m)))),
    !isActive ? el('span', { class: 'badge-soon' }, 'RETIRED FROM CURRENT RULESET') : null,
  ]);

  const actions = [
    el('button', { class: 'btn subtle', onclick: () => openMapModal(onChange, map) }, 'Edit'),
    el('button', { class: 'btn subtle', onclick: () => openObjectivesModal(map) }, 'Objectives'),
    isActive
      ? el('button', { class: 'btn subtle', onclick: async () => {
          if (!confirm(`Deactivate ${map.name}? It will leave the active map pool, but historical data is preserved.`)) return;
          await window.cci.deactivateCdlMap(map.map_id);
          onChange();
        } }, 'Deactivate')
      : el('button', { class: 'btn subtle', onclick: async () => { await window.cci.restoreCdlMap(map.map_id); onChange(); } }, 'Restore'),
    el('button', { class: 'btn subtle danger', onclick: () => handleRemoveMap(map, onChange) }, 'Remove'),
  ];

  return el('div', { class: 'list-item-row', style: isActive ? '' : 'opacity:.55;' }, [nameBlock, el('div', { class: 'row-actions' }, actions)]);
}

function modeAbbrev(mode) {
  if (mode === 'Search & Destroy') return 'S&D';
  if (mode === 'Hardpoint') return 'HP';
  if (mode === 'Overload') return 'OVL';
  return mode;
}

export function openMapModal(onChange, map) {
  const isEdit = Boolean(map);
  const pending = { path: null, layouts: {} };
  const preview = el('div', { class: 'map-thumb map-thumb-lg' });
  if (map?.name) {
    resolveMapImage(map.name).then((src) => {
      if (!src || pending.path) return;
      const img = el('img', { src, alt: map.name });
      img.onerror = () => img.remove();
      preview.append(img);
    });
  }

  const body = el('div', {}, [
    el('h3', {}, isEdit ? `Edit ${map.name}` : 'Add Map'),
    el('div', { class: 'field' }, [el('label', {}, 'Map Name'), el('input', { type: 'text', id: 'map-name', value: map?.name || '' })]),
    el('div', { class: 'field' }, [
      el('label', {}, 'Map Picture'),
      el('div', { class: 'list-item-row', style: 'padding-left:0;padding-right:0;' }, [
        preview,
        el('div', {}, [
          el('div', { class: 'field-hint' }, 'JPG, PNG or WebP. Used on the strat board and Maps & Modes.'),
          el('button', {
            class: 'btn',
            type: 'button',
            onclick: async () => {
              const src = await window.cci.pickImage();
              if (!src) return;
              pending.path = src;
              preview.innerHTML = '';
              preview.append(el('img', { src: `file://${src}`, alt: '' }));
            },
          }, 'Choose Picture'),
        ]),
      ]),
    ]),
    el('div', { class: 'field' }, [
      el('label', {}, 'Mode layouts'),
      el('div', { class: 'field-hint', style: 'margin-bottom:8px;' },
        'Top-down layouts for the strat board. HP with hills, S&D with bombsites, Overload with goals.'),
      ...LAYOUTS.map((layout) => layoutPick(pending, layout)),
    ]),
    el('div', { class: 'field' }, [
      el('label', {}, 'Modes'),
      el(
        'div',
        { style: 'display:flex;flex-direction:column;gap:8px;' },
        CDL_MODES.map((mode) =>
          el('label', { style: 'display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:400;text-transform:none;letter-spacing:normal;color:var(--text);' }, [
            el('input', { type: 'checkbox', class: 'map-mode-checkbox', value: mode, checked: (map?.modes || []).includes(mode) ? 'checked' : null }),
            mode,
          ])
        )
      ),
    ]),
  ]);
  const overlay = openModal(body);
  body.append(
    el('div', { class: 'modal-actions' }, [
      el('button', { class: 'btn subtle', onclick: () => overlay.remove() }, 'Cancel'),
      el('button', { class: 'btn primary', onclick: async () => {
        const name = body.querySelector('#map-name').value.trim();
        if (!name) return;
        const modes = [...body.querySelectorAll('.map-mode-checkbox')].filter((c) => c.checked).map((c) => c.value);
        if (isEdit) {
          await window.cci.updateCdlMap(map.map_id, { name });
          await window.cci.updateCdlMapModes(map.map_id, modes);
        } else {
          await window.cci.addCdlMap({ name, modes });
        }
        if (pending.path) await window.cci.saveMapArt(pending.path, name);
        for (const [key, src] of Object.entries(pending.layouts)) {
          if (src) await window.cci.saveMapArt(src, name, key);
        }
        overlay.remove();
        onChange();
      } }, 'Save'),
    ])
  );
}

function layoutPick(pending, layout) {
  const status = el('span', { class: 'field-hint' }, 'None yet');
  return el('div', { class: 'list-item-row', style: 'padding-left:0;padding-right:0;' }, [
    el('div', {}, [
      el('div', { class: 'settings-row-title' }, layout.label),
      status,
    ]),
    el('button', {
      class: 'btn',
      type: 'button',
      onclick: async () => {
        const src = await window.cci.pickImage();
        if (!src) return;
        pending.layouts[layout.key] = src;
        status.textContent = src.split('/').pop();
      },
    }, 'Choose'),
  ]);
}

// ---------- Objectives (hills / bombsites / device spawns) ----------
//
// Deliberately never pre-fills a real-looking value: every field starts as
// NEEDS_VERIFICATION (flagged in red) until a coach types the real one over
// it, and this modal is the only writer of that data.

function objectivesModeFor(mode) {
  const m = String(mode || '').toLowerCase();
  if (m.includes('hardpoint')) return 'hardpoint';
  if (m.includes('search') || m.includes('destroy')) return 'snd';
  if (m.includes('overload')) return 'overload';
  return null;
}

function isUnverified(value) {
  return !value || String(value).trim().toUpperCase() === 'NEEDS_VERIFICATION';
}

function verifyField(value, onInput) {
  const applyStyle = (node, v) => {
    node.style.borderColor = isUnverified(v) ? 'var(--loss)' : '';
    node.style.color = isUnverified(v) ? 'var(--loss)' : '';
  };
  const input = el('input', {
    type: 'text',
    value: value || '',
    placeholder: 'NEEDS_VERIFICATION',
    oninput: (e) => {
      onInput(e.target.value);
      applyStyle(e.target, e.target.value);
    },
  });
  applyStyle(input, value);
  return input;
}

function labeledField(label, input) {
  return el('div', { class: 'field', style: 'margin-bottom:10px;' }, [el('label', {}, label), input]);
}

function removableRow(labelInput, locationInput, onRemove) {
  return el('div', { class: 'list-item-row', style: 'padding-left:0;padding-right:0;gap:8px;' }, [
    el('div', { style: 'display:flex;gap:8px;align-items:center;flex:1;' }, [labelInput, locationInput]),
    el('button', { class: 'btn subtle sm danger', type: 'button', onclick: onRemove }, 'Remove'),
  ]);
}

function saveRow(onSave) {
  const status = el('span', { class: 'field-hint' }, '');
  const btn = el(
    'button',
    {
      class: 'btn primary sm',
      type: 'button',
      onclick: async () => {
        btn.disabled = true;
        status.textContent = '';
        try {
          await onSave();
          status.textContent = 'Saved.';
          status.style.color = 'var(--win)';
        } catch (err) {
          status.textContent = err?.message || 'Could not save.';
          status.style.color = 'var(--loss)';
        } finally {
          btn.disabled = false;
        }
      },
    },
    'Save Objectives'
  );
  return el('div', { style: 'display:flex;align-items:center;gap:10px;margin-top:14px;' }, [btn, status]);
}

function hardpointEditor(map, mode, data) {
  const hills = (data.hills || []).map((h) => ({ ...h }));
  const list = el('div', {});

  function draw() {
    list.innerHTML = '';
    if (!hills.length) list.append(el('div', { class: 'field-hint', style: 'padding:6px 0;' }, 'No hills added yet.'));
    hills.forEach((hill, i) => {
      const label = el('input', { type: 'text', value: hill.label, style: 'width:56px;flex-shrink:0;', oninput: (e) => (hill.label = e.target.value) });
      const location = verifyField(hill.location, (v) => (hill.location = v));
      list.append(removableRow(label, location, () => { hills.splice(i, 1); draw(); }));
    });
  }
  draw();

  return el('div', {}, [
    el('div', { class: 'field-hint', style: 'margin-bottom:6px;' }, 'Hill order and location, in rotation order.'),
    list,
    el(
      'button',
      { class: 'btn sm', type: 'button', style: 'margin-top:8px;', onclick: () => {
        hills.push({ order: hills.length + 1, label: `P${hills.length + 1}`, location: 'NEEDS_VERIFICATION', notes: '' });
        draw();
      } },
      '+ Add Hill'
    ),
    saveRow(() => window.cci.saveMapObjectives(map.map_id, map.name, mode, { hills })),
  ]);
}

function sndEditor(map, mode, data) {
  const bombsites = (data.bombsites?.length ? data.bombsites : [{ label: 'A', location: 'NEEDS_VERIFICATION' }, { label: 'B', location: 'NEEDS_VERIFICATION' }])
    .map((b) => ({ ...b }));
  const bombSpawn = verifyField(data.bomb_spawn, () => {});
  const offSpawn = verifyField(data.offense_spawn, () => {});
  const defSpawn = verifyField(data.defense_spawn, () => {});

  return el('div', {}, [
    el('div', { class: 'field-hint', style: 'margin-bottom:6px;' }, 'Bombsites'),
    ...bombsites.map((site) =>
      el('div', { style: 'display:flex;gap:8px;align-items:center;margin-bottom:8px;' }, [
        el('span', { class: 'role-badge', style: 'flex-shrink:0;' }, site.label),
        verifyField(site.location, (v) => (site.location = v)),
      ])
    ),
    el('div', { class: 'field-hint', style: 'margin:14px 0 6px;' }, 'Spawns'),
    labeledField('Bomb Spawn', bombSpawn),
    labeledField('Offense Spawn', offSpawn),
    labeledField('Defense Spawn', defSpawn),
    saveRow(() =>
      window.cci.saveMapObjectives(map.map_id, map.name, mode, {
        bombsites,
        bomb_spawn: bombSpawn.value,
        offense_spawn: offSpawn.value,
        defense_spawn: defSpawn.value,
      })
    ),
  ]);
}

function overloadEditor(map, mode, data) {
  const spawns = (data.device_spawns || []).map((d) => ({ ...d }));
  const list = el('div', {});
  const teamA = verifyField(data.team_a_zone, () => {});
  const teamB = verifyField(data.team_b_zone, () => {});

  function draw() {
    list.innerHTML = '';
    if (!spawns.length) list.append(el('div', { class: 'field-hint', style: 'padding:6px 0;' }, 'No device spawns added yet.'));
    spawns.forEach((spawn, i) => {
      const label = el('input', { type: 'text', value: spawn.label, style: 'width:110px;flex-shrink:0;', oninput: (e) => (spawn.label = e.target.value) });
      const location = verifyField(spawn.location, (v) => (spawn.location = v));
      list.append(removableRow(label, location, () => { spawns.splice(i, 1); draw(); }));
    });
  }
  draw();

  return el('div', {}, [
    el('div', { class: 'field-hint', style: 'margin-bottom:6px;' }, 'Device spawn point(s)'),
    list,
    el(
      'button',
      { class: 'btn sm', type: 'button', style: 'margin-top:8px;', onclick: () => {
        spawns.push({ label: `Device ${spawns.length + 1}`, location: 'NEEDS_VERIFICATION' });
        draw();
      } },
      '+ Add Device Spawn'
    ),
    el('div', { class: 'field-hint', style: 'margin:14px 0 6px;' }, 'Scoring zones'),
    labeledField('Team A Zone', teamA),
    labeledField('Team B Zone', teamB),
    saveRow(() =>
      window.cci.saveMapObjectives(map.map_id, map.name, mode, {
        device_spawns: spawns,
        team_a_zone: teamA.value,
        team_b_zone: teamB.value,
      })
    ),
  ]);
}

function modeEditor(map, mode, data) {
  const modeKey = objectivesModeFor(mode);
  if (modeKey === 'hardpoint') return hardpointEditor(map, mode, data);
  if (modeKey === 'snd') return sndEditor(map, mode, data);
  if (modeKey === 'overload') return overloadEditor(map, mode, data);
  return el('div', { class: 'field-hint' }, 'This mode has no objective data.');
}

export function openObjectivesModal(map) {
  const modes = (map.modes || []).filter((m) => objectivesModeFor(m));
  if (!modes.length) return;
  let activeMode = modes[0];

  const body = el('div', { style: 'width:520px;max-width:90vw;' }, [
    el('h3', {}, `${map.name} — Objectives`),
    el(
      'div',
      { class: 'field-hint', style: 'margin-bottom:12px;line-height:1.55;' },
      'Hill order, bombsites, spawns and device locations, stored separately from the map picture. Competitive defaults are filled in from public CDL coverage — override anything that is wrong for your ruleset.'
    ),
  ]);
  const tabs = el('div', { class: 'filter-bar' });
  const content = el('div', {});
  body.append(tabs, content);

  function drawTabs() {
    tabs.innerHTML = '';
    for (const mode of modes) {
      tabs.append(
        el(
          'button',
          {
            type: 'button',
            class: `mode-chip${mode === activeMode ? ' active' : ''}`,
            onclick: () => { activeMode = mode; drawTabs(); loadMode(); },
          },
          modeAbbrev(mode)
        )
      );
    }
  }

  async function loadMode() {
    content.innerHTML = '';
    content.append(el('div', { class: 'field-hint' }, 'Loading…'));
    const data = (await window.cci.getMapObjectives(map.map_id, map.name, activeMode)) || {};
    content.innerHTML = '';
    content.append(modeEditor(map, activeMode, data));
  }

  drawTabs();
  const overlay = openModal(body);
  body.append(el('div', { class: 'modal-actions' }, [el('button', { class: 'btn subtle', onclick: () => overlay.remove() }, 'Close')]));
  loadMode();
}

async function handleRemoveMap(map, onChange) {
  const result = await window.cci.removeCdlMap(map.map_id, { force: false });
  if (!result.blocked) { onChange(); return; }
  openRemoveMapModal(map, result.matchCount, onChange);
}

function openRemoveMapModal(map, matchCount, onChange) {
  const body = el('div', {}, [
    el('h3', {}, 'Remove Map?'),
    el('div', { class: 'field-hint' }, 'This map contains:'),
    el('div', { style: 'font-weight:700;font-size:14px;margin:8px 0 14px;' }, `${matchCount} Match${matchCount === 1 ? '' : 'es'}`),
    el('div', { class: 'field-hint' }, 'Removing this map may affect historical data.'),
  ]);
  const overlay = openModal(body);
  body.append(
    el('div', { class: 'modal-actions' }, [
      el('button', { class: 'btn subtle', onclick: async () => { await window.cci.deactivateCdlMap(map.map_id); overlay.remove(); onChange(); } }, 'Deactivate Instead'),
      el('button', { class: 'btn subtle', onclick: () => overlay.remove() }, 'Cancel'),
      el('button', { class: 'btn subtle danger', onclick: async () => { await window.cci.removeCdlMap(map.map_id, { force: true }); overlay.remove(); onChange(); } }, 'Remove Anyway'),
    ])
  );
}
