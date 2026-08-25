'use client';

import { useState } from 'react';
import { ACCENT_PRESETS, applyAccent, DEFAULT_ACCENT, normalizeHex } from '../lib/accent';
import { saveDoc } from '../lib/docs';
import { CopyJoinAlias } from './copy-join-alias';
import { PageHeader } from './page-header';
import { Err, Field } from './workspace';

export function SettingsView({ org, canEdit }) {
  const [name, setName] = useState(org?.name || '');
  const [tag, setTag] = useState(org?.tag || '');
  const [accent, setAccent] = useState(normalizeHex(org?.accent) || DEFAULT_ACCENT);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function save(e) {
    e.preventDefault();
    setError('');
    setSaved(false);
    try {
      const color = applyAccent(accent);
      await saveDoc({
        kind: 'org',
        teamId: '',
        id: 'profile',
        payload: { ...org, id: 'profile', name: name.trim() || 'My Organization', tag: tag.trim() || null, accent: color },
      });
      setSaved(true);
    } catch (err) {
      setError(err.message || 'Could not save.');
    }
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Org identity, accent, and invite links" />
      <form onSubmit={save} className="card section">
        <div className="section-title">Identity</div>
        <div className="inline-fields">
          <Field label="Org Name"><input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Tag"><input value={tag} onChange={(e) => setTag(e.target.value)} disabled={!canEdit} /></Field>
        </div>
        <div className="section-title" style={{ marginTop: 16 }}>Accent</div>
        <div className="filter-bar">
          {ACCENT_PRESETS.map((preset) => (
            <button
              key={preset.hex}
              type="button"
              className={`mode-chip${accent === preset.hex ? ' active' : ''}`}
              style={{ borderColor: preset.hex }}
              onClick={() => { setAccent(preset.hex); applyAccent(preset.hex); }}
              disabled={!canEdit}
            >
              {preset.name}
            </button>
          ))}
          <input
            type="color"
            className="accent-picker"
            value={accent}
            onChange={(e) => { setAccent(e.target.value); applyAccent(e.target.value); }}
            disabled={!canEdit}
          />
        </div>
        {canEdit ? <button type="submit" className="btn primary" style={{ marginTop: 14 }}>Save Changes</button> : <div className="field-hint">View only — staff change org identity.</div>}
        {saved ? <div className="field-hint" style={{ color: 'var(--win)' }}>Saved.</div> : null}
        <Err error={error} />
      </form>
      <div className="card compact">
        <div className="card-head"><h2>Invites</h2></div>
        <p className="field-hint">Org sign-in: coach.championshipseries.eu/join. <CopyJoinAlias /></p>
        <p className="field-hint">Per-player binds are copied from a team roster.</p>
        <form action="/auth/sign-out" method="post" style={{ marginTop: 16 }}>
          <button type="submit" className="btn sm">Sign out</button>
        </form>
      </div>
    </>
  );
}
