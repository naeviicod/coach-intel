import { AddTeam } from '../../../components/add-records';
import { PageHeader, EmptyState } from '../../../components/page-header';
import { Sparkline, TeamMark, teamWinRate } from '../../../lib/marks';
import { loadWorkspace } from '../../../lib/workspace';
import Link from 'next/link';

export const metadata = { title: 'Teams · Coach Intel' };

export default async function TeamsPage() {
  const { teams, members, matches, canEdit } = await loadWorkspace();

  return (
    <>
      <PageHeader
        title="Teams"
        subtitle={`${teams.length} team${teams.length === 1 ? '' : 's'} in the organization`}
      />
      <AddTeam canEdit={canEdit} />
      {teams.length === 0 ? (
        <EmptyState title="No teams yet" body="Add a team here. Players are added on the Players page." />
      ) : (
        <div className="grid cols-2">
          {teams.map((team) => {
            const roster = members.filter((m) => m.team_id === team.id);
            const teamMatches = matches.filter((m) => m.team_id === team.id);
            const winRate = teamWinRate(teamMatches);
            const record = teamMatches.reduce(
              (acc, m) => {
                if (String(m.result || '').toLowerCase() === 'win') acc.w += 1;
                else if (m.result) acc.l += 1;
                return acc;
              },
              { w: 0, l: 0 }
            );
            const recent = teamMatches.slice(0, 8).reverse().map((m) => (String(m.result || '').toLowerCase() === 'win' ? 1 : 0));
            return (
              <div key={team.id} className="card team-card">
                <div className="team-card-head">
                  <TeamMark team={team} className="team-logo lg" />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="team-identity-kicker">{team.tag || 'Team'}</div>
                    <div className="team-name" style={{ fontSize: 18 }}>{team.name}</div>
                    <div className="team-meta">
                      {roster.length} player{roster.length === 1 ? '' : 's'} · {record.w}-{record.l}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div className="stat-label">Win Rate</div>
                    <div className="stat-value" style={{ fontSize: 18 }}>{winRate}%</div>
                  </div>
                  <Sparkline values={recent.length ? recent : [0, 0]} />
                </div>
                <div className="team-card-actions">
                  <Link href={`/teams/${encodeURIComponent(team.id)}`} className="btn sm">
                    Open Hub
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
