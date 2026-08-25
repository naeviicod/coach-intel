import Link from 'next/link';
import { loadAppData } from '../../../lib/data';
import { createServerSupabase } from '../../../lib/supabase/server';

export const metadata = { title: 'Players · Coach Intel' };

export default async function PlayersPage() {
  const supabase = await createServerSupabase();
  const { teams, members } = await loadAppData(supabase);
  const teamName = (id) => teams.find((t) => t.id === id)?.name || 'Team';

  return (
    <>
      <header className="page-head">
        <h1>Players</h1>
        <p className="lede">Players, staff, and creatives across the organization</p>
      </header>
      {members.length === 0 ? (
        <div className="empty-card">
          <h2>No members yet</h2>
        </div>
      ) : (
        <section className="roster">
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Team</th>
                <th>Role</th>
                <th>Title</th>
              </tr>
            </thead>
            <tbody>
              {members.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link href={`/teams/${encodeURIComponent(row.team_id)}`}>{row.gamertag || row.name}</Link>
                  </td>
                  <td>{teamName(row.team_id)}</td>
                  <td>{row.role || '—'}</td>
                  <td>{row.title || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
