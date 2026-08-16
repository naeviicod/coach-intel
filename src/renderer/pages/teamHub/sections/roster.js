import { el, playerAvatar, roleBadge, statsForMember, aggregate, teamMark } from '../../../utils.js';
import { uploadTeamLogo } from '../../../lib/teamManage.js';
import { miniEmpty } from '../parts.js';

export async function render(root, hub) {
  const [members, matches] = await Promise.all([
    window.cci.getMembers(hub.team.id),
    window.cci.getMatches(hub.team.id),
  ]);

  root.append(
    el('div', { class: 'hub-head team-identity' }, [
      teamMark(hub.team, { class: 'team-logo lg' }),
      el('div', { style: 'flex:1;min-width:0;' }, [
        el('div', { class: 'team-identity-kicker' }, hub.team.tag ? `${hub.team.tag} · Call of Duty` : 'Call of Duty'),
        el('h1', { class: 'hub-title team-identity-name' }, `${hub.team.name} Roster`),
        el('div', { class: 'hub-sub' }, `${members.length} member${members.length === 1 ? '' : 's'}`),
      ]),
      el('button', { class: 'btn subtle', onclick: () => hub.navigate('players') }, 'Add / Edit Players'),
      hub.ctxToggle,
    ])
  );

  root.append(logoSection(hub));

  if (!members.length) {
    root.append(
      el('div', { class: 'card' }, [
        miniEmpty(
          'No members yet',
          'Add players on the Players page. They show here with match stats.',
          el('button', { class: 'btn primary sm', onclick: () => hub.navigate('players') }, 'Add Player')
        ),
      ])
    );
    return;
  }

  const players = members.filter((m) => m.role !== 'Coach' && m.role !== 'Analyst');
  const staff = members.filter((m) => m.role === 'Coach' || m.role === 'Analyst');

  root.append(group(hub, 'Players', players, matches));
  if (staff.length) root.append(group(hub, 'Staff', staff, matches));
}

function logoSection(hub) {
  return el('div', { class: 'card compact', style: 'margin-bottom:14px;' }, [
    el('div', { class: 'card-head' }, [el('div', { class: 'card-title' }, 'Team Logo')]),
    el('div', { class: 'logo-well' }, [
      teamMark(hub.team, { class: 'team-logo xl' }),
      el('div', { style: 'min-width:0;flex:1;' }, [
        el('div', { class: 'settings-row-title' }, hub.team.logo ? hub.team.name : 'No logo yet'),
        el('div', { class: 'field-hint' }, 'Square PNG or JPG. Shown on Teams, Players, and this roster.'),
        el('button', {
          class: 'btn sm',
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

function group(hub, title, members, matches) {
  const card = el('div', { class: 'card compact', style: 'margin-bottom:14px;' }, [
    el('div', { class: 'card-head' }, [el('div', { class: 'card-title' }, title)]),
  ]);

  for (const member of members) {
    const stats = playerStats(member, matches);
    const open = () => hub.navigate('member', `${hub.team.id}/${member.id}`);
    card.append(
      el(
        'div',
        {
          class: 'crow',
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
            el('div', { class: 'crow-title' }, member.gamertag),
            member.name && member.name !== member.gamertag
              ? el('div', { class: 'crow-sub' }, member.name)
              : null,
          ]),
          roleBadge(member.role),
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
