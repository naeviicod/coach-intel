'use client';

import { useState } from 'react';
import { newId, saveDoc } from '../lib/docs';
import { formFromMatches, sortStandings, winPct } from '../lib/standings';
import { EmptyState, PageHeader } from './page-header';
import { Err, Field, FormCard } from './workspace';

export function RankingsView({ teams, matches, rankings, canEdit }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: teams[0]?.name || '', wins: 0, losses: 0, points: 0 });
  const standings = sortStandings(rankings?.teams || []);

  async function addTeam(e) {
    e.preventDefault();
    setError('');
    try {
      const next = {
        id: 'current',
        region: rankings?.region || '',
        teams: [...(rankings?.teams || []), { id: newId('rank'), name: form.name, wins: Number(form.wins) || 0, losses: Number(form.losses) || 0, points: Number(form.points) || 0 }],
      };
      await saveDoc({ kind: 'rankings', teamId: '', id: 'current', payload: next });
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Could not save rankings.');
    }
  }

  return (
    <>
      <PageHeader
        title="Rankings"
        subtitle="League and regional standings alongside your own form"
        actions={canEdit ? <button type="button" className="btn primary" onClick={() => setOpen(true)}>Add Team</button> : null}
      />
      {open ? (
        <FormCard title="Add to the table" onClose={() => setOpen(false)} actions={<button type="submit" form="rank-form" className="btn primary">Save</button>}>
          <form id="rank-form" onSubmit={addTeam} className="inline-fields">
            <Field label="Name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
            <Field label="Wins"><input type="number" value={form.wins} onChange={(e) => setForm({ ...form, wins: e.target.value })} /></Field>
            <Field label="Losses"><input type="number" value={form.losses} onChange={(e) => setForm({ ...form, losses: e.target.value })} /></Field>
            <Field label="Points"><input type="number" value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} /></Field>
          </form>
          <Err error={error} />
        </FormCard>
      ) : null}
      {teams.length ? (
        <>
          <div className="section-title">Your Form</div>
          <div className="grid cols-3" style={{ marginBottom: 22 }}>
            {teams.map((team) => {
              const formCard = formFromMatches(matches.filter((m) => m.team_id === team.id), 10);
              return (
                <div key={team.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{team.name}</div>
                    <span className="pill win" style={formCard.winRate < 50 ? { background: '#ff5c5c22', color: 'var(--loss)' } : undefined}>{formCard.winRate}%</span>
                  </div>
                  <div className="field-hint" style={{ marginTop: 2 }}>{formCard.wins}-{formCard.losses} last {formCard.results.length || 0}</div>
                  {formCard.results.length ? (
                    <div className="form-strip">
                      {formCard.results.slice().reverse().map((r, i) => (
                        <div key={i} className={`form-cell ${r === 'W' ? 'win' : 'loss'}`}>{r}</div>
                      ))}
                    </div>
                  ) : <div className="field-hint" style={{ marginTop: 8 }}>No matches logged yet.</div>}
                </div>
              );
            })}
          </div>
        </>
      ) : null}
      <div className="section-title">{rankings?.region ? `Standings — ${rankings.region}` : 'Standings'}</div>
      {standings.length === 0 ? (
        <EmptyState title="No league table yet" body="Rankings are yours to maintain. Add the teams in your league or region with their records and points." />
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Team</th>
                <th>W</th>
                <th>L</th>
                <th>Pts</th>
                <th>Win %</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row, i) => (
                <tr key={row.id || row.name}>
                  <td>{i + 1}</td>
                  <td>{row.name}</td>
                  <td>{row.wins || 0}</td>
                  <td>{row.losses || 0}</td>
                  <td>{row.points || 0}</td>
                  <td>{winPct(row)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
