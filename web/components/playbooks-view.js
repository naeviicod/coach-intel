'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { resolveRuleset } from '../lib/ruleset';
import { TeamMark } from '../lib/marks';
import { EmptyState, PageHeader } from './page-header';
import { StratBoard } from './strat-board';
import { pickTeam } from './workspace';

const MODES = [
  { key: 'hardpoint', label: 'Hardpoint', short: 'HP', mode: 'Hardpoint' },
  { key: 'search-destroy', label: 'Search & Destroy', short: 'S&D', mode: 'Search & Destroy' },
  { key: 'overload', label: 'Overload', short: 'OVL', mode: 'Overload' },
];

function isArchived(strat) {
  return String(strat.status || '').toUpperCase() === 'ARCHIVED';
}

export function PlaybooksView({ teams, strats, members, rulesetDocs, teamId, canEdit }) {
  const router = useRouter();
  const search = useSearchParams();
  const team = pickTeam(teams, teamId);
  const ruleset = resolveRuleset(rulesetDocs);
  const teamStrats = strats.filter((s) => s.team_id === team?.id);
  const [modeKey, setModeKey] = useState('');
  const [mapFilter, setMapFilter] = useState('');
  const [editing, setEditing] = useState(null);

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

  function modeCount(mode) {
    return teamStrats.filter((s) => !mode || s.mode === mode).filter((s) => !isArchived(s)).length;
  }

  const selectedId = editing && (editing.strategy_id || editing.id);

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
            <button type="button" className="btn primary sm edit-only" onClick={() => setEditing({})}>
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
            shown.map((row) => {
              const id = row.strategy_id || row.id;
              const active = Boolean(selectedId && id === selectedId);
              return (
                <div
                  key={id}
                  className={`crow playbooks-row${active ? ' active' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setEditing(row)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setEditing(row);
                    }
                  }}
                >
                  <div className="crow-main">
                    <div className="crow-title">{row.strategy_name || 'Untitled strat'}</div>
                    <div className="crow-sub">
                      <span>{row.map || 'No map'}</span>
                      <span>·</span>
                      <span>{row.mode || 'No mode'}</span>
                      {row.objective_key ? <span>·</span> : null}
                      {row.objective_key ? <span>{row.objective_key}</span> : null}
                    </div>
                  </div>
                  <span className="pill">{row.status || 'DRAFT'}</span>
                </div>
              );
            })
          )}
        </div>
      </aside>
      <div className="playbooks-stage">
        {editing ? (
          <StratBoard
            key={editing.strategy_id || editing.id || 'new'}
            team={team}
            members={members}
            strat={editing.strategy_id || editing.id ? editing : null}
            ruleset={ruleset}
            canEdit={canEdit}
            onClose={() => setEditing(null)}
            onSaved={(saved) => {
              setEditing(saved);
              router.refresh();
            }}
          />
        ) : (
          <div className="playbooks-empty">
            <div className="playbooks-empty-kicker">{team.name}</div>
            <div className="playbooks-empty-title">Strats & Playbooks</div>
            <div className="playbooks-empty-copy">Pick a strat from the left, or start a new one on a blueprint.</div>
            {canEdit ? (
              <button type="button" className="btn primary edit-only" onClick={() => setEditing({})}>
                + New Strat
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
