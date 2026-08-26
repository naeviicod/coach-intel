import { AddPlayer } from '../../../components/add-records';
import { CopyInvite } from '../../../components/copy-invite';
import { RosterSlotButton } from '../../../components/roster-slot-button';
import { PageHeader, EmptyState } from '../../../components/page-header';
import { PlayerAvatar, RoleBadge, TeamMark, orgTitles, splitRoster, VerifiedMark, memberDiscordVerified } from '../../../lib/marks';
import { suggestedAccessRole } from '../../../lib/invite';
import { loadWorkspace } from '../../../lib/workspace';
import Link from 'next/link';

export const metadata = { title: 'Players · Coach Intel' };

function lineupMeta(starters, bench, staff) {
  const bits = [`${starters} starter${starters === 1 ? '' : 's'}`];
  if (bench) bits.push(`${bench} bench`);
  if (staff) bits.push(`${staff} staff`);
  return bits.join(' · ');
}

function RosterGroup({ title, rows, teamId, showInvite, canEdit }) {
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
                <div className="gamertag">
                  {member.gamertag || member.name}
                  {memberDiscordVerified(member) ? <VerifiedMark /> : null}
                </div>
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
              {canEdit || showInvite ? (
                <div className="row-actions edit-only">
                  <RosterSlotButton member={{ ...member, team_id: teamId }} canEdit={canEdit} />
                  {showInvite ? (
                    <CopyInvite
                      teamId={teamId}
                      memberId={member.id}
                      gamertag={member.gamertag}
                      accessRole={suggestedAccessRole(member)}
                      linked={Boolean(member.user_id)}
                    />
                  ) : null}
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
  const { teams, members, canEdit, canManageTeam } = await loadWorkspace();

  return (
    <>
      <PageHeader
        title="Players"
        subtitle={canEdit
          ? 'Players, staff, and creatives. Invite copies a personal join link with that player\'s gamertag on it.'
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
          const manage = canManageTeam(team.id);
          return (
            <div key={team.id} className={`card section${manage ? '' : ' team-readonly'}`}>
              <div className="team-identity" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
                <TeamMark team={team} className="team-logo lg" />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="team-identity-kicker">{team.tag ? `${team.tag} roster` : 'Team roster'}</div>
                  <div className="team-identity-name">{team.name} Roster</div>
                  <div className="team-meta">{lineupMeta(starters.length, bench.length, staff.length)}</div>
                </div>
                <div className="edit-only" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <AddPlayer teams={teams} canEdit={manage} teamId={team.id} />
                </div>
              </div>
              {roster.length === 0 ? (
                <div className="field-hint">No members yet. Add a player to this roster.</div>
              ) : (
                <>
                  <RosterGroup title="Starting lineup" rows={starters} teamId={team.id} showInvite={manage} canEdit={manage} />
                  <RosterGroup title="Backup / Bench" rows={bench} teamId={team.id} showInvite={manage} canEdit={manage} />
                  <RosterGroup title="Staff & Org" rows={staff} teamId={team.id} showInvite={manage} canEdit={manage} />
                </>
              )}
            </div>
          );
        })
      )}
    </>
  );
}
