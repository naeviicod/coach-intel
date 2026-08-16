import { el, icon, playerAvatar, fmtDue } from '../../utils.js';

export const MODES = [
  { key: 'hardpoint', label: 'Hardpoint', short: 'HP', mode: 'Hardpoint' },
  { key: 'search-destroy', label: 'Search & Destroy', short: 'S&D', mode: 'Search & Destroy' },
  { key: 'overload', label: 'Overload', short: 'OVL', mode: 'Overload' },
];

export function modeByKey(key) {
  return MODES.find((m) => m.key === key) || null;
}

export function modeKeyFor(mode) {
  return MODES.find((m) => m.mode === mode)?.key || null;
}

export function hubHead(title, sub, actions = []) {
  return el('div', { class: 'hub-head', style: 'display:flex;align-items:flex-start;gap:12px;' }, [
    el('div', { style: 'flex:1;min-width:0;' }, [
      el('h1', { class: 'hub-title' }, title),
      sub ? el('div', { class: 'hub-sub' }, sub) : null,
    ]),
    ...actions,
  ]);
}

export function kpi({ label, value, meta, accent = false, onClick, disabled = false }) {
  return el(
    'button',
    {
      type: 'button',
      class: 'kpi',
      disabled: disabled ? '' : null,
      style: disabled ? 'cursor:default;' : null,
      onclick: disabled ? null : onClick,
    },
    [
      el('div', { class: 'kpi-label' }, label),
      el('div', { class: `kpi-value${accent ? ' accent' : ''}` }, String(value)),
      el('div', { class: 'kpi-meta' }, meta),
    ]
  );
}

export function metricRow(name, value, delta) {
  let deltaNode = null;
  if (delta !== null && delta !== undefined && Number.isFinite(delta)) {
    const dir = delta > 0.5 ? 'up' : delta < -0.5 ? 'down' : 'flat';
    const glyph = dir === 'up' ? '↑' : dir === 'down' ? '↓' : '·';
    deltaNode = el('div', { class: `metric-delta ${dir}` }, `${glyph} ${Math.abs(delta)}%`);
  }
  return el('div', { class: 'metric-row' }, [
    el('div', { class: 'metric-name' }, name),
    el('div', { class: 'metric-val' }, String(value)),
    deltaNode || el('div', { class: 'metric-delta flat' }, ''),
  ]);
}

export function avatarStack(members, max = 4) {
  const shown = members.slice(0, max);
  const rest = members.length - shown.length;
  return el('div', { class: 'avatar-stack' }, [
    ...shown.map((m) => playerAvatar(m, { title: m.gamertag })),
    rest > 0 ? el('div', { class: 'more' }, `+${rest}`) : null,
  ]);
}

// Status strings are stored verbatim on the strat record; the pill class is
// derived rather than stored so old records keep rendering.
export function statusPill(status) {
  const key = String(status || 'DRAFT').toLowerCase().replace(/[^a-z]/g, '');
  const cls = ['draft', 'review', 'approved', 'active', 'matchready', 'archived', 'practice'].find((c) =>
    key.includes(c)
  );
  return el('span', { class: `spill ${cls || 'draft'}` }, String(status || 'DRAFT'));
}

export function iconBtn(name, label, onClick) {
  return el('button', {
    type: 'button',
    class: 'icon-btn',
    'aria-label': label,
    title: label,
    html: icon(name, 14),
    onclick: (e) => {
      e.stopPropagation();
      onClick(e);
    },
  });
}

export function miniEmpty(title, body, action = null) {
  return el('div', { class: 'mini-empty' }, [
    el('div', { class: 'title' }, title),
    el('div', {}, body),
    action,
  ]);
}

export function taskRow(task, { onToggle, onOpen } = {}) {
  const due = fmtDue(task.due);
  return el('div', { class: `task-row${task.done ? ' done' : ''}` }, [
    el('button', {
      type: 'button',
      class: `task-check${task.done ? ' done' : ''}`,
      role: 'checkbox',
      'aria-checked': String(!!task.done),
      'aria-label': `${task.done ? 'Reopen' : 'Complete'} ${task.title}`,
      html: task.done ? icon('check', 10) : '',
      onclick: () => onToggle && onToggle(task),
    }),
    el('div', { class: 'task-body', style: onOpen ? 'cursor:pointer;' : null, onclick: onOpen ? () => onOpen(task) : null }, [
      el('div', { class: 'task-title' }, task.title),
      el('div', { class: `task-due${due.overdue && !task.done ? ' overdue' : ''}` }, task.done ? 'Done' : due.label),
    ]),
  ]);
}

export function skeleton(kind, count = 1) {
  const wrap = el('div', {});
  for (let i = 0; i < count; i++) wrap.append(el('div', { class: `skel skel-${kind}` }));
  return wrap;
}

export function inlineError(message, onRetry) {
  return el('div', { class: 'inline-error' }, [
    el('div', { class: 'inline-error-title' }, 'Could not load'),
    el('div', {}, message),
    onRetry ? el('button', { class: 'btn subtle sm', style: 'margin-top:10px;', onclick: onRetry }, 'Retry') : null,
  ]);
}
