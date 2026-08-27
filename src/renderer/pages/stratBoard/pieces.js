import { el, icon } from '../../utils.js';

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
  return (members || []).filter((m) => m && m.slot !== 'bench' && m.slot !== 'staff' && m.slot !== 'fa');
}

export function nextUsSlot(existing, memberId, layout) {
  const used = (existing || []).filter((p) => !p.opponent);
  if (used.length >= MAX_PER_TEAM) return null;
  if (!memberId || (existing || []).some((p) => p.member_id === memberId)) return null;
  const usSlots = layout?.spawns?.us || US_SLOTS;
  return normalizePos({ member_id: memberId, ...(usSlots[used.length] || US_SLOTS[used.length]) });
}

export function looksLikeLegacyCorners(positions) {
  const us = (positions || []).filter((p) => !p.opponent);
  const them = (positions || []).filter((p) => p.opponent);
  if (!us.length || !them.length) return false;
  return us.every((p) => p.y > 0.5 && p.x < 0.45) && them.every((p) => p.y < 0.5 && p.x > 0.55);
}

function shortLabel(text) {
  const s = String(text || '');
  return s.length > 11 ? `${s.slice(0, 10)}…` : s;
}

function placeLabel(node, facing) {
  const back = facing + Math.PI;
  const dist = 28;
  const x = Math.sin(back) * dist;
  const y = -Math.cos(back) * dist;
  node.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
}

export function renderPiece(pos, member, { board, number, selected, onChange, onRemove, onSelect, locked } = {}) {
  const raw = pos.opponent ? `Opp ${number}` : member?.gamertag || `P${number}`;
  const label = shortLabel(raw);
  const piece = el('div', {
    class: `board-piece${pos.opponent ? ' opponent' : ' us'}${selected ? ' selected' : ''}${locked ? ' is-locked' : ''}`,
    style: `left:${pos.x * 100}%;top:${pos.y * 100}%;--facing:${(pos.facing * 180) / Math.PI}deg;`,
  });

  const rot = el('div', { class: 'board-piece-rot', html: pieceSvg(number) });
  const num = el('div', { class: 'board-piece-n' }, String(number));
  const name = el('div', { class: 'board-piece-label', title: raw }, label);
  placeLabel(name, pos.facing);
  piece.append(rot, num, name);
  if (!locked) {
    const remove = el('button', {
      type: 'button',
      class: 'board-piece-x',
      'aria-label': `Remove ${label}`,
      title: 'Remove',
      html: icon('trash', 11),
      onclick: (e) => {
        e.stopPropagation();
        onRemove();
      },
    });
    piece.append(remove);
  }
  piece.addEventListener('contextmenu', (e) => e.preventDefault());
  if (locked) return piece;

  const tri = rot.querySelector('.board-tri');
  const cone = rot.querySelector('.board-fov-cone');

  bindDrag(tri, piece, (e) => {
    if (e.button === 2) return rotateTo(e, pos, board, piece, onChange);
    onSelect?.(piece);
    moveTo(e, pos, board, piece, onChange);
  });
  bindDrag(cone, piece, (e) => {
    onSelect?.(piece);
    rotateTo(e, pos, board, piece, onChange);
  });
  piece.addEventListener('pointerdown', (e) => {
    if (e.button !== 2) return;
    e.preventDefault();
    onSelect?.(piece);
    piece.setPointerCapture(e.pointerId);
    const move = (ev) => rotateTo(ev, pos, board, piece, onChange);
    const up = (ev) => {
      piece.releasePointerCapture(ev.pointerId);
      piece.removeEventListener('pointermove', move);
      piece.removeEventListener('pointerup', up);
    };
    piece.addEventListener('pointermove', move);
    piece.addEventListener('pointerup', up);
    rotateTo(e, pos, board, piece, onChange);
  });

  return piece;
}

function pieceSvg(number) {
  const id = `fov-${number}-${Math.random().toString(36).slice(2, 7)}`;
  return `<svg class="board-fov" viewBox="-90 -110 180 160" width="180" height="160" aria-hidden="true">
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="-1">
        <stop offset="0%" stop-color="var(--piece)" stop-opacity="0.42"/>
        <stop offset="70%" stop-color="var(--piece)" stop-opacity="0.12"/>
        <stop offset="100%" stop-color="var(--piece)" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path class="board-fov-cone" d="M 0 0 L -58 -86 A 104 104 0 0 1 58 -86 Z" fill="url(#${id})" />
    <polygon class="board-tri" points="0,-17 -13,14 13,14" />
  </svg>`;
}

function bindDrag(node, piece, onMove) {
  if (!node) return;
  node.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.button !== 2) return;
    e.preventDefault();
    e.stopPropagation();
    piece.setPointerCapture(e.pointerId);
    const move = (ev) => onMove(ev);
    const up = (ev) => {
      piece.releasePointerCapture(ev.pointerId);
      piece.removeEventListener('pointermove', move);
      piece.removeEventListener('pointerup', up);
    };
    piece.addEventListener('pointermove', move);
    piece.addEventListener('pointerup', up);
    onMove(e);
  });
}

function moveTo(ev, pos, board, piece, onChange) {
  const rect = board.getBoundingClientRect();
  pos.x = clamp01((ev.clientX - rect.left) / rect.width);
  pos.y = clamp01((ev.clientY - rect.top) / rect.height);
  piece.style.left = `${pos.x * 100}%`;
  piece.style.top = `${pos.y * 100}%`;
  onChange();
}

function rotateTo(ev, pos, board, piece, onChange) {
  const rect = board.getBoundingClientRect();
  const cx = rect.left + pos.x * rect.width;
  const cy = rect.top + pos.y * rect.height;
  pos.facing = Math.atan2(ev.clientX - cx, -(ev.clientY - cy));
  piece.style.setProperty('--facing', `${(pos.facing * 180) / Math.PI}deg`);
  const labelEl = piece.querySelector('.board-piece-label');
  if (labelEl) placeLabel(labelEl, pos.facing);
  onChange();
}
