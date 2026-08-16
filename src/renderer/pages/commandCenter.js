import {
  el, icon, playerAvatar, roleBadge, teamWinRate, teamKD, teamAvgDamage, pctDelta, statsByKey, statsForMember, aggregate,
  OBJ_STATS, objModesInMatches, teamObjTotal, fmtObj,
} from '../utils.js';
import { buildSignals } from './intelFeed.js';
import * as matchLog from './matchLog.js';
import * as insights from './insights.js';
import * as mapsModes from './mapsModes.js';
import * as intelFeed from './intelFeed.js';
import * as teachCCIntel from './teachCCIntel.js';
import * as strategyBoard from './strategyBoard.js';

const RECENT_WINDOW = 3;

const TABS = [
  { key: 'overview', label: 'Overview', icon: 'commandCenter' },
  { key: 'roster', label: 'Roster', icon: 'roster' },
  { key: 'strats', label: 'Strats', icon: 'strats' },
  { key: 'matches', label: 'Matches', icon: 'matches' },
  { key: 'performance', label: 'Performance', icon: 'performance' },
  { key: 'maps-modes', label: 'Maps & Modes', icon: 'mapsModes' },
  { key: 'intel', label: 'Intel Feed', icon: 'intel' },
  { key: 'teach', label: 'Teach Coach Intel', icon: 'teach' },
];

export async function render(container, ctx) {
  const teams = await window.cci.getTeams();
  if (!teams.length) {
    container.append(el('div', { class: 'card empty-state' }, 'No teams yet.'));
    return;
  }
  const [teamIdParam, tabParam] = (ctx.param || '').split('/');
  const activeTeam = teams.find((t) => t.id === teamIdParam) || teams[0];
  const tab = TABS.some((t) => t.key === tabParam) ? tabParam : 'overview';

  const header = el('div', { class: 'page-header' }, [
    el('div', {}, [
      el('div', { class: 'page-title' }, activeTeam.name),
      el('div', { class: 'page-subtitle' }, 'Team workspace'),
    ]),
    el('div', { style: 'display:flex;align-items:center;gap:10px;' }, [
      teams.length > 1 ? teamSwitcher(teams, activeTeam, tab, ctx) : null,
      el('div', { class: 'live-pill' }, [el('span', { class: 'live-dot' }), 'LIVE DATA']),
    ]),
  ]);
  container.append(header);

  container.append(
    el(
      'div',
      { class: 'tabbar' },
      TABS.map((t) =>
        el(
          'div',
          { class: `tab${tab === t.key ? ' active' : ''}`, onclick: () => ctx.navigate('command-center', `${activeTeam.id}/${t.key}`) },
          [el('span', { class: 'icon', html: icon(t.icon) }), t.label]
        )
      )
    )
  );

  const teamCtx = { ...ctx, param: activeTeam.id };
  if (tab === 'roster') return renderRosterTab(container, activeTeam, ctx);
  if (tab === 'strats') return strategyBoard.render(container, teamCtx);
  if (tab === 'matches') return matchLog.render(container, teamCtx);
  if (tab === 'performance') return insights.render(container, teamCtx);
  if (tab === 'maps-modes') return mapsModes.render(container, teamCtx);
  if (tab === 'intel') return intelFeed.render(container, teamCtx);
  if (tab === 'teach') return teachCCIntel.render(container);
  return renderOverview(container, activeTeam, ctx);
}

async function renderOverview(container, activeTeam, ctx) {
  const [members, matches, meta] = await Promise.all([
    window.cci.getMembers(activeTeam.id),
    window.cci.getMatches(activeTeam.id),
    window.cci.getMetaKnowledge(),
  ]);

  container.append(statRow(matches));

  const grid = el('div', { class: 'grid cols-2 section' });
  grid.append(recentFormCard(members, matches, ctx, activeTeam));
  grid.append(intelFeedMiniCard(members, matches, meta, activeTeam, ctx));
  container.append(grid);

  container.append(el('div', { class: 'section' }, [objectiveCard(members, matches, activeTeam, ctx)]));

  const grid2 = el('div', { class: 'grid cols-2 section' });
  grid2.append(mapStrengthCard(matches, activeTeam, ctx));
  grid2.append(nextMatchCard());
  container.append(grid2);
}

async function renderRosterTab(container, team, ctx) {
  const members = await window.cci.getMembers(team.id);
  const card = el('div', { class: 'card' }, [
    el('div', { class: 'section-title' }, [
      'Roster',
      el('button', { class: 'btn subtle', onclick: () => ctx.navigate('players') }, 'Edit on Players →'),
    ]),
  ]);
  if (!members.length) card.append(el('div', { class: 'field-hint' }, 'No players yet.'));
  for (const member of members) {
    card.append(
      el('div', { class: 'roster-row', style: 'cursor:pointer;', onclick: () => ctx.navigate('member', `${team.id}/${member.id}`) }, [
        playerAvatar(member),
        el('div', { style: 'flex:1;' }, [el('div', { class: 'gamertag' }, member.gamertag), el('div', { class: 'member-name' }, member.name)]),
        roleBadge(member.role),
      ])
    );
  }
  container.append(card);
}

function teamSwitcher(teams, activeTeam, tab, ctx) {
  return el(
    'select',
    { onchange: (e) => ctx.navigate('command-center', `${e.target.value}/${tab}`) },
    teams.map((t) => el('option', { value: t.id, selected: t.id === activeTeam.id ? 'selected' : null }, t.name))
  );
}

function statRow(matches) {
  const recent = matches.slice(0, RECENT_WINDOW);
  const kd = teamKD(matches);
  const kdDelta = pctDelta(teamKD(recent), kd);
  const hpWinRate = teamWinRate(matches.filter((m) => m.mode === 'Hardpoint'));
  const record = matches.reduce((acc, m) => (m.result === 'Win' ? { ...acc, w: acc.w + 1 } : { ...acc, l: acc.l + 1 }), { w: 0, l: 0 });
  const avgDamage = teamAvgDamage(matches);
  const dmgDelta = pctDelta(teamAvgDamage(recent), avgDamage);
  const last5 = matches.slice(0, 5).map((m) => (m.result === 'Win' ? 'W' : 'L'));

  return el('div', { class: 'grid cols-4 section' }, [
    bigStat('TEAM K/D', kd, kdDelta),
    bigStat('HP WIN %', `${hpWinRate}%`, null),
    bigStat('RECORD', `${record.w}–${record.l}`, null, `LAST 5  ${last5.join(' ')}`),
    bigStat('AVG DAMAGE', avgDamage, dmgDelta),
  ]);
}

function bigStat(label, value, delta, footNote) {
  const children = [el('div', { class: 'stat-label' }, label), el('div', { class: 'stat-value' }, String(value))];
  if (delta !== null && delta !== undefined) {
    children.push(el('div', { class: `stat-delta ${delta >= 0 ? 'up' : 'down'}` }, `${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta)}% vs season avg`));
  }
  if (footNote) children.push(el('div', { class: 'stat-delta', style: 'color:var(--text-faint);' }, footNote));
  return el('div', { class: 'card stat-card' }, children);
}

function recentFormCard(members, matches, ctx, team) {
  const rows = members
    .map((m) => ({ member: m, totals: aggregate(statsForMember(matches, m.id)) }))
    .filter((r) => r.totals.matches > 0)
    .sort((a, b) => b.totals.kd - a.totals.kd);
  const maxKd = Math.max(1, ...rows.map((r) => r.totals.kd));

  return el('div', { class: 'card' }, [
    el('div', { class: 'section-title' }, 'Recent Form'),
    el('div', { class: 'field-hint', style: 'margin-bottom:10px;' }, 'K/D — season'),
    ...(rows.length
      ? rows.map((r) =>
          el(
            'div',
            { style: 'display:flex;align-items:center;gap:10px;margin-bottom:10px;cursor:pointer;', onclick: () => ctx.navigate('member', `${team.id}/${r.member.id}`) },
            [
              playerAvatar(r.member, { style: 'width:26px;height:26px;font-size:10px;' }),
              el('div', { style: 'width:80px;font-size:11.5px;flex-shrink:0;' }, r.member.gamertag),
              el('div', { style: 'flex:1;background:#1c2027;border-radius:5px;height:8px;overflow:hidden;' }, [
                el('div', { style: `width:${Math.max(6, (r.totals.kd / maxKd) * 100)}%;background:var(--accent);height:100%;border-radius:5px;` }),
              ]),
              el('div', { style: 'width:36px;text-align:right;font-size:11.5px;font-weight:700;font-family:var(--font-mono);' }, r.totals.kd),
            ]
          )
        )
      : [el('div', { class: 'field-hint' }, 'No matches logged yet.')]),
  ]);
}

function objectiveCard(members, matches, team, ctx) {
  const card = el('div', { class: 'card' });
  const modes = objModesInMatches(matches);

  card.append(el('div', { class: 'section-title' }, 'Objective Play'));
  if (!modes.length) {
    card.append(el('div', { class: 'field-hint' }, 'No objective stats logged yet — hill time, plants, and drives show up here once matches are in.'));
    return card;
  }

  let activeMode = modes[0];
  const chips = el('div', { class: 'filter-bar' });
  const body = el('div', {});
  card.append(chips, body);

  function drawChips() {
    chips.innerHTML = '';
    for (const mode of modes) {
      chips.append(
        el(
          'div',
          {
            class: `mode-chip${mode === activeMode ? ' active' : ''}`,
            onclick: () => {
              activeMode = mode;
              drawChips();
              drawBody();
            },
          },
          mode
        )
      );
    }
  }

  function drawBody() {
    body.innerHTML = '';
    const modeMatches = matches.filter((m) => m.mode === activeMode);
    const stats = OBJ_STATS[activeMode];

    body.append(
      el(
        'div',
        { class: `grid cols-${Math.min(3, stats.length + 1)}`, style: 'margin-bottom:16px;' },
        [
          el('div', { class: 'card stat-card', style: 'padding:12px 14px;' }, [
            el('div', { class: 'stat-label' }, 'Matches'),
            el('div', { class: 'stat-value', style: 'font-size:19px;' }, String(modeMatches.length)),
          ]),
          ...stats.map((stat) => {
            const total = teamObjTotal(modeMatches, stat.key);
            return el('div', { class: 'card stat-card', style: 'padding:12px 14px;' }, [
              el('div', { class: 'stat-label' }, `Team ${stat.label}`),
              el('div', { class: 'stat-value', style: 'font-size:19px;' }, fmtObj(stat, total)),
              el('div', { class: 'stat-delta', style: 'color:var(--text-faint);' }, `${fmtObj(stat, total / (modeMatches.length || 1), { precise: true })} per match`),
            ]);
          }),
        ]
      )
    );

    for (const stat of stats) {
      const rows = members
        .map((m) => ({ member: m, value: aggregate(statsForMember(modeMatches, m.id)).obj[stat.key] }))
        .sort((a, b) => b.value - a.value);
      const max = Math.max(1, ...rows.map((r) => r.value));

      body.append(el('div', { class: 'field-hint', style: 'margin-bottom:8px;' }, `${stat.label} — by player`));
      for (const row of rows) {
        body.append(
          el(
            'div',
            { style: 'display:flex;align-items:center;gap:10px;margin-bottom:10px;cursor:pointer;', onclick: () => ctx.navigate('member', `${team.id}/${row.member.id}`) },
            [
              playerAvatar(row.member, { style: 'width:26px;height:26px;font-size:10px;' }),
              el('div', { style: 'width:80px;font-size:11.5px;flex-shrink:0;' }, row.member.gamertag),
              el('div', { style: 'flex:1;background:#1c2027;border-radius:5px;height:8px;overflow:hidden;' }, [
                el('div', { style: `width:${row.value ? Math.max(6, (row.value / max) * 100) : 0}%;background:var(--accent);height:100%;border-radius:5px;` }),
              ]),
              el('div', { style: 'width:48px;text-align:right;font-size:11.5px;font-weight:700;font-family:var(--font-mono);' }, fmtObj(stat, row.value)),
            ]
          )
        );
      }
    }
  }

  drawChips();
  drawBody();
  return card;
}

function intelFeedMiniCard(members, matches, meta, team, ctx) {
  const signals = buildSignals(members, matches, meta).slice(0, 4);
  return el('div', { class: 'card' }, [
    el('div', { class: 'section-title' }, [
      'Intel Feed',
      el('span', { class: 'btn subtle', onclick: () => ctx.navigate('command-center', `${team.id}/intel`) }, 'View all →'),
    ]),
    ...(signals.length
      ? signals.map((s) =>
          el('div', { class: 'intel-signal' }, [
            el('span', { class: `intel-signal-icon ${s.tone}` }, s.glyph),
            el('div', {}, [el('div', { class: 'intel-signal-title' }, s.title), el('div', { class: 'intel-signal-body' }, s.body)]),
          ])
        )
      : [el('div', { class: 'field-hint' }, 'No signals yet — log a few more matches.')]),
  ]);
}

function mapStrengthCard(matches, team, ctx) {
  const stats = statsByKey(matches, (m) => m.map).slice(0, 4);
  return el('div', { class: 'card' }, [
    el('div', { class: 'section-title' }, [
      'Map Strength',
      el('span', { class: 'btn subtle', onclick: () => ctx.navigate('command-center', `${team.id}/maps-modes`) }, 'View all maps →'),
    ]),
    stats.length
      ? el('div', { class: 'grid cols-4' }, stats.map((s) => el('div', { class: 'map-tile' }, [
          el('div', { class: 'map-tile-name' }, s.key),
          el('div', { class: 'map-tile-value' }, `${s.winRate}%`),
        ])))
      : el('div', { class: 'field-hint' }, 'No matches logged yet.'),
  ]);
}

function nextMatchCard() {
  return el('div', { class: 'card' }, [
    el('div', { class: 'section-title' }, 'Next Match'),
    el('div', { class: 'empty-state', style: 'padding:24px 10px;' }, [
      el('div', { class: 'icon' }, '📅'),
      el('div', { class: 'title' }, 'No upcoming match scheduled'),
      el('div', { class: 'field-hint' }, 'Match scheduling isn’t tracked yet.'),
    ]),
  ]);
}
