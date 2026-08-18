import { el, icon, fmtDate, fmtStamp, statsByKey } from '../../utils.js';
import { miniEmpty, statusPill } from './parts.js';

// The context panel answers "what is next and what should I look at", so it
// stays the same across sections rather than re-theming per screen.
export async function renderContextPanel(panel, hub) {
  panel.innerHTML = '';
  let matches = [];
  let strats = [];
  let review = [];
  try {
    [matches, strats, review] = await Promise.all([
      window.cci.getMatches(hub.team.id),
      window.cci.getStrats(hub.team.id),
      window.cci.getNeedsReview(hub.team.id),
    ]);
  } catch (err) {
    console.error('[team-hub] context panel failed', err);
    panel.append(block('Context', [el('div', { class: 'field-hint' }, 'Could not load team context.')]));
    return;
  }

  panel.append(nextMatch(hub, matches));
  panel.append(opponentIntel(hub, matches));
  panel.append(attention(hub, review, strats));
}

function block(title, children, action = null) {
  return el('div', { class: 'ctx-card' }, [
    el('div', { class: 'ctx-title' }, [el('span', {}, title), action]),
    ...children,
  ]);
}

// Matches are logged after they happen, so there is no scheduled fixture to
// show. Say so instead of inventing an opponent.
function nextMatch(hub, matches) {
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = matches
    .filter((m) => m.date > today && !m.result)
    .sort((a, b) => (a.date > b.date ? 1 : -1))[0];

  if (!upcoming) {
    return block('Upcoming Match', [
      miniEmpty('No match scheduled', 'Fixtures are not tracked yet, so nothing is shown here.'),
    ]);
  }

  return block('Upcoming Match', [
    el('div', { class: 'ctx-match' }, [
      el('div', { class: 'ctx-opponent' }, upcoming.opponent || 'Unknown opponent'),
      el('div', { class: 'ctx-when' }, fmtDate(upcoming.date)),
      upcoming.map ? el('div', { class: 'field-hint' }, `${upcoming.map} · ${upcoming.mode || ''}`) : null,
    ]),
  ]);
}

function opponentIntel(hub, matches) {
  const byOpponent = statsByKey(matches, (m) => m.opponent || 'Unknown');
  if (!byOpponent.length) {
    return block('Opponent Intel', [
      miniEmpty('No head-to-head data', 'Log matches and your record against each opponent appears here.'),
    ]);
  }

  const rows = byOpponent.slice(0, 5).map((row) =>
    el('div', { class: 'ctx-row' }, [
      el('div', { class: 'ctx-row-name' }, row.key),
      el('div', { class: `ctx-row-val ${row.winRate >= 50 ? 'win' : 'loss'}` }, `${row.wins}-${row.losses}`),
    ])
  );

  return block(
    'Opponent Intel',
    rows,
    el('button', { class: 'btn subtle sm', onclick: () => hub.navigate('scouting') }, 'Scout')
  );
}

function attention(hub, review, strats) {
  const drafts = strats.filter((s) => String(s.status || '').toUpperCase() === 'DRAFT');
  const items = [];

  if (review.length) {
    items.push(
      el(
        'button',
        { class: 'ctx-alert', onclick: () => hub.navigate('needs-review') },
        [
          el('span', { class: 'icon', html: icon('review', 13) }),
          el('span', {}, `${review.length} item${review.length === 1 ? '' : 's'} need review`),
        ]
      )
    );
  }

  for (const strat of drafts.slice(0, 4)) {
    items.push(
      el('button', { class: 'ctx-row link', onclick: () => hub.openPlaybooks('edit', strat.strategy_id) }, [
        el('div', { class: 'ctx-row-name' }, strat.strategy_name),
        statusPill(strat.status),
      ])
    );
  }

  if (!items.length) {
    items.push(miniEmpty('All clear', 'No drafts or unreviewed data for this team.'));
  }

  const latest = strats[0];
  if (latest) {
    items.push(el('div', { class: 'ctx-foot' }, `Last strat update ${fmtStamp(latest.updated_at)}`));
  }

  return block('Needs Attention', items);
}
