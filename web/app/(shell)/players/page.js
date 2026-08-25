import Link from 'next/link';
import { CopyInvite } from '../../../components/copy-invite';
import { PageHeader, EmptyState } from '../../../components/page-header';
import { PlayerAvatar, RoleBadge, TeamMark, orgTitles, splitRoster } from '../../../lib/marks';
import { canEdit } from '../../../lib/access';
import { suggestedAccessRole } from '../../../lib/invite';
import { getProfile, loadAppData } from '../../../lib/data';
import { createServerSupabase, getSessionUser } from '../../../lib/supabase/server';

export const metadata = { title: 'Players · Coach Intel' };

function lineupMeta(starters, bench, staff) {
  const bits = [`${starters} starter${starters === 1 ? '' : 's'}`];
  if (bench) bits.push(`${bench} bench`);
  if (staff) bits.push(`${staff} staff`);
  return bits.join(' · ');
}

function RosterGroup({ title, rows, teamId, showInvite }) {
  return (
    <>
      <div className="card-head" style={{ padding: '8px 0 6px' }}>
        <div className="card-title">{title}</div>
        <div className="card-meta">{rows.length}</div>
      </div>
      {rows.length === 0 ? (
        <div className="field-hint" style={{ padding: '4px 0 12px' }}>
          No members in this group yet.
        </div>
      ) : (
        rows.map((member) => {
          const titles = orgTitles(member).filter((t) => !/^player$/i.test(t));
          const staff = member.slot === 'staff';
          return (
            <div key={member.id} className="roster-row">
              <PlayerAvatar member={member} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="gamertag">{member.gamertag || member.name}</div>
                {member.name && member.name !== member.gamertag ? (
                  <div className="member-name">{member.name}</div>
                ) : null}
              </div>
              {titles.map((t) => (
                <span key={t} className={`role-badge org ${String(t).replace(/\s+/g, '-')}`}>
                  {t}
                </span>
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
        })
      )}
    </>
  );
}

export default async function PlayersPage() {
  const user = await getSessionUser();
  const supabase = await createServerSupabase();
  const [{ teams, members }, profile] = await Promise.all([
    loadAppData(supabase),
    user ? getProfile(supabase, user.id) : null,
  ]);
  const showInvite = canEdit(profile?.role);

  return (
    <>
      <PageHeader
        title="Players"
        subtitle={showInvite
          ? 'Players, staff, and creatives. Invite copies a coach.championshipseries.eu/join link for that roster slot.'
          : 'Members across the organization'}
      />
      {teams.length === 0 ? (
        <EmptyState title="No teams yet" body="Create a team on the Teams page, then add players here.">
          <Link href="/teams" className="btn primary" style={{ marginTop: 14 }}>Go to Teams</Link>
        </EmptyState>
      ) : (
        teams.map((team) => {
          const roster = members.filter((m) => m.team_id === team.id);
          const { starters, bench, staff } = splitRoster(roster);
          return (
            <div key={team.id} className="card section">
              <div className="team-identity" style={{ marginBottom: 16 }}>
                <TeamMark team={team} className="team-logo lg" />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="team-identity-kicker">{team.tag ? `${team.tag} roster` : 'Team roster'}</div>
                  <div className="team-identity-name">{team.name} Roster</div>
                  <div className="team-meta">{lineupMeta(starters.length, bench.length, staff.length)}</div>
                </div>
              </div>
              {roster.length === 0 ? (
                <div className="field-hint">No members yet. Add a player to this roster.</div>
              ) : (
                <>
                  <RosterGroup title="Starting lineup" rows={starters} teamId={team.id} showInvite={showInvite} />
                  <RosterGroup title="Backup / Bench" rows={bench} teamId={team.id} showInvite={showInvite} />
                  <RosterGroup title="Staff & Org" rows={staff} teamId={team.id} showInvite={showInvite} />
                </>
              )}
            </div>
          );
        })
      )}
    </>
  );
}
