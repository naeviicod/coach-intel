import { el, playerAvatar, roleBadge, statsForMember, aggregate, teamMark } from '../utils.js';
import { openMemberModal } from '../lib/teamManage.js';

export async function render(container, ctx) {
  const teams = await window.cci.getTeams();

  container.append(
    el('div', { class: 'page-header' }, [
      el('div', {}, [
        el('div', { class: 'page-title' }, 'Players'),
        el('div', { class: 'page-subtitle' }, 'Add and edit roster members across the organization'),
      ]),
    ])
  );

  if (!teams.length) {
    container.append(el('div', { class: 'card empty-state' }, [
      el('div', { class: 'title' }, 'No teams yet'),
      el('div', {}, 'Create a team on the Teams page, then add players here.'),
      el('button', { class: 'btn primary', style: 'margin-top:14px;', onclick: () => ctx.navigate('teams') }, 'Go to Teams'),
    ]));
    return;
  }

  for (const team of teams) {
    const [members, matches] = await Promise.all([window.cci.getMembers(team.id), window.cci.getMatches(team.id)]);
    container.append(rosterCard(team, members, matches, ctx));
  }
}

function rosterCard(team, members, matches, ctx) {
  const card = el('div', { class: 'card section' }, [
    el('div', { class: 'team-identity', style: 'margin-bottom:16px;' }, [
      teamMark(team, { class: 'team-logo lg' }),
      el('div', { style: 'min-width:0;flex:1;' }, [
        el('div', { class: 'team-identity-kicker' }, team.tag ? `${team.tag} roster` : 'Team roster'),
        el('div', { class: 'team-identity-name' }, `${team.name} Roster`),
        el('div', { class: 'team-meta' }, `${members.length} player${members.length === 1 ? '' : 's'}`),
      ]),
      el('button', { class: 'btn primary', onclick: () => openMemberModal(ctx, team.id) }, '+ Add Player'),
    ]),
  ]);

  if (!members.length) {
    card.append(el('div', { class: 'field-hint' }, 'No players yet. Add the first member to this roster.'));
    return card;
  }

  for (const member of members) {
    const totals = aggregate(statsForMember(matches, member.id));
    card.append(
      el('div', { class: 'roster-row' }, [
        playerAvatar(member),
        el('div', {
          style: 'flex:1;min-width:0;cursor:pointer;',
          onclick: () => ctx.navigate('member', `${team.id}/${member.id}`),
        }, [
          el('div', { class: 'gamertag' }, member.gamertag),
          member.name && member.name !== member.gamertag
            ? el('div', { class: 'member-name' }, member.name)
            : null,
        ]),
        roleBadge(member.role),
        el('div', { class: 'crow-meta', style: 'width:70px;text-align:right;' }, totals.matches ? `${totals.kd} K/D` : '—'),
        el('div', { class: 'row-actions' }, [
          el('button', { class: 'btn subtle sm', onclick: () => openMemberModal(ctx, team.id, member) }, 'Edit'),
          el('button', {
            class: 'btn subtle sm danger',
            onclick: async () => {
              if (!confirm(`Remove ${member.gamertag} from ${team.name}?`)) return;
              await window.cci.deleteMember(team.id, member.id);
              ctx.navigate('players');
            },
          }, 'Remove'),
        ]),
      ])
    );
  }
  return card;
}
