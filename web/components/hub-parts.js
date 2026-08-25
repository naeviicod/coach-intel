'use client';

import { Icon } from './icon';

export function HubHead({ title, sub, children }) {
  return (
    <div className="hub-head" style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 className="hub-title">{title}</h1>
        {sub ? <div className="hub-sub">{sub}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function MiniEmpty({ title, body, children }) {
  return (
    <div className="mini-empty">
      <div className="title">{title}</div>
      {body ? <div>{body}</div> : null}
      {children}
    </div>
  );
}

export function MetricRow({ name, value, delta }) {
  let deltaNode = <div className="metric-delta flat" />;
  if (delta !== null && delta !== undefined && Number.isFinite(delta)) {
    const dir = delta > 0.5 ? 'up' : delta < -0.5 ? 'down' : 'flat';
    const glyph = dir === 'up' ? '↑' : dir === 'down' ? '↓' : '·';
    deltaNode = <div className={`metric-delta ${dir}`}>{`${glyph} ${Math.abs(delta)}%`}</div>;
  }
  return (
    <div className="metric-row">
      <div className="metric-name">{name}</div>
      <div className="metric-val">{value}</div>
      {deltaNode}
    </div>
  );
}

export function CtxToggle({ open, onToggle }) {
  return (
    <button
      type="button"
      className="icon-btn ctx-toggle"
      aria-label="Toggle context panel"
      aria-expanded={String(open)}
      title="Context panel"
      onClick={onToggle}
    >
      <Icon name="panel" size={14} />
    </button>
  );
}

export function TaskRow({ task, canEdit, onToggle }) {
  return (
    <div className={`task-row${task.done ? ' done' : ''}${!task.done && task.overdue ? ' overdue' : ''}`}>
      <button
        type="button"
        className={`task-check edit-only${task.done ? ' done' : ''}`}
        role="checkbox"
        aria-checked={String(!!task.done)}
        aria-label={`${task.done ? 'Reopen' : 'Complete'} ${task.title}`}
        disabled={!canEdit}
        onClick={() => canEdit && onToggle?.(task)}
      >
        {task.done ? <Icon name="check" size={10} /> : null}
      </button>
      <div className="task-body">
        <div className="task-title">{task.title}</div>
        <div className="task-meta-row">
          <div className={`task-due${task.overdue && !task.done ? ' overdue' : ''}`}>
            {task.done ? 'Done' : task.dueLabel}
          </div>
        </div>
      </div>
    </div>
  );
}
