'use client';

import { useMemo, useState } from 'react';
import { deleteDoc, newId, saveDoc } from '../lib/docs';
import { mapNames, modeNames, resolveRuleset } from '../lib/ruleset';
import { EmptyState, PageHeader } from './page-header';
import { pickTeam, TeamPicker, Err, Field, FormCard } from './workspace';

const STATUSES = ['DRAFT', 'IN PRACTICE', 'APPROVED', 'MATCH READY'];

export function PlaybooksView({ teams, strats, rulesetDocs, teamId, canEdit }) {
  const team = pickTeam(teams, teamId);
  const ruleset = resolveRuleset(rulesetDocs);
  const maps = mapNames(ruleset);
  const modes = modeNames(ruleset);
  const teamStrats = strats.filter((s) => s.team_id === team?.id);
  const [mode, setMode] = useState('');
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ strategy_name: '', map: maps[0] || '', mode: modes[0] || '', status: 'DRAFT', notes: '' });

  const shown = useMemo(
    () => teamStrats.filter((s) => !mode || s.mode === mode),
    [teamStrats, mode]
  );

  if (!teams.length) {
    return (
      <>
        <PageHeader title="Strats & Playbooks" subtitle="Shared strats for the team" />
        <EmptyState title="No teams yet" body="Create a team before you write strats." />
      </>
    );
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      const id = editing?.strategy_id || editing?.id || newId('strat');
      await saveDoc({
        kind: 'strat',
        teamId: team.id,
        id,
        payload: {
          ...editing,
          strategy_id: id,
          strategy_name: form.strategy_name,
          map: form.map,
          mode: form.mode,
          status: form.status,
          notes: form.notes,
          team_id: team.id,
          player_positions: editing?.player_positions || [],
          drawings: editing?.drawings || [],
        },
      });
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Could not save strat.');
    }
  }

  return (
    <>
      <PageHeader
        title="Strats & Playbooks"
        subtitle={`${team.name} — pick a strat or start a new one`}
        actions={(
          <div style={{ display: 'flex', gap: 8 }}>
            <TeamPicker teams={teams} teamId={team.id} />
            {canEdit ? <button type="button" className="btn primary" onClick={() => { setEditing({}); setForm({ strategy_name: '', map: maps[0] || '', mode: modes[0] || '', status: 'DRAFT', notes: '' }); }}>+ New Strat</button> : null}
          </div>
        )}
      />
      {editing ? (
        <FormCard title={editing.strategy_id ? 'Edit strat' : 'New strat'} onClose={() => setEditing(null)} actions={<button type="submit" form="strat-form" className="btn primary">Save</button>}>
          <form id="strat-form" onSubmit={save}>
            <div className="inline-fields">
              <Field label="Name"><input value={form.strategy_name} onChange={(e) => setForm({ ...form, strategy_name: e.target.value })} required /></Field>
              <Field label="Map">
                <select value={form.map} onChange={(e) => setForm({ ...form, map: e.target.value })}>
                  {maps.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="Mode">
                <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                  {modes.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Callouts / notes">
              <textarea rows={6} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </form>
          <Err error={error} />
        </FormCard>
      ) : null}
      <div className="filter-bar">
        <select aria-label="Mode" value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="">All modes</option>
          {modes.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      {shown.length === 0 ? (
        <EmptyState title="No strats yet" body="Save a playbook card with map, mode, status and callouts. The drawing board still lives in the desktop app; the cards themselves sync here." />
      ) : (
        <div className="grid cols-2">
          {shown.map((strat) => (
            <div key={strat.strategy_id || strat.id} className="card">
              <div className="card-head">
                <h2>{strat.strategy_name || 'Untitled'}</h2>
                <span className="pill">{strat.status || 'DRAFT'}</span>
              </div>
              <div className="field-hint">{[strat.map, strat.mode].filter(Boolean).join(' · ')}</div>
              {strat.notes ? <p style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>{strat.notes}</p> : null}
              {canEdit ? (
                <div className="team-card-actions">
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => {
                      setEditing(strat);
                      setForm({
                        strategy_name: strat.strategy_name || '',
                        map: strat.map || maps[0] || '',
                        mode: strat.mode || modes[0] || '',
                        status: strat.status || 'DRAFT',
                        notes: strat.notes || '',
                      });
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn sm"
                    onClick={async () => {
                      await deleteDoc({ kind: 'strat', teamId: team.id, id: strat.strategy_id || strat.id });
                      window.location.reload();
                    }}
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
