import { AddMatch } from '../../../components/add-records';
import { PageHeader, EmptyState } from '../../../components/page-header';
import { fmtDate, teamWinRate } from '../../../lib/marks';
import { mapNames, modeNames, resolveRuleset } from '../../../lib/ruleset';
import { groupSeries } from '../../../lib/series';
import { loadWorkspace } from '../../../lib/workspace';

export const metadata = { title: 'Matches · Coach Intel' };

export default async function MatchesPage() {
  const { teams, matches, rulesetDocs, canEdit } = await loadWorkspace();
  const teamName = (id) => teams.find((t) => t.id === id)?.name || 'Team';
  const ruleset = resolveRuleset(rulesetDocs);
  const series = groupSeries(matches);

  return (
    <>
      <PageHeader
        title="Matches"
        subtitle="League series from the calendar and maps recorded in Scrim Hub. Log a Best of 5, then drop scoreboards for player stats."
      />
      <AddMatch teams={teams} canEdit={canEdit} maps={mapNames(ruleset)} modes={modeNames(ruleset)} />
      {matches.length === 0 ? (
        <EmptyState title="No matches yet" body="Log a BO5 series or drop scoreboards in the inbox. Logged maps and league results show here." />
      ) : (
        <div className="card">
          {series.map((group) => {
            const head = group.maps[0];
            const wins = group.maps.filter((m) => String(m.result || '').toLowerCase() === 'win').length;
            const losses = group.maps.filter((m) => String(m.result || '').toLowerCase() === 'loss').length;
            return (
              <div key={group.key} className="series-block">
                <div className="crow">
                  <div className="crow-main">
                    <div className="crow-title">{head.opponent ? `vs ${head.opponent}` : 'Match'}</div>
                    <div className="crow-sub">
                      {[teamName(head.team_id), group.standalone ? null : `${wins}-${losses}`, group.standalone ? null : 'BO5']
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                  <div className="crow-meta">{head.date ? fmtDate(String(head.date).slice(0, 10)) : '—'}</div>
                </div>
                {group.maps.map((match) => (
                  <div key={match.id || match.match_id} className="crow series-map">
                    <div className="crow-main">
                      <div className="crow-title">
                        {match.game ? `G${match.game}` : ''} {match.mode || 'Map'} {match.map ? `· ${match.map}` : ''}
                      </div>
                      <div className="crow-sub">
                        {[match.result, match.score, (match.players || []).length ? `${match.players.length} player stats` : 'No player stats yet']
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
          <div className="field-hint" style={{ padding: '8px 4px 4px' }}>
            {matches.length} map{matches.length === 1 ? '' : 's'} · {teamWinRate(matches)}% win rate
          </div>
        </div>
      )}
    </>
  );
}
