'use client';

import { useState } from 'react';
import { mapCoverSrc, mapModeArts } from '../lib/maps';
import { statsByKey } from '../lib/stats';
import { activeMaps, modeNames, resolveRuleset } from '../lib/ruleset';
import { EmptyState, PageHeader } from './page-header';
import { pickTeam, TeamPicker } from './workspace';

export function MapsModesView({ teams, matches, rulesetDocs, teamId }) {
  const team = pickTeam(teams, teamId);
  const ruleset = resolveRuleset(rulesetDocs);
  const [mode, setMode] = useState('All');
  const teamMatches = matches.filter((m) => m.team_id === team?.id);
  const mapStats = new Map(statsByKey(teamMatches, (m) => m.map).map((s) => [s.key, s]));
  const modeStats = statsByKey(teamMatches, (m) => m.mode);

  if (!teams.length) {
    return (
      <>
        <PageHeader title="Maps & Modes" subtitle="Callouts and objectives for the current ruleset" />
        <EmptyState title="No teams yet" body="Create a team to see map stats against the CDL pool." />
      </>
    );
  }

  const maps = activeMaps(ruleset).filter((m) => mode === 'All' || (m.modes || []).includes(mode));

  return (
    <>
      <PageHeader
        title="Maps & Modes"
        subtitle={`${team.name} — official CDL map pool`}
        actions={<TeamPicker teams={teams} teamId={team.id} />}
      />
      <div className="card compact" style={{ marginBottom: 14 }}>
        <div className="card-head">
          <h2>{ruleset.game} · Season {ruleset.season} · v{ruleset.version}</h2>
          <div className="card-meta">Checked {ruleset.last_checked}</div>
        </div>
        {modeStats.length ? (
          <div className="field-hint">
            {modeStats.map((s) => `${s.key} ${s.wins}-${s.losses} (${s.winRate}%)`).join(' · ')}
          </div>
        ) : null}
      </div>
      <div className="filter-bar">
        {['All', ...modeNames(ruleset)].map((m) => (
          <button key={m} type="button" className={`mode-chip${mode === m ? ' active' : ''}`} onClick={() => setMode(m)}>
            {m}
          </button>
        ))}
      </div>
      <div className="grid cols-3">
        {maps.map((m) => {
          const stats = mapStats.get(m.name);
          const src = mapCoverSrc(m.name);
          const arts = mapModeArts(m.name, m.modes);
          return (
            <div key={m.map_id || m.name} className="card map-card">
              {src ? (
                <div className="map-thumb cover map-card-cover">
                  <img src={src} alt="" />
                </div>
              ) : null}
              <div className="map-card-body">
                <div className="card-head">
                  <h2>{m.name}</h2>
                  {m.competitive_pool ? <span className="pill">CDL</span> : null}
                </div>
                <div className="field-hint">{(m.modes || []).join(' · ')}</div>
                <div className="kpi-value" style={{ marginTop: 10 }}>{stats ? `${stats.winRate}%` : '—'}</div>
                <div className="kpi-meta">{stats ? `${stats.wins}-${stats.losses} over ${stats.total}` : 'No matches logged'}</div>
                {arts.length ? (
                  <div className="map-mode-arts">
                    {arts.map((art) => (
                      <div key={art.mode} className="map-mode-art">
                        <img src={art.src} alt="" />
                        <span>{modeAbbrev(art.mode)}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {m.notes ? <p className="field-hint" style={{ marginTop: 8 }}>{m.notes}</p> : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function modeAbbrev(mode) {
  if (mode === 'Search & Destroy') return 'S&D';
  if (mode === 'Hardpoint') return 'HP';
  if (mode === 'Overload') return 'OVL';
  return mode;
}
