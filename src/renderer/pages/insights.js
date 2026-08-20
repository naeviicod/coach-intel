import { el, playerAvatar, roleClass, statsForMember, aggregate, objStatsForModes, fmtObj } from '../utils.js';

// Org-wide by default; `ctx.param` narrows it to one team. The Team Hub embeds
// this same view with `ctx.header === false`, so the hub can supply its own
// heading instead of stacking two.
export async function render(container, ctx) {
  if (ctx.header !== false) {
    container.append(
      el('div', { class: 'page-header' }, [
        el('div', {}, [
          el('div', { class: 'page-title' }, 'Performance'),
          el('div', { class: 'page-subtitle' }, 'Compare players across the organization and spot who needs coaching attention'),
        ]),
      ])
    );
  }

  const allTeams = await window.cci.getTeams();
  const teamScoped = allTeams.find((t) => t.id === ctx.param);
  const teams = teamScoped ? [teamScoped] : allTeams;
  const rowsAll = [];
  for (const team of teams) {
    const [members, matches] = await Promise.all([window.cci.getMembers(team.id), window.cci.getMatches(team.id)]);
    for (const member of members) {
      const rows = statsForMember(matches, member.id);
      rowsAll.push({ team, member, rows, totals: aggregate(rows) });
    }
  }

  if (!rowsAll.length) {
    container.append(
      el('div', { class: 'card empty-state' }, [
        el('div', { class: 'icon' }, '✡'),
        el('div', { class: 'title' }, 'Nothing to compare yet'),
        el('div', {}, 'Add players and log a few matches first.'),
      ])
    );
    return;
  }

  const modes = [...new Set(rowsAll.flatMap((r) => r.rows.map((x) => x.match.mode)))];

  const filterBar = el('div', { class: 'filter-bar' }, [
    el('select', { id: 'mode-select' }, [
      el('option', { value: '' }, 'All Modes'),
      ...modes.map((m) => el('option', { value: m }, m)),
    ]),
  ]);
  container.append(filterBar);

  const grid = el('div', { class: 'grid cols-2 section' });
  container.append(grid);

  const tableWrap = el('div', { class: 'card' });
  container.append(tableWrap);

  function draw() {
    const modeVal = filterBar.querySelector('#mode-select').value;

    const scoped = rowsAll.map((r) => {
      const filteredRows = modeVal ? r.rows.filter((x) => x.match.mode === modeVal) : r.rows;
      return { ...r, scopedTotals: aggregate(filteredRows) };
    });

    const withMatches = scoped.filter((r) => r.scopedTotals.matches > 0);
    const sortedByKd = [...withMatches].sort((a, b) => b.scopedTotals.kd - a.scopedTotals.kd);
    const weakest = sortedByKd[sortedByKd.length - 1];
    const strongest = sortedByKd[0];

    grid.innerHTML = '';
    if (strongest) {
      grid.append(highlightCard('Strongest' + (modeVal ? ` on ${modeVal}` : ''), strongest, 'up'));
    }
    if (weakest && weakest !== strongest) {
      grid.append(highlightCard('Needs Attention' + (modeVal ? ` on ${modeVal}` : ''), weakest, 'down'));
    }

    // Only show the OBJ columns that mean something for the mode in view.
    const objStats = objStatsForModes(modeVal ? [modeVal] : modes);

    tableWrap.innerHTML = '';
    tableWrap.append(
      el('table', {}, [
        el('thead', {}, [
          el('tr', {}, [
            el('th', {}, 'Player'),
            teamScoped ? null : el('th', {}, 'Team'),
            el('th', {}, 'Role'),
            el('th', {}, 'Matches'),
            el('th', {}, 'K/D'),
            el('th', {}, 'Avg Damage'),
            ...objStats.map((s) => el('th', {}, s.short)),
            el('th', {}, 'Win Rate'),
          ]),
        ]),
        el(
          'tbody',
          {},
          sortedByKd.map((r) =>
            el(
              'tr',
              { class: 'clickable-row', onclick: () => ctx.navigate('member', `${r.team.id}/${r.member.id}`) },
              [
                el('td', {}, r.member.gamertag),
                teamScoped ? null : el('td', {}, r.team.name),
                el('td', {}, el('span', { class: `role-badge ${roleClass(r.member.role)}` }, r.member.role)),
                el('td', {}, r.scopedTotals.matches),
                el('td', {}, r.scopedTotals.kd),
                el('td', {}, Math.round(r.scopedTotals.damage / (r.scopedTotals.matches || 1))),
                ...objStats.map((s) => el('td', {}, fmtObj(s, r.scopedTotals.obj[s.key]))),
                el('td', {}, `${r.scopedTotals.winRate}%`),
              ]
            )
          )
        ),
      ])
    );
  }

  filterBar.querySelector('#mode-select').addEventListener('change', draw);
  draw();
}

function highlightCard(label, entry, direction) {
  return el('div', { class: 'card' }, [
    el('div', { class: 'stat-label' }, label),
    el('div', { style: 'display:flex;align-items:center;gap:10px;margin-top:8px;' }, [
      playerAvatar(entry.member),
      el('div', {}, [
        el('div', { class: 'gamertag' }, entry.member.gamertag),
        el('div', { class: 'member-name' }, `${entry.team.name} · ${entry.member.role}`),
      ]),
      el('div', { style: 'margin-left:auto;text-align:right;' }, [
        el('div', { class: `stat-value`, style: `font-size:18px;color:${direction === 'up' ? 'var(--win)' : 'var(--loss)'};` }, String(entry.scopedTotals.kd)),
        el('div', { class: 'field-hint' }, 'K/D'),
      ]),
    ]),
  ]);
}
