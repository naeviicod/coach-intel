export const MAX_PER_TEAM = 4;
export const DEFAULT_PIECE_SCALE = 0.7;

const US_SLOTS = [
  { x: 0.14, y: 0.38, facing: Math.PI / 2 },
  { x: 0.14, y: 0.46, facing: Math.PI / 2 },
  { x: 0.14, y: 0.54, facing: Math.PI / 2 },
  { x: 0.14, y: 0.62, facing: Math.PI / 2 },
];

const THEM_SLOTS = [
  { x: 0.86, y: 0.38, facing: -Math.PI / 2 },
  { x: 0.86, y: 0.46, facing: -Math.PI / 2 },
  { x: 0.86, y: 0.54, facing: -Math.PI / 2 },
  { x: 0.86, y: 0.62, facing: -Math.PI / 2 },
];

export function clampPieceScale(n, fallback = DEFAULT_PIECE_SCALE) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.round(Math.min(1.4, Math.max(0.4, v)) * 100) / 100;
}

function clamp01(n) {
  return Math.min(1, Math.max(0, Number(n) || 0));
}

export function normalizePos(pos) {
  return {
    member_id: pos.member_id ?? null,
    opponent: !!pos.opponent,
    x: clamp01(pos.x ?? 0.5),
    y: clamp01(pos.y ?? 0.5),
    facing: Number.isFinite(pos.facing) ? pos.facing : pos.opponent ? Math.PI : 0,
  };
}

export function defaultPositions(members, layout) {
  const usSlots = layout?.spawns?.us || US_SLOTS;
  const themSlots = layout?.spawns?.them || THEM_SLOTS;
  const us = playingMembers(members).slice(0, MAX_PER_TEAM).map((m, i) =>
    normalizePos({ member_id: m.id, ...(usSlots[i] || US_SLOTS[i]) })
  );
  const them = themSlots.slice(0, MAX_PER_TEAM).map((slot) => normalizePos({ opponent: true, ...slot }));
  return [...us, ...them];
}

export function nextOpponentSlot(existing, layout) {
  const used = (existing || []).filter((p) => p.opponent);
  if (used.length >= MAX_PER_TEAM) return null;
  const themSlots = layout?.spawns?.them || THEM_SLOTS;
  return normalizePos({ opponent: true, ...(themSlots[used.length] || THEM_SLOTS[used.length]) });
}

function playingMembers(members) {
  return (members || []).filter((m) => m && m.slot !== 'bench' && m.slot !== 'staff' && m.slot !== 'fa' && m.disabled !== true && String(m.handles?._disabled || '') !== '1');
}

export function nextUsSlot(existing, memberId, layout) {
  const used = (existing || []).filter((p) => !p.opponent);
  if (used.length >= MAX_PER_TEAM) return null;
  if (!memberId || (existing || []).some((p) => p.member_id === memberId)) return null;
  const usSlots = layout?.spawns?.us || US_SLOTS;
  return normalizePos({ member_id: memberId, ...(usSlots[used.length] || US_SLOTS[used.length]) });
}

function fanOut(keys) {
  if (!keys?.length) return null;
  return Array.from({ length: 4 }, (_, i) => {
    const key = keys[i % keys.length];
    const facing = Number.isFinite(key.facing)
      ? key.facing
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

function mapSlug(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function modeKey(mode) {
  const m = String(mode || '').toLowerCase();
  if (m.includes('hardpoint') || m === 'hp') return 'hardpoint';
  if (m.includes('search') || m.includes('destroy') || m === 'snd') return 'snd';
  if (m.includes('overload') || m === 'ovl') return 'overload';
  return '';
}

export function spawnPositions(members, map, mode, pack) {
  const entry = pack?.maps?.[mapSlug(map)]?.[modeKey(mode)];
  return defaultPositions(members, spawnLayoutFromObjectives(entry));
}

export function nextUsForMap(existing, memberId, map, mode, pack) {
  const entry = pack?.maps?.[mapSlug(map)]?.[modeKey(mode)];
  return nextUsSlot(existing, memberId, spawnLayoutFromObjectives(entry));
}

export function nextOpponentForMap(existing, map, mode, pack) {
  const entry = pack?.maps?.[mapSlug(map)]?.[modeKey(mode)];
  return nextOpponentSlot(existing, spawnLayoutFromObjectives(entry));
}

export function looksLikeLegacyCorners(positions) {
  const us = (positions || []).filter((p) => !p.opponent);
  const them = (positions || []).filter((p) => p.opponent);
  if (!us.length || !them.length) return false;
  return us.every((p) => p.y > 0.5 && p.x < 0.45) && them.every((p) => p.y < 0.5 && p.x > 0.55);
}

export function cleanPositions(list) {
  return (list || []).map(({ member_id, opponent, x, y, facing }) =>
    normalizePos({ member_id, opponent, x, y, facing })
  );
}
