'use client';

import { useState } from 'react';
import { saveTeam } from '../lib/docs';
import { TeamMark } from '../lib/marks';
import { HubHead } from './hub-parts';

export function HubSettings({ team, members, strats, matches, notes, tasks, canEdit, ctxToggle }) {
  const [name, setName] = useState(team.name || '');
  const [tag, setTag] = useState(team.tag || '');
  const [status, setStatus] = useState('');
  const [tone, setTone] = useState('');

  async function save() {
    if (!canEdit) return;
    if (!name.trim()) {
      setStatus('Team name cannot be empty.');
      setTone('var(--loss)');
      return;
    }
    await saveTeam({ id: team.id, name: name.trim(), tag: tag.trim() });
    setStatus('Saved.');
    setTone('');
  }

  return (
    <>
      <HubHead title="Team Settings" sub={`Identity and stored data for ${team.name}`}>
        {ctxToggle}
      </HubHead>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-head"><div className="card-title">Identity</div></div>
        <div className="logo-well" style={{ marginBottom: 14 }}>
          <TeamMark team={team} className="team-logo lg" />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="settings-row-title">Team logo</div>
            <div className="field-hint">Square PNG or JPG. Shown on Teams, Players, and Roster.</div>
          </div>
        </div>
        <div className="grid cols-2">
          <div>
            <label className="field-label">Team name</label>
            <input type="text" value={name} aria-label="Team name" disabled={!canEdit} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Tag</label>
            <input type="text" value={tag} placeholder="e.g. NAV" aria-label="Team tag" disabled={!canEdit} onChange={(e) => setTag(e.target.value)} />
          </div>
        </div>
        {status ? <div className="field-hint" style={{ marginTop: 10, color: tone || undefined }}>{status}</div> : null}
        {canEdit ? (
          <div style={{ marginTop: 12 }}>
            <button type="button" className="btn primary sm edit-only" onClick={save}>Save Changes</button>
          </div>
        ) : null}
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-head"><div className="card-title">Stored for this team</div></div>
        <div className="kpi-row">
          <Stat label="Members" value={members.length} />
          <Stat label="Strats" value={strats.length} />
          <Stat label="Matches" value={matches.length} />
          <Stat label="Notes" value={notes.length} />
          <Stat label="Tasks" value={tasks.length} />
        </div>
        <div className="field-hint" style={{ marginTop: 10 }}>{`Team ID: ${team.id}`}</div>
      </div>
    </>
  );
}

function Stat({ label, value }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}
