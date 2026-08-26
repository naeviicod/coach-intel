import { AddPlayer, EditMember, RemoveMember } from '../../../components/add-records';
import { CopyInvite } from '../../../components/copy-invite';
import { RosterSlotButton } from '../../../components/roster-slot-button';
import { PageHeader, EmptyState } from '../../../components/page-header';
import { PlayerAvatar, RoleBadge, TeamMark, orgTitles, splitRoster, memberOrgGroup, VerifiedMark, memberDiscordVerified } from '../../../lib/marks';
import { suggestedAccessRole } from '../../../lib/invite';
import { loadWorkspace } from '../../../lib/workspace';
import Link from 'next/link';

export const metadata = { title: 'Players · Coach Intel' };

const ORG_GROUPS = {
  staff: { title: 'Staff', meta: 'Analysts, creatives, and org staff' },
  coaches: { title: 'Coaches', meta: 'Coaching staff across the org' },
  admins: { title: 'Admins', meta: 'Owners, admins, and developers' },
  fa: { title: 'Free Agents', meta: 'In the org, not on a starting lineup' },
};

function lineupMeta(starters, bench, staff, fa) {
  const bits = [`${starters} starter${starters === 1 ? '' : 's'}`];
  if (bench) bits.push(`${bench} bench`);
  if (staff) bits.push(`${staff} staff`);
  if (fa) bits.push(`${fa} F/A`);
  return bits.join(' · ');
}

function GroupTile({ href, title, meta, count, team }) {
  return (
    <Link href={href} className="card player-group-card">
      {team ? <TeamMark team={team} className="team-logo lg" /> : <div className="team-logo lg">{title.slice(0, 2)}</div>}
      <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
        <div className="team-identity-name">{title}</div>
        <div className="team-meta">{meta}</div>
      </div>
      <div className="card-meta">{String(count)}</div>
    </Link>
  );
}

function MemberRow({ member, teamId, showInvite, canEdit }) {
  const titles = orgTitles(member).filter((t) => !/^player$/i.test(t));
  const staff = member.slot === 'staff';
  const fa = member.slot === 'fa';
  return (
    <div className="roster-row">
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
      {staff || fa ? null : <RoleBadge role={member.role} />}
      {staff ? <span className="pill">Staff</span> : fa ? <span className="pill">F/A</span> : member.slot === 'bench' ? <span className="pill">Bench</span> : null}
      {canEdit || showInvite ? (
        <div className="row-actions edit-only">
          <RosterSlotButton member={{ ...member, team_id: teamId }} canEdit={canEdit} />
          {canEdit ? <EditMember member={{ ...member, team_id: teamId }} canEdit={canEdit} /> : null}
          {showInvite ? (
            <CopyInvite
              teamId={teamId}
              memberId={member.id}
              gamertag={member.gamertag}
              accessRole={suggestedAccessRole(member)}
              linked={Boolean(member.user_id)}
            />
          ) : null}
          {canEdit ? <RemoveMember member={{ ...member, team_id: teamId }} canEdit={canEdit} /> : null}
        </div>
      ) : null}
    </div>
  );
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
        rows.map((member) => (
          <MemberRow
            key={member.id}
            member={member}
            teamId={teamId}
            showInvite={showInvite}
            canEdit={canEdit}
          />
        ))
      )}
    </>
  );
}

export default async function PlayersPage({ searchParams }) {
  const params = await searchParams;
  const group = String(params?.group || '');
  const { teams, members, canManageTeam } = await loadWorkspace();
  const orgOf = (key) => members.filter((member) => memberOrgGroup(member) === key);
  const canManageAny = teams.some((team) => canManageTeam(team.id));

  return (
    <>
      <PageHeader
        title="Players"
        subtitle={canManageAny
          ? 'Open a team, staff, coaches, admins, or free agents. Invite copies a website join link.'
          : 'Members across the organization'}
      />
      {group ? (
        <Link href="/players" className="btn sm" style={{ marginBottom: 14 }}>All groups</Link>
      ) : null}
      {teams.length === 0 ? (
        <EmptyState title="No teams yet" body="Create a team on the Teams page, then add players here.">
          <Link href="/teams" className="btn primary" style={{ marginTop: 14 }}>Go to Teams</Link>
        </EmptyState>
      ) : !group ? (
        <div className="player-group-grid">
          {teams.map((team) => {
            const roster = members.filter((m) => m.team_id === team.id);
            const { starters, bench, staff, freeAgents } = splitRoster(roster);
            return (
              <GroupTile
                key={team.id}
                href={`/players?group=team-${encodeURIComponent(team.id)}`}
                title={`${team.name} Roster`}
                meta={lineupMeta(starters.length, bench.length, staff.length, freeAgents.length)}
                count={roster.length}
                team={team}
              />
            );
          })}
          {Object.entries(ORG_GROUPS).map(([key, info]) => (
            <GroupTile
              key={key}
              href={`/players?group=${key}`}
              title={info.title}
              meta={info.meta}
              count={orgOf(key).length}
            />
          ))}
        </div>
      ) : group.startsWith('team-') ? (
        (() => {
          const teamId = decodeURIComponent(group.slice(5));
          const team = teams.find((t) => t.id === teamId);
          if (!team) {
            return <EmptyState title="Team not found" body="That roster is gone. Pick another group." />;
          }
          const roster = members.filter((m) => m.team_id === team.id);
          const { starters, bench, staff, freeAgents } = splitRoster(roster);
          const manage = canManageTeam(team.id);
          return (
            <div className={`card section${manage ? ' roster-manage' : ' team-readonly'}`}>
              <div className="team-identity" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
                <TeamMark team={team} className="team-logo lg" />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="team-identity-kicker">{team.tag ? `${team.tag} roster` : 'Team roster'}</div>
                  <div className="team-identity-name">{team.name} Roster</div>
                  <div className="team-meta">{lineupMeta(starters.length, bench.length, staff.length, freeAgents.length)}</div>
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
                  <RosterGroup title="Free Agents" rows={freeAgents} teamId={team.id} showInvite={manage} canEdit={manage} />
                </>
              )}
            </div>
          );
        })()
      ) : (
        (() => {
          const info = ORG_GROUPS[group] || { title: 'Group' };
          const rows = orgOf(group);
          const anyManage = rows.some((member) => canManageTeam(member.team_id));
          return (
            <div className={`card section${anyManage ? ' roster-manage' : ''}`}>
              <div className="card-head">
                <div className="card-title">{info.title}</div>
                <div className="card-meta">{rows.length}</div>
              </div>
              {rows.length === 0 ? (
                <div className="field-hint">Nobody in this group yet. Add a member and set their slot or title.</div>
              ) : (
                rows.map((member) => {
                  const manage = canManageTeam(member.team_id);
                  return (
                    <MemberRow
                      key={`${member.team_id}-${member.id}`}
                      member={member}
                      teamId={member.team_id}
                      showInvite={manage}
                      canEdit={manage}
                    />
                  );
                })
              )}
            </div>
          );
        })()
      )}
    </>
  );
}
