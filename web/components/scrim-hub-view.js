'use client';

import { useState } from 'react';
import { deleteDoc, newId, saveDoc } from '../lib/docs';
import { fmtDate } from '../lib/marks';
import { pickTeam, TeamPicker, Kpi, Field, FormCard, Err } from './workspace';
import { EmptyState, PageHeader } from './page-header';

function tally(scrim) {
  let w = 0;
  let l = 0;
  for (const m of scrim.maps || []) {
    if (m.result === 'Win') w += 1;
    else if (m.result === 'Loss') l += 1;
  }
  return { w, l };
}

function outcome(scrim) {
  const { w, l } = tally(scrim);
  if (!w && !l) return null;
  return w > l ? 'Win' : w < l ? 'Loss' : 'Tie';
}

export function ScrimHubView({ teams, scrims, teamId, canEdit }) {
  const team = pickTeam(teams, teamId);
  const list = scrims.filter((s) => s.team_id === team?.id);
  const upcoming = list.filter((s) => s.status === 'scheduled');
  const completed = list.filter((s) => s.status === 'completed');
  let blockW = 0;
  let blockL = 0;
  for (const s of completed) {
    const o = outcome(s);
    if (o === 'Win') blockW += 1;
    else if (o === 'Loss') blockL += 1;
  }
  let mapW = 0;
  let mapL = 0;
  for (const s of completed) {
    const t = tally(s);
    mapW += t.w;
    mapL += t.l;
  }
  const mapWr = mapW + mapL ? Math.round((mapW / (mapW + mapL)) * 100) : 0;
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ opponent: '', date: new Date().toISOString().slice(0, 10), format: 'Bo5', notes: '' });

  if (!teams.length) {
    return (
      <>
        <PageHeader title="Scrim Hub" subtitle="Scrim scheduling, opponent booking and block results" />
        <EmptyState title="No teams yet" body="Create a team before booking scrims." />
      </>
    );
  }

  async function book(e) {
    e.preventDefault();
    setError('');
    try {
      const id = newId('scrim');
      await saveDoc({
        kind: 'scrim',
        teamId: team.id,
        id,
        payload: { scrim_id: id, team_id: team.id, opponent: form.opponent, date: form.date, format: form.format, status: 'scheduled', notes: form.notes, maps: [], lineup: [] },
      });
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Could not book scrim.');
    }
  }

  return (
    <>
      <PageHeader
        title="Scrim Hub"
        subtitle={`${team.name} — scheduling and block results`}
        actions={(
          <div style={{ display: 'flex', gap: 8 }}>
            <TeamPicker teams={teams} teamId={team.id} />
            {canEdit ? <button type="button" className="btn primary" onClick={() => setOpen(true)}>Book Scrim</button> : null}
          </div>
        )}
      />
      {open ? (
        <FormCard title="Book scrim" onClose={() => setOpen(false)} actions={<button type="submit" form="scrim-form" className="btn primary">Save</button>}>
          <form id="scrim-form" onSubmit={book} className="inline-fields">
            <Field label="Opponent"><input value={form.opponent} onChange={(e) => setForm({ ...form, opponent: e.target.value })} required /></Field>
            <Field label="Date"><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Format">
              <select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}>
                {['Bo3', 'Bo5', 'Bo7', 'Custom'].map((f) => <option key={f}>{f}</option>)}
              </select>
            </Field>
            <Field label="Notes"><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </form>
          <Err error={error} />
        </FormCard>
      ) : null}
      <div className="kpi-row">
        <Kpi label="Upcoming" value={upcoming.length} meta="Booked scrims" />
        <Kpi label="Completed" value={completed.length} meta="With results" />
        <Kpi label="Block Record" value={`${blockW}-${blockL}`} meta="Series won-lost" accent={blockW >= blockL && blockW > 0} />
        <Kpi label="Map Win Rate" value={`${mapWr}%`} meta={`${mapW}-${mapL} maps`} />
      </div>
      {list.length === 0 ? (
        <EmptyState title="No scrims yet" body="Book a scrim to put it on the calendar and record map results." />
      ) : (
        <div className="card">
          {list.map((scrim) => {
            const t = tally(scrim);
            return (
              <div key={scrim.scrim_id || scrim.id} className="crow">
                <div className="crow-main">
                  <div className="crow-title">vs {scrim.opponent}</div>
                  <div className="crow-sub">{[scrim.format, scrim.status, t.w + t.l ? `${t.w}-${t.l}` : 'No maps'].join(' · ')}</div>
                </div>
                <div className="crow-meta">{scrim.date ? fmtDate(String(scrim.date).slice(0, 10)) : '—'}</div>
                {canEdit && scrim.status === 'scheduled' ? (
                  <button
                    type="button"
                    className="btn sm"
                    onClick={async () => {
                      const id = scrim.scrim_id || scrim.id;
                      await saveDoc({ kind: 'scrim', teamId: team.id, id, payload: { ...scrim, status: 'completed' } });
                      window.location.reload();
                    }}
                  >
                    Mark done
                  </button>
                ) : null}
                {canEdit ? (
                  <button
                    type="button"
                    className="btn sm"
                    onClick={async () => {
                      await deleteDoc({ kind: 'scrim', teamId: team.id, id: scrim.scrim_id || scrim.id });
                      window.location.reload();
                    }}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
