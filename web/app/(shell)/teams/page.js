import Link from 'next/link';
import { loadAppData } from '../../../lib/data';
import { createServerSupabase } from '../../../lib/supabase/server';

export const metadata = { title: 'Teams · Coach Intel' };

export default async function TeamsPage() {
  const supabase = await createServerSupabase();
  const { teams, members } = await loadAppData(supabase);
  const counts = new Map();
  for (const member of members) counts.set(member.team_id, (counts.get(member.team_id) || 0) + 1);

  return (
    <>
      <header className="page-head">
        <h1>Teams</h1>
        <p className="lede">{teams.length} team{teams.length === 1 ? '' : 's'} in the organization</p>
      </header>
      {teams.length === 0 ? (
        <div className="empty-card">
          <h2>No teams yet</h2>
        </div>
      ) : (
        <ul className="dash-teams dash-card">
          {teams.map((team) => (
            <li key={team.id}>
              <Link href={`/teams/${encodeURIComponent(team.id)}`}>
                <span className="team-name">{team.name}</span>
                <span className="team-meta">
                  {counts.get(team.id) || 0} players · No matches
                </span>
                {team.tag ? <span className="team-tag">{team.tag}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
