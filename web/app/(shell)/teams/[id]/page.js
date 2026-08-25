import { notFound, redirect } from 'next/navigation';
import { CopyInvite } from '../../../../components/copy-invite';
import { EmptyState } from '../../../../components/page-header';
import { PlayerAvatar, RoleBadge, TeamMark, orgTitles, splitRoster } from '../../../../lib/marks';
import { canEdit } from '../../../../lib/access';
import { getProfile, getTeam, listMembers } from '../../../../lib/data';
import { suggestedAccessRole } from '../../../../lib/invite';
import { createServerSupabase, getSessionUser } from '../../../../lib/supabase/server';

export async function generateMetadata({ params }) {
  const { id } = await params;
  return { title: `${decodeURIComponent(id)} · Coach Intel` };
}

function Group({ title, rows, teamId, showInvite }) {
  if (!rows.length) return null;
  return (
    <>
      <div className="card-head" style={{ padding: '8px 0 6px' }}>
        <div className="card-title">{title}</div>
        <div className="card-meta">{rows.length}</div>
      </div>
      {rows.map((member) => {
        const titles = orgTitles(member).filter((t) => !/^player$/i.test(t));
        const staff = member.slot === 'staff';
        return (
          <div key={member.id} className="roster-row">
            <PlayerAvatar member={member} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="gamertag">{member.gamertag || member.name}</div>
              {member.name && member.name !== member.gamertag ? <div className="member-name">{member.name}</div> : null}
            </div>
            {titles.map((t) => (
              <span key={t} className={`role-badge org ${String(t).replace(/\s+/g, '-')}`}>{t}</span>
            ))}
            {staff ? null : <RoleBadge role={member.role} />}
            {staff ? <span className="pill">Staff</span> : member.slot === 'bench' ? <span className="pill">Bench</span> : null}
            {showInvite ? (
              <div className="row-actions">
                <CopyInvite
                  teamId={teamId}
                  memberId={member.id}
                  accessRole={suggestedAccessRole(member)}
                  linked={Boolean(member.user_id)}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
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
  const showInvite = canEdit(profile?.role);
  const { starters, bench, staff } = splitRoster(members);

  return (
    <>
      <div className="page-header">
        <div className="page-identity">
          <TeamMark team={team} className="sb-org-logo page-org-logo" />
          <div style={{ minWidth: 0 }}>
            <div className="page-org-name">{team.tag || 'Team'}</div>
            <div className="page-title">{team.name}</div>
            <div className="page-subtitle">
              {members.length} player{members.length === 1 ? '' : 's'}
              {showInvite ? ' · Copy invite binds Discord to that roster slot.' : '.'}
            </div>
          </div>
        </div>
      </div>
      {members.length === 0 ? (
        <EmptyState title="No players on this roster" body="Add a player on the Players page." />
      ) : (
        <div className="card section">
          <Group title="Starting lineup" rows={starters} teamId={team.id} showInvite={showInvite} />
          <Group title="Backup / Bench" rows={bench} teamId={team.id} showInvite={showInvite} />
          <Group title="Staff & Org" rows={staff} teamId={team.id} showInvite={showInvite} />
        </div>
      )}
    </>
  );
}
