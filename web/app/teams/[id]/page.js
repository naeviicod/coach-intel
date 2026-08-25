import { notFound, redirect } from 'next/navigation';
import { AppShell } from '../../../components/app-shell';
import { getTeam, listMembers, listTeams } from '../../../lib/data';
import { createServerSupabase, getSessionUser } from '../../../lib/supabase/server';

export async function generateMetadata({ params }) {
  const { id } = await params;
  return { title: `${decodeURIComponent(id)} · Coach Intel` };
}

export default async function TeamPage({ params }) {
  const user = await getSessionUser();
  if (!user) redirect('/sign-in');

  const { id } = await params;
  const teamId = decodeURIComponent(id);
  const supabase = await createServerSupabase();
  const [teams, team] = await Promise.all([
    listTeams(supabase).catch(() => []),
    getTeam(supabase, teamId),
  ]);
  if (!team) notFound();

  const members = await listMembers(supabase, teamId).catch(() => []);
  const userLabel =
    user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'Signed in';

  const starters = members.filter((m) => m.slot === 'starter');
  const bench = members.filter((m) => m.slot === 'bench');
  const staff = members.filter((m) => m.slot === 'staff');

  return (
    <AppShell userLabel={userLabel} teams={teams}>
      <header className="page-head">
        <p className="eyebrow">{team.tag || 'Team'}</p>
        <h1>{team.name}</h1>
        <p className="lede">
          {members.length} on the roster. Read-only on the web for now — edits stay in the desktop app.
        </p>
      </header>
      {members.length === 0 ? (
        <div className="empty-card">
          <h2>No players on this roster</h2>
        </div>
      ) : (
        <>
          <RosterTable title="Playing" rows={starters} />
          {bench.length ? <RosterTable title="Bench" rows={bench} /> : null}
          {staff.length ? <RosterTable title="Staff" rows={staff} /> : null}
        </>
      )}
    </AppShell>
  );
}

function RosterTable({ title, rows }) {
  if (!rows.length) return null;
  return (
    <section className="roster">
      <h2>{title}</h2>
      <table>
        <thead>
          <tr>
            <th>Player</th>
            <th>Role</th>
            <th>Title</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.gamertag || row.name}</td>
              <td>{row.role || '—'}</td>
              <td>{row.title || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
