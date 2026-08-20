import { el, roleBadge, statsForMember, aggregate, verifiedMark } from '../utils.js';
import { memberStaffTitle, memberDiscordVerified } from '../lib/profile.js';
import { isStaffMember } from '../lib/roster.js';
import { openMemberModal } from '../lib/teamManage.js';
import { toast } from '../components/modal.js';

export async function render(container, ctx) {
  const teams = await window.cci.getTeams();

  container.append(
    el('div', { class: 'page-header' }, [
      el('div', {}, [
        el('div', { class: 'page-title' }, 'Member Database'),
        el('div', { class: 'page-subtitle' }, 'Everyone in the organization — players, staff, and creatives — and their org role'),
      ]),
      ctx.canEdit
        ? el('button', {
            class: 'btn primary edit-only',
            onclick: () => {
              if (!teams.length) {
                toast('Create a team first, then add staff.');
                return;
              }
              openMemberModal(ctx, teams[0].id, null, {
                slot: 'staff',
                teams,
                onSaved: () => ctx.navigate('database'),
              });
            },
          }, '+ Add Staff')
        : null,
    ])
  );
  const rows = [];
  for (const team of teams) {
    const [members, matches] = await Promise.all([window.cci.getMembers(team.id), window.cci.getMatches(team.id)]);
    for (const member of members) {
      const totals = aggregate(statsForMember(matches, member.id));
      const orgRole = memberStaffTitle(member) || (isStaffMember(member) ? 'Staff' : 'Player');
      rows.push({ team, member, totals, orgRole });
    }
  }

  const searchBar = el('div', { class: 'filter-bar' }, [
    el('input', { type: 'text', id: 'db-search', placeholder: 'Search name, team, org role…', style: 'width:280px;' }),
  ]);
  container.append(searchBar);

  const tableWrap = el('div', { class: 'card' });
  container.append(tableWrap);

  function draw() {
    const q = searchBar.querySelector('#db-search').value.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) =>
          [r.member.gamertag, r.member.name, r.team.name, r.orgRole, r.member.role, r.member.title]
            .join(' ')
            .toLowerCase()
            .includes(q)
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
            el('th', {}, 'Name'),
            el('th', {}, 'Team'),
            el('th', {}, 'Org Role'),
            el('th', {}, 'In-game'),
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
            .sort((a, b) => {
              const team = String(a.team.name).localeCompare(String(b.team.name));
              if (team) return team;
              const role = String(a.orgRole).localeCompare(String(b.orgRole));
              if (role) return role;
              return String(a.member.gamertag).localeCompare(String(b.member.gamertag));
            })
            .map((r) =>
              el(
                'tr',
                { class: 'clickable-row', onclick: () => ctx.navigate('member', `${r.team.id}/${r.member.id}`) },
                [
                  el('td', {}, [
                    el('div', { class: 'gamertag' }, [
                      r.member.gamertag,
                      memberDiscordVerified(r.member) ? verifiedMark() : null,
                    ]),
                    r.member.name && r.member.name !== r.member.gamertag
                      ? el('div', { class: 'member-name' }, r.member.name)
                      : null,
                  ]),
                  el('td', {}, r.team.name),
                  el('td', {}, el('span', { class: `role-badge org ${roleClassSafe(r.orgRole)}` }, r.orgRole)),
                  el('td', {}, isStaffMember(r.member) ? el('span', { class: 'field-hint' }, '—') : roleBadge(r.member.role)),
                  el('td', {}, r.totals.matches),
                  el('td', {}, r.totals.matches ? r.totals.kd : '—'),
                  el('td', {}, r.totals.matches ? Math.round(r.totals.damage / r.totals.matches) : '—'),
                  el('td', {}, r.totals.matches ? `${r.totals.winRate}%` : '—'),
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

function roleClassSafe(role) {
  return String(role || 'Player').replace(/\s+/g, '-');
}
