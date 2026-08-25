import { notFound, redirect } from 'next/navigation';
import { CopyInvite } from '../../../../components/copy-invite';
import { getProfile, getTeam, listMembers } from '../../../../lib/data';
import { STAFF_INVITE_ROLES, suggestedAccessRole } from '../../../../lib/invite';
import { createServerSupabase, getSessionUser } from '../../../../lib/supabase/server';

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
  const [team, profile] = await Promise.all([
    getTeam(supabase, teamId),
    getProfile(supabase, user.id),
  ]);
  if (!team) notFound();

  const members = await listMembers(supabase, teamId).catch(() => []);
  const canInvite = STAFF_INVITE_ROLES.has(profile?.role);
  const starters = members.filter((m) => m.slot === 'starter');
  const bench = members.filter((m) => m.slot === 'bench');
  const staff = members.filter((m) => m.slot === 'staff');

  return (
    <>
      <header className="page-head dash-head">
        <p className="eyebrow">{team.tag || 'Team'}</p>
        <h1>{team.name}</h1>
        <p className="lede">
          {members.length} player{members.length === 1 ? '' : 's'}
          {canInvite ? ' · Copy invite binds Discord to that roster slot.' : '.'}
        </p>
      </header>
      {members.length === 0 ? (
        <div className="empty-card">
          <h2>No players on this roster</h2>
        </div>
      ) : (
        <>
          <RosterTable title="Playing" rows={starters} teamId={team.id} canInvite={canInvite} />
          {bench.length ? <RosterTable title="Bench" rows={bench} teamId={team.id} canInvite={canInvite} /> : null}
          {staff.length ? <RosterTable title="Staff" rows={staff} teamId={team.id} canInvite={canInvite} /> : null}
        </>
      )}
    </>
  );
}

function RosterTable({ title, rows, teamId, canInvite }) {
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
            {canInvite ? <th>Invite</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.gamertag || row.name}</td>
              <td>{row.role || '—'}</td>
              <td>{row.title || '—'}</td>
              {canInvite ? (
                <td>
                  <CopyInvite
                    teamId={teamId}
                    memberId={row.id}
                    accessRole={suggestedAccessRole(row)}
                    linked={Boolean(row.user_id)}
                  />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
