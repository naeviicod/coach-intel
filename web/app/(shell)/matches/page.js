import { loadAppData } from '../../../lib/data';
import { createServerSupabase } from '../../../lib/supabase/server';

export const metadata = { title: 'Matches · Coach Intel' };

export default async function MatchesPage() {
  const supabase = await createServerSupabase();
  const { teams, matches } = await loadAppData(supabase);
  const teamName = (id) => teams.find((t) => t.id === id)?.name || 'Team';

  return (
    <>
      <header className="page-head">
        <h1>Matches</h1>
        <p className="lede">League matches from the calendar and maps recorded in Scrim Hub</p>
      </header>
      {matches.length === 0 ? (
        <div className="empty-card">
          <h2>No matches yet</h2>
        </div>
      ) : (
        <ul className="dash-teams dash-card">
          {matches.map((match) => (
            <li key={match.id || match.match_id}>
              <span className="team-name">{match.opponent ? `vs ${match.opponent}` : 'Match'}</span>
              <span className="team-meta">
                {teamName(match.team_id)}
                {match.date ? ` · ${String(match.date).slice(0, 10)}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
