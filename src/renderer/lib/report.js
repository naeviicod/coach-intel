// Report builders — pure, DOM-free. Produce a structured report (rendered as
// cards + tables by the page) alongside a Markdown string (used for copy/export).

import { round, kd, statsByKey, aggregate, statsForMember, teamWinRate, teamKD, teamAvgDamage } from '../utils.js';

function record(matches) {
  const wins = matches.filter((m) => m.result === 'Win').length;
  return { wins, losses: matches.length - wins };
}

function modeRows(matches) {
  return statsByKey(matches, (m) => m.mode || 'Unknown').map((s) => [
    s.key,
    String(s.total),
    `${s.wins}-${s.losses}`,
    `${s.winRate}%`,
  ]);
}

function mapRows(matches) {
  return statsByKey(matches, (m) => m.map || 'Unknown').map((s) => [
    s.key,
    String(s.total),
    `${s.wins}-${s.losses}`,
    `${s.winRate}%`,
  ]);
}

function playerRows(matches, members) {
  return members
    .map((member) => {
      const rows = statsForMember(matches, member.id);
      const agg = aggregate(rows);
      return {
        gamertag: member.gamertag,
        agg,
        row: [
          member.gamertag,
          String(agg.matches),
          String(agg.kd),
          String(agg.kills),
          String(agg.deaths),
          String(agg.matches ? Math.round(agg.damage / agg.matches) : 0),
          `${agg.winRate}%`,
        ],
      };
    })
    .filter((p) => p.agg.matches > 0)
    .sort((a, b) => b.agg.kd - a.agg.kd)
    .map((p) => p.row);
}

function recentRows(matches, limit = 10) {
  return [...matches]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, limit)
    .map((m) => [m.date, m.opponent || '—', m.mode || '—', m.map || '—', m.score || '—', m.result || '—']);
}

/**
 * Full performance report for one team over the supplied matches.
 * @returns structured report with a `.markdown` string.
 */
export function buildTeamReport({ team, matches = [], members = [], scrims = [] }) {
  const rec = record(matches);
  const kpis = [
    { label: 'Record', value: `${rec.wins}-${rec.losses}`, sub: `${matches.length} matches` },
    { label: 'Win Rate', value: `${teamWinRate(matches)}%`, sub: 'Across logged matches' },
    { label: 'Team K/D', value: String(teamKD(matches)), sub: 'All players' },
    { label: 'Avg Damage', value: String(teamAvgDamage(matches)), sub: 'Per player / match' },
  ];

  const sections = [
    { heading: 'By Mode', columns: ['Mode', 'Played', 'W-L', 'Win %'], rows: modeRows(matches) },
    { heading: 'By Map', columns: ['Map', 'Played', 'W-L', 'Win %'], rows: mapRows(matches) },
    {
      heading: 'Players',
      columns: ['Player', 'Matches', 'K/D', 'Kills', 'Deaths', 'Avg DMG', 'Win %'],
      rows: playerRows(matches, members),
    },
    {
      heading: 'Recent Matches',
      columns: ['Date', 'Opponent', 'Mode', 'Map', 'Score', 'Result'],
      rows: recentRows(matches),
    },
  ];

  if (scrims.length) {
    const completed = scrims.filter((s) => s.status === 'completed');
    sections.push({
      heading: 'Recent Scrims',
      columns: ['Date', 'Opponent', 'Format', 'Status'],
      rows: [...scrims].slice(0, 10).map((s) => [s.date, s.opponent, s.format, s.status]),
      note: `${completed.length} completed of ${scrims.length} booked`,
    });
  }

  const report = {
    title: `${team?.name || 'Team'} — Performance Report`,
    subtitle: `${rec.wins}-${rec.losses} record · ${teamWinRate(matches)}% win rate`,
    generatedAt: new Date().toISOString(),
    kpis,
    sections,
  };
  report.markdown = toMarkdown(report);
  return report;
}

/**
 * Head-to-head + scouting breakdown for a single opponent.
 */
export function buildOpponentReport({ opponent, matches = [] }) {
  const h2h = matches.filter((m) => (m.opponent || '').toLowerCase() === (opponent?.name || '').toLowerCase());
  const rec = record(h2h);
  const kpis = [
    { label: 'Head-to-Head', value: `${rec.wins}-${rec.losses}`, sub: `${h2h.length} matches` },
    { label: 'Win Rate', value: `${teamWinRate(h2h)}%`, sub: 'Your results vs them' },
    { label: 'Roster', value: String((opponent?.players || []).length), sub: 'Scouted players' },
    { label: 'Map Notes', value: String((opponent?.map_notes || []).length), sub: 'Recorded' },
  ];

  const sections = [];
  if ((opponent?.players || []).length) {
    sections.push({
      heading: 'Roster',
      columns: ['Player', 'Role', 'Note'],
      rows: opponent.players.map((p) => [p.gamertag, p.role, p.note || '—']),
    });
  }
  if ((opponent?.map_notes || []).length) {
    sections.push({
      heading: 'Map & Mode Notes',
      columns: ['Map', 'Mode', 'Threat', 'Note'],
      rows: opponent.map_notes.map((m) => [m.map, m.mode, m.threat, m.note || '—']),
    });
  }
  if (h2h.length) {
    sections.push({
      heading: 'Head-to-Head Matches',
      columns: ['Date', 'Mode', 'Map', 'Score', 'Result'],
      rows: recentRows(h2h).map((r) => [r[0], r[2], r[3], r[4], r[5]]),
    });
  }
  if (opponent?.tendencies) sections.push({ heading: 'Tendencies', columns: ['Notes'], rows: [[opponent.tendencies]] });

  const report = {
    title: `Scout Report — ${opponent?.name || 'Opponent'}`,
    subtitle: `${rec.wins}-${rec.losses} head-to-head · ${teamWinRate(h2h)}% win rate`,
    generatedAt: new Date().toISOString(),
    kpis,
    sections,
  };
  report.markdown = toMarkdown(report);
  return report;
}

// ---------- Markdown ----------

function mdTable(columns, rows) {
  if (!rows.length) return '_No data._\n';
  const head = `| ${columns.join(' | ')} |`;
  const sep = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${r.map((c) => String(c).replace(/\|/g, '\\|')).join(' | ')} |`).join('\n');
  return `${head}\n${sep}\n${body}\n`;
}

export function toMarkdown(report) {
  const lines = [`# ${report.title}`, '', `_${report.subtitle}_`, '', `Generated ${report.generatedAt.slice(0, 10)}`, ''];
  if (report.kpis?.length) {
    lines.push('## Summary', '');
    for (const kpi of report.kpis) lines.push(`- **${kpi.label}:** ${kpi.value}${kpi.sub ? ` (${kpi.sub})` : ''}`);
    lines.push('');
  }
  for (const section of report.sections || []) {
    lines.push(`## ${section.heading}`, '');
    if (section.note) lines.push(`_${section.note}_`, '');
    lines.push(mdTable(section.columns, section.rows));
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
