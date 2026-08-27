'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// A real centered dialog, portaled to <body> so it can never get trapped
// inside a card's overflow/stacking context or collide with another panel
// mid-page. Mirrors the desktop app's openModal (same CSS classes, same
// press-and-release-on-backdrop dismissal so a drag-select doesn't close it).
export function Modal({ children, onClose, width }) {
  const pressedOnBackdrop = useRef(false);
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose?.();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="modal-overlay"
      onPointerDown={(e) => {
        pressedOnBackdrop.current = e.target === e.currentTarget;
      }}
      onPointerUp={(e) => {
        const close = pressedOnBackdrop.current && e.target === e.currentTarget;
        pressedOnBackdrop.current = false;
        if (close) onClose?.();
      }}
    >
      <div className="modal" style={width ? { width } : undefined} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>,
    document.body
  );
}

export function pickTeam(teams, teamId) {
  return teams.find((t) => t.id === teamId) || teams[0] || null;
}

export function TeamPicker({ teams, teamId }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  if (!teams?.length || teams.length < 2) return null;
  return (
    <select
      aria-label="Team"
      value={teamId || teams[0]?.id || ''}
      onChange={(e) => {
        const next = new URLSearchParams(search.toString());
        next.set('team', e.target.value);
        router.push(`${pathname}?${next.toString()}`);
      }}
    >
      {teams.map((team) => (
        <option key={team.id} value={team.id}>
          {team.name}
        </option>
      ))}
    </select>
  );
}

export function Field({ label, children }) {
  return (
    <div className="field">
      {label ? <label>{label}</label> : null}
      {children}
    </div>
  );
}

export function FormCard({ title, onClose, children, actions }) {
  return (
    <div className="card section" style={{ marginBottom: 14 }}>
      <div className="card-head">
        <h2>{title}</h2>
        {onClose ? (
          <button type="button" className="btn subtle sm" onClick={onClose}>
            Cancel
          </button>
        ) : null}
      </div>
      {children}
      {actions ? <div className="settings-actions" style={{ marginTop: 12 }}>{actions}</div> : null}
    </div>
  );
}

export function Kpi({ label, value, meta, accent }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value${accent ? ' accent' : ''}`}>{value}</div>
      <div className="kpi-meta">{meta}</div>
    </div>
  );
}

export function Err({ error }) {
  if (!error) return null;
  return <div className="field-hint" style={{ color: 'var(--loss)', marginTop: 8 }}>{error}</div>;
}
