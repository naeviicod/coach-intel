import { el, fmtDate } from '../utils.js';

export async function render(container, ctx) {
  container.append(
    el('div', { class: 'page-header' }, [
      el('div', {}, [
        el('div', { class: 'page-title' }, 'Match Log'),
        el('div', { class: 'page-subtitle' }, 'Org-wide match history, filterable by team, mode, and map'),
      ]),
    ])
  );

  const teams = await window.cci.getTeams();
  const allMatches = [];
  for (const team of teams) {
    const matches = await window.cci.getMatches(team.id);
    for (const m of matches) allMatches.push({ ...m, teamId: team.id, teamName: team.name });
  }
  allMatches.sort((a, b) => (a.date < b.date ? 1 : -1));

  const modes = [...new Set(allMatches.map((m) => m.mode))];
  const maps = [...new Set(allMatches.map((m) => m.map))];

  const teamScoped = teams.some((t) => t.id === ctx.param);
  const filterBar = el('div', { class: 'filter-bar' }, [
    selectFilter('team-filter', 'All Teams', teams.map((t) => [t.id, t.name]), teamScoped ? ctx.param : ''),
    selectFilter('mode-filter', 'All Modes', modes.map((m) => [m, m])),
    selectFilter('map-filter', 'All Maps', maps.map((m) => [m, m])),
    selectFilter('result-filter', 'Any Result', [
      ['Win', 'Win'],
      ['Loss', 'Loss'],
    ]),
  ]);
  container.append(filterBar);

  const tableWrap = el('div', { class: 'card' });
  container.append(tableWrap);

  function draw() {
    const teamVal = filterBar.querySelector('#team-filter').value;
    const modeVal = filterBar.querySelector('#mode-filter').value;
    const mapVal = filterBar.querySelector('#map-filter').value;
    const resultVal = filterBar.querySelector('#result-filter').value;

    const filtered = allMatches.filter(
      (m) =>
        (!teamVal || m.teamId === teamVal) &&
        (!modeVal || m.mode === modeVal) &&
        (!mapVal || m.map === mapVal) &&
        (!resultVal || m.result === resultVal)
    );

    tableWrap.innerHTML = '';
    if (!filtered.length) {
      tableWrap.append(
        el('div', { class: 'empty-state' }, [
          el('div', { class: 'icon' }, '📋'),
          el('div', { class: 'title' }, 'No matches match these filters'),
        ])
      );
      return;
    }

    tableWrap.append(
      el('table', {}, [
        el('thead', {}, [
          el('tr', {}, [
            el('th', {}, 'Date'),
            el('th', {}, 'Team'),
            el('th', {}, 'Mode'),
            el('th', {}, 'Map'),
            el('th', {}, 'Score'),
            el('th', {}, 'Result'),
            el('th', {}, 'Top Performer'),
          ]),
        ]),
        el(
          'tbody',
          {},
          filtered.map((m) => {
            const top = [...(m.players || [])].sort((a, b) => (b.kills || 0) - (a.kills || 0))[0];
            return el(
              'tr',
              { class: 'clickable-row', onclick: () => ctx.navigate('command-center', m.teamId) },
              [
                el('td', {}, fmtDate(m.date)),
                el('td', {}, m.teamName),
                el('td', { class: 'mode-tag' }, m.mode),
                el('td', {}, m.map),
                el('td', {}, m.score),
                el('td', {}, el('span', { class: `pill ${m.result === 'Win' ? 'win' : 'loss'}` }, m.result)),
                el('td', {}, top ? `${top.member_id} (${top.kills}K)` : '—'),
              ]
            );
          })
        ),
      ])
    );
  }

  filterBar.querySelectorAll('select').forEach((s) => s.addEventListener('change', draw));
  draw();
}

function selectFilter(id, allLabel, options, selectedValue = '') {
  return el('select', { id }, [
    el('option', { value: '', selected: selectedValue === '' ? 'selected' : null }, allLabel),
    ...options.map(([value, label]) => el('option', { value, selected: value === selectedValue ? 'selected' : null }, label)),
  ]);
}
