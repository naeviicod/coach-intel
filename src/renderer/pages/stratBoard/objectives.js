import { el } from '../../utils.js';

const BLUE = '#3d7eff';
const RED = '#ff4d4d';

function clamp01(n) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5;
}

function fanOut(keys, fallbackFacing) {
  if (!keys?.length) return null;
  return Array.from({ length: 4 }, (_, i) => {
    const key = keys[i % keys.length];
    const facing = Number.isFinite(key.facing)
      ? key.facing
      : Number.isFinite(fallbackFacing)
        ? fallbackFacing
        : Math.atan2(0.5 - key.x, -(0.5 - key.y));
    const side = Math.abs(key.x - 0.5) >= Math.abs(key.y - 0.5);
    const spread = ((i % 4) - 1.5) * 0.055;
    return {
      x: clamp01(key.x + (side ? 0 : spread)),
      y: clamp01(key.y + (side ? spread : 0)),
      facing,
    };
  });
}

export function spawnLayoutFromObjectives(data) {
  const us = fanOut(data?.keys?.blue);
  const them = fanOut(data?.keys?.red);
  if (!us && !them) return null;
  return { spawns: { us, them } };
}

function keyDot(point, team) {
  const color = team === 'red' ? RED : BLUE;
  return el('div', {
    class: `board-key ${team}`,
    title: point.label || (team === 'red' ? 'Red spawn' : 'Blue spawn'),
    style: `left:${clamp01(point.x) * 100}%;top:${clamp01(point.y) * 100}%;--key:${color};`,
  }, el('span', { class: 'board-key-label' }, point.label || (team === 'red' ? 'R' : 'B')));
}

export function paintKeys(layer, data) {
  layer.innerHTML = '';
  const keys = data?.keys;
  if (!keys) return;
  for (const point of keys.blue || []) layer.append(keyDot(point, 'blue'));
  for (const point of keys.red || []) layer.append(keyDot(point, 'red'));
}

export function objectivesSummary(data) {
  const wrap = el('div', {});
  wrap.append(el('div', { style: 'font-weight:700;margin-bottom:6px;' }, 'Objectives'));

  const isUnverified = (v) => !v || String(v).trim().toUpperCase() === 'NEEDS_VERIFICATION';
  const row = (label, value) =>
    el('div', { style: 'margin-bottom:3px;' }, [
      el('span', { style: 'opacity:.7;' }, `${label}: `),
      el('span', { style: isUnverified(value) ? 'color:var(--loss);' : '' }, value || 'NEEDS_VERIFICATION'),
    ]);

  if (data?.hills) {
    if (!data.hills.length) wrap.append(el('div', { style: 'opacity:.7;' }, 'No hills recorded yet.'));
    for (const h of data.hills) wrap.append(row(h.label, h.location));
  } else if (data?.bombsites) {
    for (const s of data.bombsites) wrap.append(row(s.label, s.location));
    wrap.append(row('Bomb spawn', data.bomb_spawn));
    wrap.append(row('Offense spawn', data.offense_spawn));
    wrap.append(row('Defense spawn', data.defense_spawn));
  } else if (data?.device_spawns) {
    if (!data.device_spawns.length) wrap.append(el('div', { style: 'opacity:.7;' }, 'No device spawns recorded yet.'));
    for (const d of data.device_spawns) wrap.append(row(d.label, d.location));
    wrap.append(row('Blue zone', data.team_a_zone));
    wrap.append(row('Red zone', data.team_b_zone));
  } else {
    wrap.append(el('div', { style: 'opacity:.7;' }, 'No objective data for this mode.'));
  }
  wrap.append(el('div', { style: 'margin-top:8px;opacity:.6;font-size:10.5px;' }, data?.source
    ? 'Competitive layout. Edit under Settings → Game Rules if a callout is wrong.'
    : 'Edit under Settings → Game Rules.'));
  return wrap;
}
