import { el, playerAvatar, roleBadge, fmtDate, statsForMember, aggregate, sparkline } from '../utils.js';
import { openMemberModal } from '../lib/teamManage.js';

export async function render(container, ctx) {
  const [teamId, memberId] = (ctx.param || '').split('/');
  const [team, member, matches] = await Promise.all([
    window.cci.getTeam(teamId),
    window.cci.getMember(teamId, memberId),
    window.cci.getMatches(teamId),
  ]);

  if (!member || !team) {
    container.append(el('div', { class: 'card empty-state' }, 'Player not found.'));
    return;
  }

  const rows = statsForMember(matches, memberId).sort((a, b) => (a.match.date < b.match.date ? -1 : 1));
  const totals = aggregate(rows);

  container.append(
    el('div', { class: 'page-header' }, [
      el('div', { style: 'display:flex;align-items:center;gap:14px;' }, [
        playerAvatar(member, { style: 'width:52px;height:52px;font-size:16px;' }),
        el('div', {}, [
          el('div', { class: 'page-title' }, member.gamertag),
          el('div', { class: 'page-subtitle' }, [
            `${member.name} · ${team.name} · `,
            roleBadge(member.role),
          ]),
        ]),
      ]),
      el('button', {
        class: 'btn',
        onclick: () => openMemberModal(ctx, teamId, member, {
          onSaved: () => ctx.navigate('member', `${teamId}/${memberId}`),
        }),
      }, 'Edit Player'),
    ])
  );

  container.append(
    el('div', { class: 'grid cols-4 section' }, [
      statCard('K/D', totals.kd),
      statCard('Avg Kills', rows.length ? round1(totals.kills / rows.length) : 0),
      statCard('Avg Damage', rows.length ? Math.round(totals.damage / rows.length) : 0),
      statCard('Matches', totals.matches),
    ])
  );

  const trendKd = rows.map((r) => (r.player.deaths ? r.player.kills / r.player.deaths : r.player.kills));
  const trendCard = el('div', { class: 'card section' }, [
    el('div', { class: 'section-title' }, 'K/D Trend'),
    el('div', { html: sparkline(trendKd.length ? trendKd : [0]) , style: 'margin-top:4px;'}),
  ]);
  container.append(trendCard);

  if (member.aliases && member.aliases.length) {
    container.append(
      el('div', { class: 'card section' }, [
        el('div', { class: 'section-title' }, 'OCR Aliases'),
        el('div', { class: 'field-hint' }, 'Used to match OCR misreads of this gamertag back to this player.'),
        el(
          'div',
          { style: 'margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;' },
          member.aliases.map((a) => el('span', { class: 'role-badge' }, a))
        ),
      ])
    );
  }

  const historyCard = el('div', { class: 'card section' }, [
    el('div', { class: 'section-title' }, 'Match History'),
    rows.length
      ? el('table', {}, [
          el('thead', {}, [
            el('tr', {}, [
              el('th', {}, 'Date'),
              el('th', {}, 'Mode / Map'),
              el('th', {}, 'K'),
              el('th', {}, 'D'),
              el('th', {}, 'A'),
              el('th', {}, 'DMG'),
              el('th', {}, 'K/D'),
              el('th', {}, 'Result'),
            ]),
          ]),
          el(
            'tbody',
            {},
            [...rows]
              .reverse()
              .map(({ match, player }) =>
                el('tr', {}, [
                  el('td', {}, fmtDate(match.date)),
                  el('td', {}, `${match.mode} · ${match.map}`),
                  el('td', {}, player.kills),
                  el('td', {}, player.deaths),
                  el('td', {}, player.assists),
                  el('td', {}, player.damage),
                  el('td', {}, player.kd ?? (player.deaths ? round1(player.kills / player.deaths) : player.kills)),
                  el('td', {}, el('span', { class: `pill ${match.result === 'Win' ? 'win' : 'loss'}` }, match.result)),
                ])
              )
          ),
        ])
      : el('div', { class: 'field-hint' }, 'No matches recorded for this player yet.'),
  ]);
  container.append(historyCard);
}

function round1(n) {
  return Math.round(n * 100) / 100;
}

function statCard(label, value) {
  return el('div', { class: 'card stat-card' }, [
    el('div', { class: 'stat-label' }, label),
    el('div', { class: 'stat-value' }, String(value)),
  ]);
}
