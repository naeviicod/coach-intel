export const MAX_PER_TEAM = 4;
export const DEFAULT_PIECE_SCALE = 0.7;

const US_SLOTS = [
  { x: 0.22, y: 0.68, facing: 0.18 },
  { x: 0.32, y: 0.78, facing: -0.08 },
  { x: 0.16, y: 0.54, facing: 0.42 },
  { x: 0.3, y: 0.58, facing: 0.62 },
];

const THEM_SLOTS = [
  { x: 0.78, y: 0.32, facing: Math.PI + 0.18 },
  { x: 0.68, y: 0.22, facing: Math.PI - 0.08 },
  { x: 0.84, y: 0.46, facing: Math.PI + 0.42 },
  { x: 0.7, y: 0.42, facing: Math.PI + 0.62 },
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

export function defaultPositions(members) {
  const us = (members || []).slice(0, MAX_PER_TEAM).map((m, i) =>
    normalizePos({ member_id: m.id, ...(US_SLOTS[i] || US_SLOTS[0]) })
  );
  const them = THEM_SLOTS.slice(0, MAX_PER_TEAM).map((slot) => normalizePos({ opponent: true, ...slot }));
  return [...us, ...them];
}

export function nextOpponentSlot(existing) {
  const used = (existing || []).filter((p) => p.opponent);
  if (used.length >= MAX_PER_TEAM) return null;
  return normalizePos({ opponent: true, ...(THEM_SLOTS[used.length] || THEM_SLOTS[0]) });
}

export function cleanPositions(list) {
  return (list || []).map(({ member_id, opponent, x, y, facing }) =>
    normalizePos({ member_id, opponent, x, y, facing })
  );
}
