'use client';

import { useState } from 'react';
import Link from 'next/link';
import { deleteDoc, newId, saveDoc } from '../lib/docs';
import { teamWinRate } from '../lib/stats';
import { collectVetoes, intelForOpponent, summaryLines } from '../lib/vetoIntel';
import { EmptyState, PageHeader } from './page-header';
import { Err, Field, FormCard, Kpi } from './workspace';

export function ScoutingView({ opponents, matches, vetoes, canEdit }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', tag: '', region: '', tendencies: '', notes: '' });
  const catalog = collectVetoes({ teamVetoes: vetoes, opponents });

  async function add(e) {
    e.preventDefault();
    setError('');
    try {
      const id = newId('opp');
      await saveDoc({
        kind: 'opponent',
        teamId: '',
        id,
        payload: { opponent_id: id, name: form.name, tag: form.tag, region: form.region, tendencies: form.tendencies, notes: form.notes, players: [], map_notes: [], intel: [], veto_history: [] },
      });
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Could not save opponent.');
    }
  }

  return (
    <>
      <PageHeader
        title="Scouting"
        subtitle="Opponent breakdowns and matchup prep"
        actions={canEdit ? <button type="button" className="btn primary" onClick={() => setOpen(true)}>Add Opponent</button> : null}
      />
      {open ? (
        <FormCard title="Scout opponent" onClose={() => setOpen(false)} actions={<button type="submit" form="opp-form" className="btn primary">Save</button>}>
          <form id="opp-form" onSubmit={add} className="inline-fields">
            <Field label="Name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
            <Field label="Tag"><input value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} /></Field>
            <Field label="Region"><input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} /></Field>
            <Field label="Tendencies"><input value={form.tendencies} onChange={(e) => setForm({ ...form, tendencies: e.target.value })} /></Field>
          </form>
          <Field label="Notes"><textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <Err error={error} />
        </FormCard>
      ) : null}
      {opponents.length === 0 ? (
        <EmptyState title="No opponents scouted yet" body="Build a scouting profile for a team you expect to face — roster, map tendencies and head-to-head in one place." />
      ) : (
        <div className="grid cols-2">
          {opponents.map((opp) => {
            const id = opp.opponent_id || opp.id;
            const h2h = matches.filter((m) => (m.opponent || '').toLowerCase() === (opp.name || '').toLowerCase());
            const intel = intelForOpponent(opp.name, catalog);
            const lines = summaryLines(intel, 2);
            return (
              <div key={id} className="card">
                <div className="card-head">
                  <h2>{opp.name}</h2>
                  {opp.tag ? <span className="pill">{opp.tag}</span> : null}
                </div>
                <div className="kpi-row" style={{ marginBottom: 8 }}>
                  <Kpi label="H2H" value={`${h2h.filter((m) => String(m.result).toLowerCase() === 'win').length}-${h2h.filter((m) => m.result && String(m.result).toLowerCase() !== 'win').length}`} meta={`${h2h.length} matches`} />
                  <Kpi label="Win rate" value={`${teamWinRate(h2h)}%`} meta={opp.region || '—'} />
                </div>
                {lines.map((line) => <div key={line} className="field-hint">{line}</div>)}
                {opp.notes ? <p style={{ marginTop: 8 }}>{opp.notes}</p> : null}
                <div className="team-card-actions">
                  <Link className="btn sm" href={`/war-room?opponent=${encodeURIComponent(id)}`}>War Room</Link>
                  {canEdit ? (
                    <button
                      type="button"
                      className="btn sm"
                      onClick={async () => {
                        await deleteDoc({ kind: 'opponent', teamId: '', id });
                        window.location.reload();
                      }}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
