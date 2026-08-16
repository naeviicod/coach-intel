import { el, icon } from '../../utils.js';

export const MAX_PER_TEAM = 4;

const US_SLOTS = [
  { x: 0.22, y: 0.68, facing: 0.18 },
  { x: 0.32, y: 0.78, facing: -0.08 },
  { x: 0.16, y: 0.54, facing: 0.42 },
  { x: 0.30, y: 0.58, facing: 0.62 },
];

const THEM_SLOTS = [
  { x: 0.78, y: 0.32, facing: Math.PI + 0.18 },
  { x: 0.68, y: 0.22, facing: Math.PI - 0.08 },
  { x: 0.84, y: 0.46, facing: Math.PI + 0.42 },
  { x: 0.70, y: 0.42, facing: Math.PI + 0.62 },
];

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
    normalizePos({ member_id: m.id, ...US_SLOTS[i] })
  );
  const them = THEM_SLOTS.map((slot) => normalizePos({ opponent: true, ...slot }));
  return [...us, ...them];
}

export function nextOpponentSlot(existing) {
  const used = (existing || []).filter((p) => p.opponent);
  if (used.length >= MAX_PER_TEAM) return null;
  return normalizePos({ opponent: true, ...THEM_SLOTS[used.length] });
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

export function renderPiece(pos, member, { board, number, selected, onChange, onRemove, onSelect }) {
  const raw = pos.opponent ? `Opp ${number}` : member?.gamertag || `P${number}`;
  const label = shortLabel(raw);
  const piece = el('div', {
    class: `board-piece${pos.opponent ? ' opponent' : ' us'}${selected ? ' selected' : ''}`,
    style: `left:${pos.x * 100}%;top:${pos.y * 100}%;--facing:${(pos.facing * 180) / Math.PI}deg;`,
  });

  const rot = el('div', { class: 'board-piece-rot', html: pieceSvg(number) });
  const num = el('div', { class: 'board-piece-n' }, String(number));
  const name = el('div', { class: 'board-piece-label', title: raw }, label);
  placeLabel(name, pos.facing);
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

  piece.append(rot, num, name, remove);
  piece.addEventListener('contextmenu', (e) => e.preventDefault());

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
