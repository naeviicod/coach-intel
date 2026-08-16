import { el, statsByKey, fmtDate } from '../utils.js';
import { resolveMapImage } from '../lib/maps.js';
import { openMapModal } from './cdlRulesetSettings.js';

export async function render(container, ctx) {
  const teams = await window.cci.getTeams();
  if (!teams.length) {
    container.append(el('div', { class: 'card empty-state' }, 'No teams yet.'));
    return;
  }
  const activeTeam = teams.find((t) => t.id === ctx.param) || teams[0];
  const [matches, ruleset] = await Promise.all([window.cci.getMatches(activeTeam.id), window.cci.getCdlRuleset()]);

  container.append(
    el('div', { class: 'page-header' }, [
      el('div', {}, [
        el('div', { class: 'page-title' }, 'Maps & Modes'),
        el('div', { class: 'page-subtitle' }, `${activeTeam.name} — official CDL map pool`),
      ]),
      el('div', { style: 'display:flex;align-items:center;gap:8px;' }, [
        teams.length > 1
          ? el(
              'select',
              { onchange: (e) => ctx.navigate('maps-modes', e.target.value) },
              teams.map((t) => el('option', { value: t.id, selected: t.id === activeTeam.id ? 'selected' : null }, t.name))
            )
          : null,
        el('button', {
          class: 'btn primary',
          onclick: () => openMapModal(async () => {
            container.innerHTML = '';
            await render(container, ctx);
          }),
        }, '+ Add Map'),
      ]),
    ])
  );

  if (ruleset) container.append(rulesetStrip(ruleset));

  const mapStats = new Map(statsByKey(matches, (m) => m.map).map((s) => [s.key, s]));
  const modeStats = statsByKey(matches, (m) => m.mode);

  const state = { mode: 'All' };
  const gridWrap = el('div', { class: 'section' });
  container.append(gridWrap);

  function drawGrid() {
    gridWrap.innerHTML = '';
    if (!ruleset) {
      gridWrap.append(el('div', { class: 'card empty-state' }, 'CDL ruleset data not found.'));
      return;
    }
    const chips = el(
      'div',
      { class: 'filter-bar' },
      ['All', ...ruleset.modes].map((mode) =>
        el(
          'div',
          {
            class: `mode-chip${state.mode === mode ? ' active' : ''}`,
            onclick: () => {
              state.mode = mode;
              drawGrid();
            },
          },
          mode
        )
      )
    );
    gridWrap.append(chips);

    const maps = ruleset.maps
      .filter((m) => m.active !== false)
      .filter((m) => state.mode === 'All' || m.modes.includes(state.mode));
    gridWrap.append(
      el(
        'div',
        { class: 'grid cols-3' },
        maps.map((m) => mapCard(m, mapStats.get(m.name)))
      )
    );
  }
  drawGrid();

  container.append(
    el('div', { class: 'card section' }, [
      el('div', { class: 'section-title' }, 'By Mode — logged matches'),
      modeStats.length
        ? el('div', {
            html: modeStats.map((s) => barRowHtml(`${s.key} (${s.wins}-${s.losses})`, s.winRate)).join(''),
          })
        : el('div', { class: 'field-hint' }, 'No matches logged yet.'),
    ])
  );
}

function rulesetStrip(ruleset) {
  return el('div', { class: 'card section ruleset-strip' }, [
    el('div', {}, [
      el('div', { class: 'stat-label' }, 'CDL Ruleset'),
      el('div', { style: 'font-weight:700;font-size:13px;margin-top:2px;' }, `${ruleset.game} · Season ${ruleset.season} · v${ruleset.version}`),
    ]),
    el('div', { style: 'text-align:right;' }, [
      el('div', { class: 'field-hint' }, ruleset.source),
      el('div', { style: 'display:flex;align-items:center;gap:6px;justify-content:flex-end;margin-top:3px;' }, [
        el('span', { class: 'pill win' }, ruleset.status),
        el('span', { class: 'field-hint' }, `checked ${fmtDate(ruleset.last_checked)}`),
      ]),
    ]),
  ]);
}

function mapCard(map, stat) {
  const cover = el('div', { class: 'map-thumb cover' });
  resolveMapImage(map.name).then((src) => {
    if (!src) return;
    const img = el('img', { src, alt: map.name });
    img.onerror = () => cover.remove();
    cover.append(img);
  });
  return el('div', { class: 'card' }, [
    cover,
    el('div', { style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;' }, [
      el('div', { style: 'font-weight:700;font-size:13.5px;' }, map.name),
      stat ? el('span', { class: `pill ${stat.winRate >= 50 ? 'win' : 'loss'}` }, `${stat.winRate}%`) : null,
    ]),
    el(
      'div',
      { style: 'display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px;' },
      map.modes.map((m) => el('span', { class: 'role-badge' }, modeAbbrev(m)))
    ),
    stat
      ? el('div', { class: 'field-hint' }, `${stat.wins}-${stat.losses} over ${stat.total} matches`)
      : el('div', { class: 'field-hint' }, 'No matches logged for this map yet.'),
  ]);
}

function modeAbbrev(mode) {
  if (mode === 'Search & Destroy') return 'S&D';
  if (mode === 'Hardpoint') return 'HP';
  if (mode === 'Overload') return 'OVL';
  return mode;
}

function barRowHtml(label, value) {
  const pct = Math.max(4, value);
  return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
    <div style="width:110px;font-size:11px;color:#8d969f;flex-shrink:0;">${label}</div>
    <div style="flex:1;background:#1c2027;border-radius:5px;height:8px;overflow:hidden;">
      <div style="width:${pct}%;background:#b6f542;height:100%;border-radius:5px;"></div>
    </div>
    <div style="width:34px;text-align:right;font-size:11px;font-weight:700;">${value}%</div>
  </div>`;
}
