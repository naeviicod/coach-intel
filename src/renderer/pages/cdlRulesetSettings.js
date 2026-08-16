import { el, fmtDate } from '../utils.js';
import { resolveMapImage } from '../lib/maps.js';

const CDL_MODES = ['Hardpoint', 'Search & Destroy', 'Overload'];
const LAYOUTS = [
  { key: 'hp', label: 'Hardpoint layout (hills)' },
  { key: 'snd', label: 'S&D layout (bombsites)' },
  { key: 'ovl', label: 'Overload layout (goals)' },
];

function openModal(bodyEl) {
  const overlay = el('div', { class: 'modal-overlay', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
  const modal = el('div', { class: 'modal' });
  modal.append(bodyEl);
  overlay.append(modal);
  document.body.append(overlay);
  return overlay;
}

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
