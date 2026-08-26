import { el, fmtDue, fmtStamp, orgMark, teamMark, teamWinRate } from '../utils.js';
import { buildSignals } from './intelFeed.js';
import { kpi, miniEmpty, taskRow } from './teamHub/parts.js';

// Deliberately not a copy of the Team Hub: this answers "what needs me today"
// across the whole organization, and every team-specific detail links away.
export async function render(container, ctx) {
  const reload = async () => {
    container.innerHTML = '';
    await draw(container, ctx, reload);
  };
  await draw(container, ctx, reload);
}

async function draw(container, ctx, reload) {
  const [org, teams] = await Promise.all([
    ctx.org ? Promise.resolve(ctx.org) : window.cci.getOrg(),
    ctx.teams?.length ? Promise.resolve(ctx.teams) : window.cci.getTeams(),
  ]);

  container.append(
    el('div', { class: 'page-header' }, [
      el('div', { class: 'page-identity' }, [
        orgMark(org, { class: 'sb-org-logo page-org-logo' }),
        el('div', { style: 'min-width:0;' }, [
          el('div', { class: 'page-org-name' }, org?.name || 'Your organization'),
          el('div', { class: 'page-title' }, 'Dashboard'),
          el('div', { class: 'page-subtitle' }, 'What needs attention today'),
        ]),
      ]),
    ])
  );

  if (!teams.length) {
    container.append(el('div', { class: 'card empty-state' }, [el('div', { class: 'title' }, 'No teams yet')]));
    return;
  }

  const perTeam = await Promise.all(
    teams.map(async (team) => {
      const [members, matches, tasks, notes, review] = await Promise.all([
        window.cci.getMembers(team.id),
        window.cci.getMatches(team.id),
        window.cci.getTasks(team.id),
        window.cci.getNotes(team.id),
        window.cci.getNeedsReview(team.id).catch(() => []),
      ]);
      return { team, members, matches, tasks, notes, review: review || [] };
    })
  );

  const allMatches = perTeam.flatMap((t) => t.matches);
  const openTasks = perTeam.flatMap((t) => t.tasks.filter((task) => !task.done).map((task) => ({ ...task, team: t.team })));
  const reviewCount = perTeam.reduce((n, t) => n + t.review.length, 0);

  container.append(
    el('div', { class: 'kpi-row' }, [
      kpi({ label: 'Teams', value: teams.length, meta: 'In organization', onClick: () => ctx.navigate('teams') }),
      kpi({
        label: 'Open Tasks',
        value: openTasks.length,
        meta: openTasks.filter((t) => fmtDue(t.due).overdue).length
          ? `${openTasks.filter((t) => fmtDue(t.due).overdue).length} overdue`
          : 'Nothing overdue',
        accent: openTasks.length > 0,
        onClick: () => ctx.navigate('tasks'),
      }),
      kpi({
        label: 'Scoreboard Inbox',
        value: reviewCount,
        meta: reviewCount ? 'Screenshots pending' : 'Queue clear',
        onClick: () => ctx.navigate('needs-review'),
      }),
      kpi({
        label: 'Matches',
        value: allMatches.length,
        meta: allMatches.length ? `${teamWinRate(allMatches)}% win rate` : 'None yet',
        onClick: () => ctx.navigate('matches'),
      }),
    ])
  );

  const grid = el('div', { class: 'grid cols-2', style: 'margin-bottom:14px;' });
  grid.append(attentionCard(ctx, perTeam, openTasks, reload));
  grid.append(intelCard(ctx, perTeam));
  container.append(grid);

  container.append(teamsCard(ctx, perTeam));
}

function attentionCard(ctx, perTeam, openTasks, reload) {
  const card = el('div', { class: 'card compact' }, [
    el('div', { class: 'card-head' }, [
      el('h2', {}, 'Needs Attention'),
      el('button', { class: 'btn subtle sm', onclick: () => ctx.navigate('tasks') }, 'All tasks →'),
    ]),
  ]);

  const overdue = openTasks.filter((t) => fmtDue(t.due).overdue);
  const soon = openTasks.filter((t) => !fmtDue(t.due).overdue).slice(0, 5 - Math.min(overdue.length, 5));
  const shown = [...overdue.slice(0, 5), ...soon];
  const pendingReview = perTeam.filter((t) => t.review.length);

  if (!shown.length && !pendingReview.length) {
    card.append(miniEmpty('Nothing pending', 'No open tasks and no screenshots waiting for review.'));
    return card;
  }

  for (const team of pendingReview) {
    card.append(
      el('button', { type: 'button', class: 'note-row', onclick: () => ctx.navigate('needs-review', team.team.id) }, [
        el('div', { class: 'note-title' }, `${team.review.length} screenshot${team.review.length === 1 ? '' : 's'} to review`),
        el('div', { class: 'note-meta' }, team.team.name),
      ])
    );
  }
  for (const task of shown) {
    card.append(
      taskRow(task, {
        onToggle: async (t) => {
          await window.cci.saveTask(t.team.id, { task_id: t.task_id, done: !t.done });
          await reload();
        },
        onOpen: (t) => ctx.navigate('team-hub', `${t.team.id}/objectives`),
      })
    );
  }
  return card;
}

function intelCard(ctx, perTeam) {
  const card = el('div', { class: 'card compact' }, [
    el('div', { class: 'card-head' }, [
      el('h2', {}, 'Recent Intel'),
      el('button', { class: 'btn subtle sm', onclick: () => ctx.navigate('intel-feed') }, 'Intel Feed →'),
    ]),
  ]);

  const signals = perTeam
    .flatMap((t) => buildSignals(t.members, t.matches).map((s) => ({ ...s, team: t.team })))
    .slice(0, 5);

  if (!signals.length) {
    card.append(miniEmpty('No signals yet', 'Signals surface once teams have enough matches and scrims on the books.'));
    return card;
  }
  for (const s of signals) {
    card.append(
      el('div', { class: 'intel-signal' }, [
        el('span', { class: `intel-signal-icon ${s.tone}` }, s.glyph),
        el('div', {}, [
          el('div', { class: 'intel-signal-title' }, s.title),
          el('div', { class: 'intel-signal-body' }, `${s.body} · ${s.team.name}`),
        ]),
      ])
    );
  }
  return card;
}

// One or two teams read best as full-width rows. Past that a list only gets
// longer, so the block switches to tiles and tightens again once the org is
// big enough that name and form are all that fit.
function teamsDensity(count) {
  if (count <= 2) return 'roomy';
  return count <= 8 ? 'compact' : 'dense';
}

function teamsCard(ctx, perTeam) {
  const density = teamsDensity(perTeam.length);
  const card = el('div', { class: 'card compact' }, [
    el('div', { class: 'card-head' }, [
      el('h2', {}, 'Teams'),
      density === 'roomy' ? null : el('div', { class: 'card-meta' }, `${perTeam.length} teams`),
    ]),
  ]);
  const list = el('div', { class: 'team-grid', 'data-density': density });
  for (const entry of perTeam) {
    list.append(density === 'roomy' ? teamRow(ctx, entry) : teamTile(ctx, entry, density));
  }
  card.append(list);
  return card;
}

function teamRow(ctx, { team, members, matches, notes }) {
  const lastNote = notes[0];
  return el('button', { type: 'button', class: 'crow', onclick: () => ctx.navigate('team-hub', team.id) }, [
    teamMark(team),
    el('div', { class: 'crow-main' }, [
      el('div', { class: 'crow-title' }, team.name),
      el('div', { class: 'crow-sub' }, [
        `${members.length} player${members.length === 1 ? '' : 's'}`,
        el('span', {}, '·'),
        matches.length ? `${matches.length} matches · ${teamWinRate(matches)}%` : 'No matches',
      ]),
    ]),
    el('div', { class: 'crow-meta' }, lastNote ? `Note ${fmtStamp(lastNote.updated_at)}` : 'No notes'),
  ]);
}

function teamTile(ctx, { team, members, matches }, density) {
  const winRate = matches.length ? `${teamWinRate(matches)}%` : null;
  const meta = density === 'dense'
    ? [`${members.length}P`, winRate || 'No matches'].join(' · ')
    : [
      `${members.length} player${members.length === 1 ? '' : 's'}`,
      matches.length ? `${matches.length} matches` : 'No matches',
      winRate,
    ].filter(Boolean).join(' · ');

  return el(
    'button',
    {
      type: 'button',
      class: 'team-tile',
      title: team.name,
      onclick: () => ctx.navigate('team-hub', team.id),
    },
    [
      teamMark(team, { class: 'team-logo team-tile-mark' }),
      el('div', { class: 'team-tile-main' }, [
        el('div', { class: 'team-tile-name' }, team.name),
        el('div', { class: 'team-tile-meta' }, meta),
      ]),
    ]
  );
}
