import { AddMatch } from '../../../components/add-records';
import { PageHeader, EmptyState } from '../../../components/page-header';
import { fmtDate, teamWinRate } from '../../../lib/marks';
import { mapNames, modeNames, resolveRuleset } from '../../../lib/ruleset';
import { loadWorkspace } from '../../../lib/workspace';

export const metadata = { title: 'Matches · Coach Intel' };

export default async function MatchesPage() {
  const { teams, matches, rulesetDocs, canEdit } = await loadWorkspace();
  const teamName = (id) => teams.find((t) => t.id === id)?.name || 'Team';
  const ruleset = resolveRuleset(rulesetDocs);

  return (
    <>
      <PageHeader
        title="Matches"
        subtitle="League matches from the calendar and maps recorded in Scrim Hub"
      />
      <AddMatch teams={teams} canEdit={canEdit} maps={mapNames(ruleset)} modes={modeNames(ruleset)} />
      {matches.length === 0 ? (
        <EmptyState title="No matches yet" body="Logged maps and league results will show here." />
      ) : (
        <div className="card">
          {matches.map((match) => (
            <div key={match.id || match.match_id} className="crow">
              <div className="crow-main">
                <div className="crow-title">{match.opponent ? `vs ${match.opponent}` : 'Match'}</div>
                <div className="crow-sub">
                  {[teamName(match.team_id), match.map, match.mode, match.result].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div className="crow-meta">{match.date ? fmtDate(String(match.date).slice(0, 10)) : '—'}</div>
            </div>
          ))}
          <div className="field-hint" style={{ padding: '8px 4px 4px' }}>
            {matches.length} match{matches.length === 1 ? '' : 'es'} · {teamWinRate(matches)}% win rate
          </div>
        </div>
      )}
    </>
  );
}
