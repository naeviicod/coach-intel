'use client';

import { useMemo, useState } from 'react';
import { buildOpponentReport, buildTeamReport } from '../lib/report';
import { EmptyState, PageHeader } from './page-header';
import { Kpi } from './workspace';

export function ReportsView({ teams, members, matches, scrims, opponents, embedded, lockedTeamId }) {
  const [type, setType] = useState('team');
  const [teamId, setTeamId] = useState(lockedTeamId || teams[0]?.id || '');
  const [opponentId, setOpponentId] = useState(opponents[0]?.opponent_id || opponents[0]?.id || '');

  const report = useMemo(() => {
    if (!teams.length) return null;
    if (type === 'opponent') {
      const opponent = opponents.find((o) => (o.opponent_id || o.id) === opponentId) || opponents[0];
      if (!opponent) return null;
      return buildOpponentReport({ opponent, matches });
    }
    const team = teams.find((t) => t.id === teamId) || teams[0];
    return buildTeamReport({
      team,
      matches: matches.filter((m) => m.team_id === team.id),
      members: members.filter((m) => m.team_id === team.id),
      scrims: scrims.filter((s) => s.team_id === team.id),
    });
  }, [type, teamId, opponentId, teams, members, matches, scrims, opponents]);

  if (!teams.length) {
    return (
      <>
        {embedded ? null : <PageHeader title="Reports" subtitle="Exportable opponent and performance reports" />}
        <EmptyState title="No teams yet" body="Create a team and log some matches to generate reports." />
      </>
    );
  }

  return (
    <>
      {embedded ? null : <PageHeader title="Reports" subtitle="Exportable opponent and performance reports" />}
      <div className="filter-bar">
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="team">Team Performance</option>
          <option value="opponent">Opponent Scout</option>
        </select>
        {type === 'team' && !lockedTeamId ? (
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        ) : opponents.length && type === 'opponent' ? (
          <select value={opponentId} onChange={(e) => setOpponentId(e.target.value)}>
            {opponents.map((o) => <option key={o.opponent_id || o.id} value={o.opponent_id || o.id}>{o.name}</option>)}
          </select>
        ) : null}
      </div>
      {type === 'opponent' && !opponents.length ? (
        <EmptyState title="No opponents scouted" body="Add opponents in Scouting to generate scout reports." />
      ) : report ? (
        <>
          <div className="page-header" style={{ paddingTop: 8 }}>
            <div>
              <div className="page-title" style={{ fontSize: 18 }}>{report.title}</div>
              <div className="page-subtitle">{report.subtitle}</div>
            </div>
            <button type="button" className="btn sm" onClick={() => navigator.clipboard.writeText(report.markdown)}>
              Copy Markdown
            </button>
          </div>
          <div className="kpi-row">
            {report.kpis.map((k) => <Kpi key={k.label} label={k.label} value={k.value} meta={k.sub} />)}
          </div>
          {report.sections.map((section) => (
            <div key={section.heading} className="card section">
              <div className="card-head">
                <h2>{section.heading}</h2>
                {section.note ? <div className="card-meta">{section.note}</div> : null}
              </div>
              {section.rows.length === 0 ? (
                <div className="field-hint">No data.</div>
              ) : (
                <table>
                  <thead><tr>{section.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                  <tbody>
                    {section.rows.map((row, i) => (
                      <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </>
      ) : null}
    </>
  );
}
