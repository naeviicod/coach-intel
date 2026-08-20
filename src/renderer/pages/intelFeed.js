import { el, statsForMember, aggregate, statsByKey } from '../utils.js';
import { shareButton } from '../components/discordShare.js';

const TREND_WINDOW = 3;
const TREND_THRESHOLD = 10; // % change vs season avg worth flagging
const SAMPLE_MIN = 3; // matches needed before a map/mode signal counts

export function buildSignals(members, matches) {
  const signals = [];

  // Performance signals: per member, per mode, recent vs season K/D
  for (const member of members) {
    const rows = statsForMember(matches, member.id).sort((a, b) => (a.match.date < b.match.date ? -1 : 1));
    const byMode = groupBy(rows, (r) => r.match.mode);
    for (const [mode, modeRows] of Object.entries(byMode)) {
      if (modeRows.length < SAMPLE_MIN) continue;
      const overall = aggregate(modeRows);
      const recent = aggregate(modeRows.slice(-TREND_WINDOW));
      if (!overall.kd) continue;
      const delta = Math.round(((recent.kd - overall.kd) / overall.kd) * 1000) / 10;
      if (Math.abs(delta) < TREND_THRESHOLD) continue;
      const up = delta > 0;
      signals.push({
        tone: up ? 'positive' : 'risk',
        glyph: up ? '▲' : '▼',
        title: 'Performance Signal',
        body: `${member.gamertag}'s ${mode} K/D has ${up ? 'increased' : 'dropped'} ${Math.abs(delta)}% over the last ${Math.min(TREND_WINDOW, modeRows.length)} matches.`,
        weight: Math.abs(delta),
        member,
        mode,
      });
    }
  }

  // Map signal: strongest map by win rate
  const mapStats = statsByKey(matches, (m) => m.map).filter((s) => s.total >= SAMPLE_MIN);
  if (mapStats.length) {
    const strongest = [...mapStats].sort((a, b) => b.winRate - a.winRate)[0];
    signals.push({
      tone: 'positive',
      glyph: '■',
      title: 'Map Signal',
      body: `${strongest.key} is the roster's strongest map — ${strongest.winRate}% win rate over ${strongest.total} matches.`,
      weight: 5,
    });
    const weakest = [...mapStats].sort((a, b) => a.winRate - b.winRate)[0];
    if (weakest.winRate < 50 && weakest.key !== strongest.key) {
      signals.push({
        tone: 'risk',
        glyph: '▼',
        title: 'Risk Alert',
        body: `${weakest.key} win rate is ${weakest.winRate}% over ${weakest.total} matches — the roster's weakest map right now.`,
        weight: 100 - weakest.winRate,
      });
    }
  }

  // Roster insight: best combined K/D pair — same SAMPLE_MIN as every other
  // signal, so a hot streak over one or two matches can't surface here either.
  const ranked = members
    .map((m) => {
      const rows = statsForMember(matches, m.id);
      return { member: m, kd: aggregate(rows).kd, matches: rows.length };
    })
    .filter((r) => r.kd > 0 && r.matches >= SAMPLE_MIN)
    .sort((a, b) => b.kd - a.kd);
  if (ranked.length >= 2) {
    const sample = Math.min(ranked[0].matches, ranked[1].matches);
    signals.push({
      tone: 'insight',
      glyph: '◆',
      title: 'Roster Insight',
      body: `${ranked[0].member.gamertag} + ${ranked[1].member.gamertag} currently produce the roster's strongest combined K/D, over at least ${sample} matches each.`,
      weight: 4,
    });
  }

  return signals.sort((a, b) => b.weight - a.weight);
}

const SCRIM_SAMPLE_MIN = 3;
const SCRIM_LOSS_THRESHOLD = 60; // % loss rate worth flagging as a recurring pattern

// Recurring scrim losses on a map, cross-referenced against the tags a coach
// attached to those losses (e.g. "bad break", "slow rotate") — surfaces a
// pattern only when both the sample size and the loss rate clear a real bar,
// same discipline as buildSignals above. Kept separate from match-based
// signals since scrim results are a different, private dataset.
export function buildScrimSignals(scrims) {
  const signals = [];
  const completed = (scrims || []).filter((s) => s.status === 'completed');
  const mapRows = completed.flatMap((s) => (s.maps || []).filter((m) => m.result).map((m) => ({ ...m, opponent: s.opponent })));
  const byMapMode = groupBy(mapRows, (m) => `${m.map || 'Unknown'}::${m.mode || 'Unknown'}`);

  for (const [key, rows] of Object.entries(byMapMode)) {
    if (rows.length < SCRIM_SAMPLE_MIN) continue;
    const losses = rows.filter((r) => r.result === 'Loss');
    const lossRate = Math.round((losses.length / rows.length) * 100);
    if (lossRate < SCRIM_LOSS_THRESHOLD) continue;
    const [map, mode] = key.split('::');

    const tagCounts = {};
    for (const l of losses) for (const tag of l.tags || []) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    const topTag = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0];

    signals.push({
      tone: 'risk',
      glyph: '▼',
      title: 'Scrim Pattern',
      body:
        topTag && topTag[1] >= 2
          ? `${map} ${mode} losses in scrims keep coming back to "${topTag[0]}" — ${topTag[1]} of ${losses.length} losses tagged that way, over ${rows.length} scrim maps.`
          : `${map} ${mode} is a recurring scrim loss — ${losses.length} of ${rows.length} scrim maps lost.`,
      weight: lossRate,
      mode,
    });
  }
  return signals.sort((a, b) => b.weight - a.weight);
}

function groupBy(arr, fn) {
  return arr.reduce((acc, item) => {
    const key = fn(item);
    (acc[key] = acc[key] || []).push(item);
    return acc;
  }, {});
}

export async function render(container, ctx) {
  container.append(
    el('div', { class: 'page-header' }, [
      el('div', {}, [
        el('div', { class: 'page-title' }, 'Intel Feed'),
        el('div', { class: 'page-subtitle' }, 'Performance, map, and roster signals from your matches and scrims'),
      ]),
    ])
  );

  const allTeams = await window.cci.getTeams();
  const teamScoped = allTeams.find((t) => t.id === ctx.param);
  const teams = teamScoped ? [teamScoped] : allTeams;
  let allSignals = [];
  for (const team of teams) {
    const [members, matches, scrims] = await Promise.all([
      window.cci.getMembers(team.id),
      window.cci.getMatches(team.id),
      window.cci.getScrims(team.id),
    ]);
    const signals = [...buildSignals(members, matches), ...buildScrimSignals(scrims)].map((s) => ({ ...s, team }));
    allSignals = allSignals.concat(signals);
  }
  allSignals.sort((a, b) => b.weight - a.weight);

  if (!allSignals.length) {
    container.append(
      el('div', { class: 'card empty-state section' }, [
        el('div', { class: 'icon' }, '◆'),
        el('div', { class: 'title' }, 'No signals yet' ),
        el('div', {}, 'Once teams have enough matches and scrims on the books, trends show up here automatically.'),
      ])
    );
  } else {
    container.append(
      el(
        'div',
        { class: 'section', style: 'display:flex;flex-direction:column;gap:10px;' },
        allSignals.map((s) =>
          el('div', { class: 'card' }, [
            el('div', { class: 'intel-signal' }, [
              el('span', { class: `intel-signal-icon ${s.tone}` }, s.glyph),
              el('div', { style: 'flex:1;' }, [
                el('div', { class: 'intel-signal-title' }, [s.title, teams.length > 1 ? el('span', { class: 'field-hint' }, `  ·  ${s.team.name}`) : null]),
                el('div', { class: 'intel-signal-body' }, s.body),
              ]),
              shareButton(() => ({
                kind: 'Intel',
                title: s.title,
                subtitle: s.mode || null,
                summary: s.body,
                team: s.team,
                route: `intel-feed/${s.team.id}`,
                defaultPurpose: 'general',
              }), { label: 'Share' }),
            ]),
          ])
        )
      )
    );
  }

}
