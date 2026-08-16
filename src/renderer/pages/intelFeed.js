import { el, statsForMember, aggregate, statsByKey } from '../utils.js';
import { shareButton } from '../components/discordShare.js';

const TREND_WINDOW = 3;
const TREND_THRESHOLD = 10; // % change vs season avg worth flagging
const SAMPLE_MIN = 3; // matches needed before a map/mode signal counts

export function buildSignals(members, matches, meta) {
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
        tip: findTip(meta, mode),
      });
    }
  }

  // Map signal: strongest map by win rate
  const mapStats = statsByKey(matches, (m) => m.map).filter((s) => s.total >= 2);
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

  // Roster insight: best combined K/D pair
  const ranked = members
    .map((m) => ({ member: m, kd: aggregate(statsForMember(matches, m.id)).kd }))
    .filter((r) => r.kd > 0)
    .sort((a, b) => b.kd - a.kd);
  if (ranked.length >= 2) {
    signals.push({
      tone: 'insight',
      glyph: '◆',
      title: 'Roster Insight',
      body: `${ranked[0].member.gamertag} + ${ranked[1].member.gamertag} currently produce the roster's strongest combined K/D.`,
      weight: 4,
    });
  }

  return signals.sort((a, b) => b.weight - a.weight);
}

function findTip(meta, mode) {
  if (!meta?.general_pro_principles) return null;
  const match = meta.general_pro_principles.find((p) => p.toLowerCase().startsWith(mode.toLowerCase()));
  return match || meta.general_pro_principles.find((p) => p.toLowerCase().includes(mode.toLowerCase()));
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
        el('div', { class: 'page-subtitle' }, 'System-detected performance, map, and roster signals — cross-referenced against the current competitive meta'),
      ]),
    ])
  );

  const allTeams = await window.cci.getTeams();
  const teamScoped = allTeams.find((t) => t.id === ctx.param);
  const teams = teamScoped ? [teamScoped] : allTeams;
  const meta = await window.cci.getMetaKnowledge();
  let allSignals = [];
  for (const team of teams) {
    const [members, matches] = await Promise.all([window.cci.getMembers(team.id), window.cci.getMatches(team.id)]);
    const signals = buildSignals(members, matches, meta).map((s) => ({ ...s, team }));
    allSignals = allSignals.concat(signals);
  }
  allSignals.sort((a, b) => b.weight - a.weight);

  if (!allSignals.length) {
    container.append(
      el('div', { class: 'card empty-state section' }, [
        el('div', { class: 'icon' }, '◆'),
        el('div', { class: 'title' }, 'No signals yet' ),
        el('div', {}, 'Log a few more matches and Intel Feed will start surfacing trends automatically.'),
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
                s.tip ? el('div', { class: 'tip-card', style: 'margin-top:8px;' }, [el('b', {}, `${s.mode} tip: `), s.tip]) : null,
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

  if (meta) {
    container.append(
      el('div', { class: 'section' }, [
        el('div', { class: 'section-title' }, 'Current Meta Reference'),
        el('div', { class: 'grid cols-3' }, [
          metaCard('Hardpoint Primaries', meta.current_meta_weapons?.hardpoint_primary),
          metaCard('S&D Primaries', meta.current_meta_weapons?.snd_primary),
          metaCard('Sniper', meta.current_meta_weapons?.sniper),
        ]),
      ])
    );
    container.append(
      el('div', { class: 'card section' }, [
        el('div', { class: 'section-title' }, 'General Principles'),
        el(
          'div',
          { style: 'display:flex;flex-direction:column;gap:8px;' },
          (meta.general_pro_principles || []).map((p) => el('div', { class: 'tip-card' }, p))
        ),
      ])
    );
  }
}

function metaCard(label, items) {
  return el('div', { class: 'card' }, [
    el('div', { class: 'stat-label' }, label),
    el(
      'div',
      { style: 'margin-top:8px;display:flex;flex-direction:column;gap:5px;' },
      (items || []).map((i) => el('div', { style: 'font-size:12px;' }, i))
    ),
  ]);
}
