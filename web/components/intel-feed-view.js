'use client';

import { buildScrimSignals, buildSignals } from '../lib/intel';
import { EmptyState, PageHeader } from './page-header';

export function IntelFeedView({ teams, members, matches, scrims }) {
  const signals = teams.flatMap((team) => {
    const roster = members.filter((m) => m.team_id === team.id);
    const teamMatches = matches.filter((m) => m.team_id === team.id);
    const teamScrims = scrims.filter((s) => s.team_id === team.id);
    return [...buildSignals(roster, teamMatches), ...buildScrimSignals(teamScrims)].map((s) => ({ ...s, team }));
  }).sort((a, b) => b.weight - a.weight);

  return (
    <>
      <PageHeader title="Intel Feed" subtitle="Performance, map, and roster signals from your matches and scrims" />
      {signals.length === 0 ? (
        <EmptyState
          title="No signals yet"
          body="Once teams have enough matches and scrims on the books, trends show up here automatically."
        />
      ) : (
        <div className="section" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {signals.map((s, i) => (
            <div key={`${s.title}-${i}`} className="card">
              <div className="intel-signal">
                <span className={`intel-signal-icon ${s.tone}`}>{s.glyph}</span>
                <div style={{ flex: 1 }}>
                  <div className="intel-signal-title">
                    {s.title}
                    {teams.length > 1 ? <span className="field-hint"> · {s.team.name}</span> : null}
                  </div>
                  <div className="intel-signal-body">{s.body}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
