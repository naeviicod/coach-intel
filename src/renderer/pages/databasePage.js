import { el, roleClass, statsForMember, aggregate } from '../utils.js';

export async function render(container, ctx) {
  container.append(
    el('div', { class: 'page-header' }, [
      el('div', {}, [
        el('div', { class: 'page-title' }, 'Player Database'),
        el('div', { class: 'page-subtitle' }, 'Searchable record of every player tracked in the organization'),
      ]),
    ])
  );

  const teams = await window.cci.getTeams();
  const rows = [];
  for (const team of teams) {
    const [members, matches] = await Promise.all([window.cci.getMembers(team.id), window.cci.getMatches(team.id)]);
    for (const member of members) {
      const totals = aggregate(statsForMember(matches, member.id));
      rows.push({ team, member, totals });
    }
  }

  const searchBar = el('div', { class: 'filter-bar' }, [
    el('input', { type: 'text', id: 'db-search', placeholder: 'Search gamertag, name, team, role…', style: 'width:280px;' }),
  ]);
  container.append(searchBar);

  const tableWrap = el('div', { class: 'card' });
  container.append(tableWrap);

  function draw() {
    const q = searchBar.querySelector('#db-search').value.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) =>
          [r.member.gamertag, r.member.name, r.team.name, r.member.role].join(' ').toLowerCase().includes(q)
        )
      : rows;

    tableWrap.innerHTML = '';
    if (!filtered.length) {
      tableWrap.append(el('div', { class: 'empty-state' }, [el('div', { class: 'icon' }, '🔍'), el('div', { class: 'title' }, 'No matches')]));
      return;
    }

    tableWrap.append(
      el('table', {}, [
        el('thead', {}, [
          el('tr', {}, [
            el('th', {}, 'Gamertag'),
            el('th', {}, 'Name'),
            el('th', {}, 'Team'),
            el('th', {}, 'Role'),
            el('th', {}, 'Matches'),
            el('th', {}, 'K/D'),
            el('th', {}, 'Avg Damage'),
            el('th', {}, 'Win Rate'),
          ]),
        ]),
        el(
          'tbody',
          {},
          filtered
            .sort((a, b) => b.totals.kd - a.totals.kd)
            .map((r) =>
              el(
                'tr',
                { class: 'clickable-row', onclick: () => ctx.navigate('member', `${r.team.id}/${r.member.id}`) },
                [
                  el('td', {}, r.member.gamertag),
                  el('td', {}, r.member.name),
                  el('td', {}, r.team.name),
                  el('td', {}, el('span', { class: `role-badge ${roleClass(r.member.role)}` }, r.member.role)),
                  el('td', {}, r.totals.matches),
                  el('td', {}, r.totals.kd),
                  el('td', {}, r.totals.matches ? Math.round(r.totals.damage / r.totals.matches) : 0),
                  el('td', {}, `${r.totals.winRate}%`),
                ]
              )
            )
        ),
      ])
    );
  }

  searchBar.querySelector('#db-search').addEventListener('input', draw);
  draw();
}
