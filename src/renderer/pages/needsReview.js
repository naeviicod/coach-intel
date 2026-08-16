import { el } from '../utils.js';
import { scoreboardDrop, scoreboardGrid, fmtDateFolder } from '../components/scoreboardDrop.js';

export async function render(container, ctx) {
  const teams = await window.cci.getTeams();
  const requested = ctx.param && teams.find((t) => t.id === ctx.param);
  const state = { teamId: requested?.id || teams[0]?.id || null };

  const reload = async () => {
    container.innerHTML = '';
    await draw(container, ctx, teams, state, reload);
  };
  await draw(container, ctx, teams, state, reload);
}

async function draw(container, ctx, teams, state, reload) {
  container.append(
    el('div', { class: 'page-header' }, [
      el('div', {}, [
        el('div', { class: 'page-title' }, 'Needs Review'),
        el('div', { class: 'page-subtitle' }, 'Drop scoreboard screenshots here. Coach Intel files them by team and date, then reads the stats.'),
      ]),
    ])
  );

  if (!teams.length) {
    container.append(
      el('div', { class: 'card empty-state' }, [
        el('div', { class: 'title' }, 'Create a team first'),
        el('div', {}, 'Scoreboards are stored per team so the roster and aliases line up.'),
        el('button', { class: 'btn primary', style: 'margin-top:14px;', onclick: () => ctx.navigate('teams') }, 'Add a team'),
      ])
    );
    return;
  }

  const teamSelect = el('select', {
    id: 'sb-team',
    onchange: () => {
      state.teamId = teamSelect.value;
      ctx.navigate('needs-review', state.teamId);
    },
  });
  for (const team of teams) {
    teamSelect.append(el('option', { value: team.id, selected: team.id === state.teamId ? '' : null }, team.name));
  }

  container.append(
    el('div', { class: 'card sb-drop-card' }, [
      el('div', { class: 'card-head' }, [
        el('h2', {}, 'Scoreboard inbox'),
        el('div', { class: 'field', style: 'margin:0;min-width:180px;' }, [
          el('label', { for: 'sb-team' }, 'Team'),
          teamSelect,
        ]),
      ]),
      scoreboardDrop({
        teamId: state.teamId,
        onImported: reload,
      }),
    ])
  );

  const items = state.teamId ? await window.cci.listScoreboards(state.teamId) : [];
  const teamName = teams.find((t) => t.id === state.teamId)?.name || 'this team';

  container.append(
    el('div', { class: 'card', style: 'margin-top:14px;' }, [
      el('div', { class: 'card-head' }, [
        el('h2', {}, 'Waiting to be read'),
        el('div', { class: 'card-meta' }, `${items.length} file${items.length === 1 ? '' : 's'} · ${teamName}`),
      ]),
      items.length
        ? datedInbox(items, reload)
        : el('div', { class: 'field-hint', style: 'padding:8px 0 4px;' },
          'Nothing in this team’s inbox yet. Drop a post-game scoreboard above — Hardpoint, Search, or Control.'),
    ])
  );
}

function datedInbox(items, reload) {
  const groups = new Map();
  for (const item of items) {
    const key = item.date || 'undated';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const wrap = el('div', { class: 'sb-date-groups' });
  for (const [date, rows] of [...groups.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))) {
    wrap.append(
      el('div', { class: 'sb-date-group' }, [
        el('div', { class: 'sb-date-label' }, date === 'undated' ? 'Undated' : fmtDateFolder(date)),
        scoreboardGrid(rows, {
          onRemove: async (item) => {
            await window.cci.deleteScoreboard(item.teamId, item.key || item.filename, item.bucket);
            await reload();
          },
        }),
      ])
    );
  }
  return wrap;
}
