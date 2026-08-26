'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { deleteDoc, newId, saveDoc } from '../lib/docs';
import { mapLayoutSrc } from '../lib/maps';
import { TeamMark } from '../lib/marks';
import { mapNames, modeNames, resolveRuleset } from '../lib/ruleset';
import { EmptyState, PageHeader } from './page-header';
import { pickTeam, Err } from './workspace';

const STATUSES = ['DRAFT', 'IN PRACTICE', 'APPROVED', 'MATCH READY'];
const MODES = [
  { key: 'hardpoint', label: 'Hardpoint', short: 'HP', mode: 'Hardpoint' },
  { key: 'search-destroy', label: 'Search & Destroy', short: 'S&D', mode: 'Search & Destroy' },
  { key: 'overload', label: 'Overload', short: 'OVL', mode: 'Overload' },
];

function isArchived(strat) {
  return String(strat.status || '').toUpperCase() === 'ARCHIVED';
}

export function PlaybooksView({ teams, strats, rulesetDocs, teamId, canEdit }) {
  const router = useRouter();
  const search = useSearchParams();
  const team = pickTeam(teams, teamId);
  const ruleset = resolveRuleset(rulesetDocs);
  const maps = mapNames(ruleset);
  const modes = modeNames(ruleset);
  const teamStrats = strats.filter((s) => s.team_id === team?.id);
  const [modeKey, setModeKey] = useState('');
  const [mapFilter, setMapFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    strategy_name: '',
    map: maps[0] || '',
    mode: modes[0] || '',
    status: 'DRAFT',
    notes: '',
  });

  const modeFilter = MODES.find((m) => m.key === modeKey) || null;
  const shown = useMemo(
    () =>
      teamStrats
        .filter((s) => (modeFilter ? s.mode === modeFilter.mode : true))
        .filter((s) => (mapFilter ? s.map === mapFilter : true))
        .filter((s) => !isArchived(s))
        .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || ''))),
    [teamStrats, modeFilter, mapFilter]
  );

  const mapOptions = [
    ...new Set([
      ...(ruleset?.maps || []).filter((m) => m.active !== false).map((m) => m.name),
      ...teamStrats.map((s) => s.map),
    ]),
  ]
    .filter(Boolean)
    .sort();

  if (!teams.length) {
    return (
      <>
        <PageHeader title="Strats & Playbooks" subtitle="Shared strats for the team" />
        <EmptyState title="No teams yet" body="Create a team before you write strats." />
      </>
    );
  }

  function setTeam(nextId) {
    const next = new URLSearchParams(search.toString());
    next.set('team', nextId);
    router.push(`/playbooks?${next.toString()}`);
  }

  function startNew() {
    setEditing({});
    setForm({
      strategy_name: '',
      map: maps[0] || '',
      mode: modes[0] || '',
      status: 'DRAFT',
      notes: '',
    });
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

  function modeCount(mode) {
    return teamStrats.filter((s) => !mode || s.mode === mode).filter((s) => !isArchived(s)).length;
  }

  const layoutSrc = mapLayoutSrc(form.map, form.mode);
  const selected = editing && (editing.strategy_id || editing.id);

  return (
    <div className="playbooks">
      <aside className="playbooks-rail" aria-label="Playbooks">
        <div className="playbooks-team">
          <div className="playbooks-team-id">
            <TeamMark team={team} className="sb-org-logo" />
            <div className="team-select-id">
              {teams.length > 1 ? (
                <select
                  aria-label="Team"
                  className="team-select-name"
                  value={team.id}
                  onChange={(e) => setTeam(e.target.value)}
                  style={{ background: 'transparent', border: 0, color: 'inherit', font: 'inherit', fontWeight: 700 }}
                >
                  {teams.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="team-select-name">{team.name}</div>
              )}
              <div className="team-select-sub">{team.tag ? `${team.tag} · Playbooks` : 'Playbooks'}</div>
            </div>
          </div>
        </div>
        <div className="playbooks-rail-head">
          <div>
            <div className="playbooks-rail-title">Playbooks</div>
            <div className="field-hint">{`${teamStrats.filter((s) => !isArchived(s)).length} strat${teamStrats.filter((s) => !isArchived(s)).length === 1 ? '' : 's'}`}</div>
          </div>
          {canEdit ? (
            <button type="button" className="btn primary sm edit-only" onClick={startNew}>
              + New
            </button>
          ) : null}
        </div>
        <div className="playbooks-modes">
          {[{ key: '', short: 'All', mode: null }, ...MODES].map((entry) => {
            const on = (entry.key || '') === modeKey;
            return (
              <button
                key={entry.key || 'all'}
                type="button"
                className={`mode-chip${on ? ' active' : ''}`}
                aria-pressed={on}
                onClick={() => setModeKey(entry.key || '')}
              >
                {`${entry.short || entry.label} · ${modeCount(entry.mode)}`}
              </button>
            );
          })}
        </div>
        <div className="playbooks-map-filter">
          <select aria-label="Filter by map" value={mapFilter} onChange={(e) => setMapFilter(e.target.value)}>
            <option value="">All Maps</option>
            {mapOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="playbooks-list">
          {shown.length === 0 ? (
            <div className="field-hint" style={{ padding: '10px 4px' }}>
              {modeFilter || mapFilter ? 'No strats match these filters.' : 'No strats yet. Draw the first one.'}
            </div>
          ) : (
            shown.map((strat) => {
              const id = strat.strategy_id || strat.id;
              const active = Boolean(selected && id === selected);
              return (
                <div
                  key={id}
                  className={`crow playbooks-row${active ? ' active' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-current={active ? 'page' : undefined}
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setEditing(strat);
                    }
                  }}
                >
                  <div className="crow-main">
                    <div className="crow-title">{strat.strategy_name || 'Untitled strat'}</div>
                    <div className="crow-sub">
                      <span>{strat.map || 'No map'}</span>
                      <span>·</span>
                      <span>{strat.mode || 'No mode'}</span>
                      {strat.objective_key ? <span>·</span> : null}
                      {strat.objective_key ? <span>{strat.objective_key}</span> : null}
                    </div>
                  </div>
                  <span className="pill">{strat.status || 'DRAFT'}</span>
                </div>
              );
            })
          )}
        </div>
      </aside>
      <div className="playbooks-stage">
        {editing ? (
          <form id="strat-form" className="playbooks-empty" onSubmit={save} style={{ alignItems: 'stretch', textAlign: 'left', gap: 14, maxWidth: 720, margin: '0 auto' }}>
            <div className="playbooks-empty-kicker">{editing.strategy_id || editing.id ? 'Edit strat' : 'New strat'}</div>
            <div className="inline-fields">
              <label className="field">
                <span>Name</span>
                <input value={form.strategy_name} onChange={(e) => setForm({ ...form, strategy_name: e.target.value })} required />
              </label>
              <label className="field">
                <span>Map</span>
                <select value={form.map} onChange={(e) => setForm({ ...form, map: e.target.value })}>
                  {maps.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Mode</span>
                <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                  {modes.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Status</span>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span>Callouts / notes</span>
              <textarea rows={6} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
            {layoutSrc ? (
              <div className="board-bg has-map strat-map-preview">
                <img className="board-map" src={layoutSrc} alt={`${form.map} ${form.mode}`} />
              </div>
            ) : null}
            <Err error={error} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="submit" className="btn primary">
                Save
              </button>
              {canEdit && (editing.strategy_id || editing.id) ? (
                <button
                  type="button"
                  className="btn"
                  onClick={async () => {
                    await deleteDoc({ kind: 'strat', teamId: team.id, id: editing.strategy_id || editing.id });
                    window.location.reload();
                  }}
                >
                  Delete
                </button>
              ) : null}
            </div>
          </form>
        ) : (
          <div className="playbooks-empty">
            <div className="playbooks-empty-kicker">{team.name}</div>
            <div className="playbooks-empty-title">Strats & Playbooks</div>
            <div className="playbooks-empty-copy">Pick a strat from the left, or start a new one on a blueprint.</div>
            {canEdit ? (
              <button type="button" className="btn primary edit-only" onClick={startNew}>
                + New Strat
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
