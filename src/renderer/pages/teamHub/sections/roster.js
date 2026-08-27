import { el, playerAvatar, roleBadge, statsForMember, aggregate, teamMark, verifiedMark } from '../../../utils.js';
import { uploadTeamLogo } from '../../../lib/teamManage.js';
import { splitRoster, isStaffMember, isMemberDisabled } from '../../../lib/roster.js';
import { memberStaffTitle, orgTitles, memberDiscordVerified } from '../../../lib/profile.js';
import { miniEmpty } from '../parts.js';

export async function render(root, hub) {
  const [members, matches] = await Promise.all([
    window.cci.getMembers(hub.team.id),
    window.cci.getMatches(hub.team.id),
  ]);

  root.append(logoSection(hub, members.length));

  if (!members.length) {
    root.append(
      el('div', { class: 'card' }, [
        miniEmpty(
          'No members yet',
          'Add players on the Players page. They show here with match stats.',
          el('button', { class: 'btn primary sm edit-only', onclick: () => hub.navigate('players') }, 'Add Member')
        ),
      ])
    );
    return;
  }

  const { starters, bench, staff, disabled } = splitRoster(members);

  root.append(group(hub, 'Starting lineup', starters, matches, 'No starters yet. Add players from the Players page.'));
  root.append(group(hub, 'Backup / Bench', bench, matches, starters.length >= 4 ? 'No bench players. Add backups when the starting 4 is full.' : null));
  if (staff.length) root.append(group(hub, 'Staff', staff, matches));
  if (disabled.length) root.append(group(hub, 'Disabled', disabled, matches));
}

function logoSection(hub, memberCount) {
  return el('div', { class: 'card compact', style: 'margin-bottom:14px;' }, [
    el('div', { class: 'card-head' }, [
      el('div', { class: 'card-title' }, 'Team Logo'),
      el('div', { style: 'display:flex;align-items:center;gap:8px;margin-left:auto;' }, [
        el('div', { class: 'card-meta' }, `${memberCount} member${memberCount === 1 ? '' : 's'}`),
        el('button', { class: 'btn subtle sm edit-only', onclick: () => hub.navigate('players') }, 'Add / Edit Players'),
        hub.ctxToggle,
      ]),
    ]),
    el('div', { class: 'logo-well' }, [
      teamMark(hub.team, { class: 'team-logo xl' }),
      el('div', { style: 'min-width:0;flex:1;' }, [
        el('div', { class: 'settings-row-title' }, hub.team.logo ? hub.team.name : 'No logo yet'),
        el('div', { class: 'field-hint' }, 'Square PNG or JPG. Shown on Teams, Players, and this roster.'),
        el('button', {
          class: 'btn sm edit-only',
          style: 'margin-top:10px;',
          onclick: async () => {
            const saved = await uploadTeamLogo(hub.team);
            if (!saved) return;
            await hub.refreshShell();
            hub.go('roster');
          },
        }, hub.team.logo ? 'Change Logo' : 'Upload Logo'),
      ]),
    ]),
  ]);
}

function group(hub, title, members, matches, empty) {
  if (!members.length && !empty) return null;
  const card = el('div', { class: 'card compact', style: 'margin-bottom:14px;' }, [
    el('div', { class: 'card-head' }, [
      el('div', { class: 'card-title' }, title),
      el('div', { class: 'card-meta' }, String(members.length)),
    ]),
  ]);

  if (!members.length) {
    card.append(el('div', { class: 'field-hint', style: 'padding:6px 2px;' }, empty));
    return card;
  }

  for (const member of members) {
    const stats = playerStats(member, matches);
    const open = () => hub.navigate('member', `${hub.team.id}/${member.id}`);
    card.append(
      el(
        'div',
        {
          class: `crow${isMemberDisabled(member) ? ' is-disabled' : ''}`,
          role: 'button',
          tabindex: '0',
          'aria-label': `Open ${member.gamertag}, ${member.role || 'player'}`,
          onclick: open,
          onkeydown: (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              open();
            }
          },
        },
        [
          playerAvatar(member),
          el('div', { class: 'crow-main' }, [
            el('div', { class: 'crow-title' }, [
              member.gamertag,
              memberDiscordVerified(member) ? verifiedMark() : null,
            ]),
            (() => {
              const sub = [member.name && member.name !== member.gamertag ? member.name : '', memberStaffTitle(member)]
                .filter(Boolean)
                .join(' · ');
              return sub ? el('div', { class: 'crow-sub' }, sub) : null;
            })(),
          ]),
          el('div', { class: 'roster-tags' }, [
            ...orgTitles(member)
              .filter((t) => !/^player$/i.test(t))
              .map((t) => el('span', { class: `role-badge org ${String(t).replace(/\s+/g, '-')}` }, t)),
            isStaffMember(member) ? null : roleBadge(member.role),
            isMemberDisabled(member) ? el('span', { class: 'pill nomatch' }, 'Disabled') : member.slot === 'bench' ? el('span', { class: 'pill' }, 'Bench') : null,
          ]),
          stats
            ? el('div', { class: 'crow-meta' }, `${stats.kd} K/D · ${stats.maps} match${stats.maps === 1 ? '' : 'es'}`)
            : el('div', { class: 'crow-meta' }, 'No match data'),
        ]
      )
    );
  }
  return card;
}

function playerStats(member, matches) {
  const rows = statsForMember(matches, member.id);
  if (!rows.length) return null;
  const agg = aggregate(rows);
  return { maps: agg.matches, kd: agg.kd };
}
