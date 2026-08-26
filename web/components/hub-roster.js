'use client';

import Link from 'next/link';
import { MiniEmpty } from './hub-parts';
import { orgTitles, PlayerAvatar, RoleBadge, splitRoster, TeamMark, VerifiedMark, memberDiscordVerified } from '../lib/marks';
import { aggregate, statsForMember } from '../lib/stats';

export function HubRoster({ team, members, matches, ctxToggle }) {
  const { starters, bench, staff } = splitRoster(members);
  return (
    <>
      <div className="card compact" style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div className="card-title">Team Logo</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <div className="card-meta">{`${members.length} member${members.length === 1 ? '' : 's'}`}</div>
            <Link href="/players" className="btn subtle sm">Add / Edit Players</Link>
            {ctxToggle}
          </div>
        </div>
        <div className="logo-well">
          <TeamMark team={team} className="team-logo xl" />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="settings-row-title">{team.logo ? team.name : 'No logo yet'}</div>
            <div className="field-hint">Square PNG or JPG. Shown on Teams, Players, and this roster.</div>
          </div>
        </div>
      </div>
      {members.length === 0 ? (
        <div className="card">
          <MiniEmpty title="No members yet" body="Add players on the Players page. They show here with match stats.">
            <Link href="/players" className="btn primary sm">Add Member</Link>
          </MiniEmpty>
        </div>
      ) : (
        <>
          <Group title="Starting lineup" rows={starters} matches={matches} empty="No starters yet. Add players from the Players page." />
          <Group
            title="Backup / Bench"
            rows={bench}
            matches={matches}
            empty={starters.length >= 4 ? 'No bench players. Add backups when the starting 4 is full.' : null}
          />
          {staff.length ? <Group title="Staff" rows={staff} matches={matches} /> : null}
        </>
      )}
    </>
  );
}

function Group({ title, rows, matches, empty }) {
  if (!rows.length && !empty) return null;
  return (
    <div className="card compact" style={{ marginBottom: 14 }}>
      <div className="card-head">
        <div className="card-title">{title}</div>
        <div className="card-meta">{rows.length}</div>
      </div>
      {!rows.length ? (
        <div className="field-hint" style={{ padding: '6px 2px' }}>{empty}</div>
      ) : (
        rows.map((member) => {
          const titles = orgTitles(member).filter((t) => !/^player$/i.test(t));
          const staff = member.slot === 'staff';
          const stats = playerStats(member, matches);
          return (
            <div key={member.id} className="crow">
              <PlayerAvatar member={member} />
              <div className="crow-main">
                <div className="crow-title">
                  {member.gamertag || member.name}
                  {memberDiscordVerified(member) ? <VerifiedMark /> : null}
                </div>
                {member.name && member.name !== member.gamertag ? <div className="crow-sub">{member.name}</div> : null}
              </div>
              {titles.map((t) => (
                <span key={t} className={`role-badge org ${String(t).replace(/\s+/g, '-')}`}>{t}</span>
              ))}
              {staff ? null : <RoleBadge role={member.role} />}
              {member.slot === 'bench' ? <span className="pill">Bench</span> : null}
              <div className="crow-meta">{stats ? `${stats.kd} K/D · ${stats.maps} match${stats.maps === 1 ? '' : 'es'}` : 'No match data'}</div>
            </div>
          );
        })
      )}
    </div>
  );
}

function playerStats(member, matches) {
  const rows = statsForMember(matches, member.id);
  if (!rows.length) return null;
  const agg = aggregate(rows);
  return { maps: agg.matches, kd: agg.kd };
}
