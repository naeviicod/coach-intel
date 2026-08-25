'use client';

import { useSearchParams } from 'next/navigation';
import { mapReadiness } from '../lib/readiness';
import { activeMaps, resolveRuleset } from '../lib/ruleset';
import { collectVetoes, intelForOpponent, summaryLines } from '../lib/vetoIntel';
import { teamWinRate } from '../lib/stats';
import { EmptyState, PageHeader } from './page-header';
import { Kpi, pickTeam, TeamPicker } from './workspace';

export function WarRoomView({ teams, opponents, matches, strats, vods, notes, vetoes, rulesetDocs, teamId }) {
  const search = useSearchParams();
  const team = pickTeam(teams, teamId);
  const opponentId = search.get('opponent') || '';
  const opponent = opponents.find((o) => (o.opponent_id || o.id) === opponentId) || null;
  const ruleset = resolveRuleset(rulesetDocs);

  if (!teams.length) {
    return (
      <>
        <PageHeader title="War Room" subtitle="Everything for the upcoming series, in one place" />
        <EmptyState title="No teams yet" body="Create a team before prepping for a match." />
      </>
    );
  }

  const catalog = collectVetoes({ teamVetoes: vetoes, opponents });
  const intel = opponent ? intelForOpponent(opponent.name, catalog) : null;
  const h2h = opponent ? matches.filter((m) => (m.opponent || '').toLowerCase() === opponent.name.toLowerCase() && m.team_id === team.id) : [];
  const oppVods = opponent ? vods.filter((v) => v.team_id === team.id && (v.opponent || '').toLowerCase() === opponent.name.toLowerCase()) : [];
  const oppNotes = opponent ? notes.filter((n) => n.team_id === team.id && (n.links?.opponent || '').toLowerCase() === opponent.name.toLowerCase()) : [];
  const pool = [];
  for (const map of activeMaps(ruleset)) {
    for (const mode of map.modes || []) pool.push({ map: map.name, mode });
  }
  const readiness = opponent
    ? pool.map(({ map, mode }) => mapReadiness(map, mode, { strats: strats.filter((s) => s.team_id === team.id), vods: oppVods, opponent, matches: h2h }))
    : [];
  const overall = readiness.length ? Math.round(readiness.reduce((s, r) => s + r.score, 0) / readiness.length) : null;

  return (
    <>
      <PageHeader title="War Room" subtitle={`${team.name} — prep for the upcoming series`} actions={<TeamPicker teams={teams} teamId={team.id} />} />
      <div className="filter-bar">
        <select
          aria-label="Opponent"
          value={opponentId}
          onChange={(e) => {
            const url = new URL(window.location.href);
            if (e.target.value) url.searchParams.set('opponent', e.target.value);
            else url.searchParams.delete('opponent');
            window.location.href = url.toString();
          }}
        >
          <option value="">Select an opponent…</option>
          {opponents.map((o) => <option key={o.opponent_id || o.id} value={o.opponent_id || o.id}>{o.name}</option>)}
        </select>
      </div>
      {!opponents.length ? (
        <EmptyState title="No opponents scouted yet" body="Scout an opponent first — War Room pulls intel, veto book and readiness from that profile." />
      ) : !opponent ? (
        <EmptyState title="Pick an opponent" body="Choose who you're about to play from the dropdown above." />
      ) : (
        <>
          <div className="kpi-row">
            <Kpi label="Readiness" value={overall == null ? '—' : `${overall}%`} meta="Map/mode prep" accent={overall >= 60} />
            <Kpi label="Head-to-head" value={`${h2h.filter((m) => String(m.result).toLowerCase() === 'win').length}-${h2h.filter((m) => m.result && String(m.result).toLowerCase() !== 'win').length}`} meta={`${teamWinRate(h2h)}% win rate`} />
            <Kpi label="VODs" value={oppVods.length} meta="Tied to this opponent" />
            <Kpi label="Notes" value={oppNotes.length} meta="Scout notes" />
          </div>
          {summaryLines(intel).map((line) => <div key={line} className="field-hint" style={{ marginBottom: 6 }}>{line}</div>)}
          <div className="card">
            <div className="card-head"><h2>Map readiness</h2></div>
            <table>
              <thead>
                <tr><th>Map</th><th>Mode</th><th>Ready</th><th>Strats</th><th>Matches</th></tr>
              </thead>
              <tbody>
                {readiness.map((row) => (
                  <tr key={`${row.map}-${row.mode}`}>
                    <td>{row.map}</td>
                    <td>{row.mode}</td>
                    <td>{row.score}%</td>
                    <td>{row.stratCount}</td>
                    <td>{row.ourMatches}</td>
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
