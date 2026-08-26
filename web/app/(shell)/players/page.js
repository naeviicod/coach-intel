import { AddPlayer, EditMember, RemoveMember } from '../../../components/add-records';
import { CopyInvite } from '../../../components/copy-invite';
import { Icon } from '../../../components/icon';
import { RosterSlotButton } from '../../../components/roster-slot-button';
import { TransferBar, RosterCheck, TransferMember } from '../../../components/roster-transfer';
import { PageHeader, EmptyState } from '../../../components/page-header';
import { PlayerAvatar, RoleBadge, TeamMark, orgTitles, splitRoster, memberOrgGroup, VerifiedMark, memberDiscordVerified } from '../../../lib/marks';
import { suggestedAccessRole } from '../../../lib/invite';
import { loadWorkspace } from '../../../lib/workspace';
import Link from 'next/link';

export const metadata = { title: 'Members · Coach Intel' };

const ORG_GROUPS = {
  staff: { title: 'Staff', kicker: 'Org group', meta: 'Analysts, creatives, and org staff', icon: 'database' },
  coaches: { title: 'Coaches', kicker: 'Org group', meta: 'Coaching staff across the org', icon: 'scouting' },
  admins: { title: 'Admins', kicker: 'Org group', meta: 'Org owner, Super Admin, and org admins', icon: 'settings' },
  fa: { title: 'Free Agents', kicker: 'Org group', meta: 'In the org, not on a starting lineup', icon: 'players' },
};

function lineupMeta(starters, bench, staff, fa) {
  const bits = [`${starters} starter${starters === 1 ? '' : 's'}`];
  if (bench) bits.push(`${bench} bench`);
  if (staff) bits.push(`${staff} staff`);
  if (fa) bits.push(`${fa} F/A`);
  return bits.join(' · ');
}

function GroupTile({ href, kicker, title, meta, count, team, iconName }) {
  return (
    <Link href={href} className="card player-group-card">
      {team ? (
        <TeamMark team={team} className="team-logo lg" />
      ) : (
        <div className="player-group-mark">
          <Icon name={iconName} size={22} />
        </div>
      )}
      <div className="player-group-copy">
        {kicker ? <div className="player-group-kicker">{kicker}</div> : null}
        <div className="team-identity-name">{title}</div>
        <div className="team-meta">{meta}</div>
      </div>
      <div className="player-group-count">{String(count)}</div>
    </Link>
  );
}

function MemberRow({ member, teamId, teams, showInvite, canEdit, canTransfer }) {
  const titles = orgTitles(member).filter((t) => !/^player$/i.test(t));
  const staff = member.slot === 'staff';
  const fa = member.slot === 'fa';
  const row = { ...member, team_id: teamId };
  return (
    <div className="roster-row">
      <RosterCheck member={row} canTransfer={canTransfer} />
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
      {canEdit || showInvite || canTransfer ? (
        <div className="row-actions edit-only">
          <RosterSlotButton member={row} canEdit={canEdit} />
          {canEdit ? <EditMember member={row} canEdit={canEdit} /> : null}
          <TransferMember member={row} teams={teams} canTransfer={canTransfer} />
          {showInvite ? (
            <CopyInvite
              teamId={teamId}
              memberId={member.id}
              gamertag={member.gamertag}
              accessRole={suggestedAccessRole(member)}
              linked={Boolean(member.user_id)}
            />
          ) : null}
          {canEdit ? <RemoveMember member={row} canEdit={canEdit} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function RosterGroup({ title, rows, teamId, teams, showInvite, canEdit, canTransfer }) {
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
            teams={teams}
            showInvite={showInvite}
            canEdit={canEdit}
            canTransfer={canTransfer}
          />
        ))
      )}
    </>
  );
}

export default async function PlayersPage({ searchParams }) {
  const params = await searchParams;
  const group = String(params?.group || '');
  const { teams, members, canManageTeam, canTransfer } = await loadWorkspace({ rosterOnly: true });
  const orgOf = (key) => members.filter((member) => memberOrgGroup(member) === key);
  const canManageAny = teams.some((team) => canManageTeam(team.id));

  return (
    <>
      <PageHeader
        title="Members"
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
        <div className="player-group-board">
          <div className="player-group-block">
            <div className="player-group-label">Rosters</div>
            <div className="player-group-grid">
              {teams.map((team) => {
                const roster = members.filter((m) => m.team_id === team.id);
                const { starters, bench, staff, freeAgents } = splitRoster(roster);
                return (
                  <GroupTile
                    key={team.id}
                    href={`/players?group=team-${encodeURIComponent(team.id)}`}
                    kicker={team.tag || 'Team'}
                    title={`${team.name} Roster`}
                    meta={lineupMeta(starters.length, bench.length, staff.length, freeAgents.length)}
                    count={roster.length}
                    team={team}
                  />
                );
              })}
            </div>
          </div>
          <div className="player-group-block">
            <div className="player-group-label">Organization</div>
            <div className="player-group-grid">
              {Object.entries(ORG_GROUPS).map(([key, info]) => (
                <GroupTile
                  key={key}
                  href={`/players?group=${key}`}
                  kicker={info.kicker}
                  title={info.title}
                  meta={info.meta}
                  count={orgOf(key).length}
                  iconName={info.icon}
                />
              ))}
            </div>
          </div>
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
          const transfer = Boolean(canTransfer);
          return (
            <div
              className={`card section${manage ? ' roster-manage' : ' team-readonly'}`}
              data-roster-team={team.id}
            >
              <div className="team-identity" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
                <TeamMark team={team} className="team-logo lg" />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="team-identity-kicker">{team.tag ? `${team.tag} roster` : 'Team roster'}</div>
                  <div className="team-identity-name">{team.name} Roster</div>
                  <div className="team-meta">{lineupMeta(starters.length, bench.length, staff.length, freeAgents.length)}</div>
                </div>
                <div className="edit-only" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <AddPlayer teams={teams} canEdit={manage} teamId={team.id} />
                  {transfer ? <TransferBar teamId={team.id} teams={teams} members={roster} /> : null}
                </div>
              </div>
              {roster.length === 0 ? (
                <div className="field-hint">No members yet. Add a player to this roster.</div>
              ) : (
                <>
                  <RosterGroup title="Starting lineup" rows={starters} teamId={team.id} teams={teams} showInvite={manage} canEdit={manage} canTransfer={transfer} />
                  <RosterGroup title="Backup / Bench" rows={bench} teamId={team.id} teams={teams} showInvite={manage} canEdit={manage} canTransfer={transfer} />
                  <RosterGroup title="Staff & Org" rows={staff} teamId={team.id} teams={teams} showInvite={manage} canEdit={manage} canTransfer={transfer} />
                  <RosterGroup title="Free Agents" rows={freeAgents} teamId={team.id} teams={teams} showInvite={manage} canEdit={manage} canTransfer={transfer} />
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
          const transfer = Boolean(canTransfer);
          return (
            <div className={`card section${anyManage ? ' roster-manage' : ''}`} data-roster-team="org-group">
              <div className="card-head">
                <div className="card-title">{info.title}</div>
                <div className="card-meta">{rows.length}</div>
              </div>
              {transfer ? <TransferBar teamId="org-group" teams={teams} members={rows} /> : null}
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
                      teams={teams}
                      showInvite={manage}
                      canEdit={manage}
                      canTransfer={transfer}
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
