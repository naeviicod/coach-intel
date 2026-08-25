import Link from 'next/link';
import { listTeams } from '../../lib/data';
import { createServerSupabase } from '../../lib/supabase/server';

export const metadata = { title: 'Dashboard · Coach Intel' };

export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const teams = await listTeams(supabase).catch(() => []);

  return (
    <>
      <header className="page-head">
        <p className="eyebrow">Organization</p>
        <h1>Dashboard</h1>
        <p className="lede">What is in the cloud for this org. Create teams in the desktop app if this list is empty.</p>
      </header>
      {teams.length === 0 ? (
        <div className="empty-card">
          <h2>No teams yet</h2>
          <p>Sign in on the Coach Intel desktop app and add a team. It will appear here for every signed-in teammate.</p>
        </div>
      ) : (
        <ul className="team-grid">
          {teams.map((team) => (
            <li key={team.id}>
              <Link href={`/teams/${encodeURIComponent(team.id)}`}>
                <span className="team-name">{team.name}</span>
                {team.tag ? <span className="team-tag">{team.tag}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
