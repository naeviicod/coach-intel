'use client';

import { useMemo, useState } from 'react';
import { aggregate, fmtObj, objStatsForModes, statsForMember } from '../lib/stats';
import { PlayerAvatar, RoleBadge } from '../lib/marks';
import { EmptyState, PageHeader } from './page-header';

export function StatisticsView({ teams, members, matches, embedded }) {
  const rowsAll = useMemo(
    () =>
      members.map((member) => {
        const team = teams.find((t) => t.id === member.team_id);
        const rows = statsForMember(matches.filter((m) => m.team_id === member.team_id), member.id);
        return { team, member, rows, totals: aggregate(rows) };
      }),
    [teams, members, matches]
  );
  const modes = [...new Set(rowsAll.flatMap((r) => r.rows.map((x) => x.match.mode).filter(Boolean)))];
  const [mode, setMode] = useState('');

  if (!members.length) {
    return (
      <>
        {embedded ? null : <PageHeader title="Statistics" subtitle="Compare players across the organization and spot who needs coaching attention" />}
        <EmptyState title="Nothing to compare yet" body="Add players and log a few matches first." />
      </>
    );
  }

  const scoped = rowsAll.map((r) => {
    const filteredRows = mode ? r.rows.filter((x) => x.match.mode === mode) : r.rows;
    return { ...r, scopedTotals: aggregate(filteredRows) };
  });
  const withMatches = scoped.filter((r) => r.scopedTotals.matches > 0).sort((a, b) => b.scopedTotals.kd - a.scopedTotals.kd);
  const strongest = withMatches[0];
  const weakest = withMatches[withMatches.length - 1];
  const objStats = objStatsForModes(mode ? [mode] : modes);

  return (
    <>
      {embedded ? null : <PageHeader title="Statistics" subtitle="Compare players across the organization and spot who needs coaching attention" />}
      <div className="filter-bar">
        <select aria-label="Mode" value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="">All Modes</option>
          {modes.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
      {withMatches.length === 0 ? (
        <EmptyState title="No matches yet" body="Log maps and league matches and this page fills in." />
      ) : (
        <>
          <div className="grid cols-2 section">
            {strongest ? highlight('Strongest' + (mode ? ` on ${mode}` : ''), strongest, 'up') : null}
            {weakest && weakest !== strongest ? highlight('Needs Attention' + (mode ? ` on ${mode}` : ''), weakest, 'down') : null}
          </div>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  {teams.length > 1 ? <th>Team</th> : null}
                  <th>Role</th>
                  <th>Matches</th>
                  <th>K/D</th>
                  <th>Avg Damage</th>
                  {objStats.map((s) => <th key={s.key}>{s.short}</th>)}
                  <th>Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {withMatches.map((r) => (
                  <tr key={r.member.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <PlayerAvatar member={r.member} />
                        {r.member.gamertag}
                      </div>
                    </td>
                    {teams.length > 1 ? <td>{r.team?.name || '—'}</td> : null}
                    <td><RoleBadge role={r.member.role} /></td>
                    <td>{r.scopedTotals.matches}</td>
                    <td>{r.scopedTotals.kd}</td>
                    <td>{r.scopedTotals.matches ? Math.round(r.scopedTotals.damage / r.scopedTotals.matches) : 0}</td>
                    {objStats.map((s) => <td key={s.key}>{fmtObj(s, r.scopedTotals.obj[s.key])}</td>)}
                    <td>{r.scopedTotals.winRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function highlight(label, row, tone) {
  return (
    <div className="card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${tone === 'up' ? 'accent' : ''}`}>{row.member.gamertag}</div>
      <div className="kpi-meta">{row.scopedTotals.kd} K/D · {row.scopedTotals.winRate}% win rate</div>
    </div>
  );
}
