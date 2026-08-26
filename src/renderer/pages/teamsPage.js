import { el, teamMark, teamWinRate, sparkline } from '../utils.js';
import { openTeamModal, uploadTeamLogo } from '../lib/teamManage.js';

export async function render(container, ctx) {
  const teams = ctx.teams?.length ? ctx.teams : await window.cci.getTeams();

  container.append(
    el('div', { class: 'page-header' }, [
      el('div', {}, [
        el('div', { class: 'page-title' }, 'Teams'),
        el('div', { class: 'page-subtitle' }, `${teams.length} team${teams.length === 1 ? '' : 's'} in the organization`),
      ]),
      el('button', { class: 'btn primary edit-only', onclick: () => openTeamModal(ctx) }, '+ Add Team'),
    ])
  );

  if (!teams.length) {
    container.append(el('div', { class: 'card empty-state' }, [
      el('div', { class: 'title' }, 'No teams yet'),
      el('div', {}, 'Add a team here. Players are added on the Players page.'),
    ]));
    return;
  }

  const cards = await Promise.all(teams.map(async (team) => {
    const [members, matches] = await Promise.all([window.cci.getMembers(team.id), window.cci.getMatches(team.id)]);
    return teamCard(team, members, matches, ctx);
  }));
  container.append(el('div', { class: 'grid cols-2' }, cards));
}

function teamCard(team, members, matches, ctx) {
  const winRate = teamWinRate(matches);
  const record = matches.reduce(
    (acc, m) => {
      if (m.result === 'Win') acc.w += 1;
      else acc.l += 1;
      return acc;
    },
    { w: 0, l: 0 }
  );
  const recentResults = matches.slice(0, 8).reverse().map((m) => (m.result === 'Win' ? 1 : 0));

  return el('div', { class: 'card team-card' }, [
    el('div', { class: 'team-card-head' }, [
      teamMark(team, { class: 'team-logo lg' }),
      el('div', { style: 'min-width:0;flex:1;' }, [
        el('div', { class: 'team-identity-kicker' }, team.tag || 'Team'),
        el('div', { class: 'team-name', style: 'font-size:18px;' }, team.name),
        el('div', { class: 'team-meta' }, `${members.length} player${members.length === 1 ? '' : 's'} · ${record.w}-${record.l}`),
      ]),
    ]),
    el('div', { class: 'logo-well edit-only', style: 'margin-top:4px;' }, [
      el('div', { class: 'field-hint', style: 'margin:0;flex:1;' }, team.logo ? 'Team logo on file.' : 'No logo yet. Upload a square PNG or JPG.'),
      el('button', {
        class: 'btn sm',
        onclick: async (e) => {
          e.stopPropagation();
          const saved = await uploadTeamLogo(team);
          if (saved) {
            await ctx.refreshShell();
            ctx.navigate('teams');
          }
        },
      }, team.logo ? 'Change Logo' : 'Upload Logo'),
    ]),
    el('div', { style: 'display:flex;align-items:center;justify-content:space-between;' }, [
      el('div', {}, [
        el('div', { class: 'stat-label' }, 'Win Rate'),
        el('div', { class: 'stat-value', style: 'font-size:18px;' }, `${winRate}%`),
      ]),
      el('div', { html: sparkline(recentResults.length ? recentResults : [0, 0]) }),
    ]),
    el('div', { class: 'team-card-actions' }, [
      el('button', { class: 'btn sm', onclick: () => ctx.navigate('team-hub', team.id) }, 'Open Hub'),
      el('button', { class: 'btn sm edit-only', onclick: () => openTeamModal(ctx, team) }, 'Edit'),
      el('button', {
        class: 'btn sm danger edit-only',
        onclick: async () => {
          if (!confirm(`Delete ${team.name} and all of its data? This cannot be undone.`)) return;
          await window.cci.deleteTeam(team.id);
          await ctx.refreshShell();
          ctx.navigate('teams');
        },
      }, 'Delete'),
    ]),
  ]);
}
