import { el, fmtDate, statsByKey } from '../../../utils.js';
import { hubHead, miniEmpty } from '../parts.js';

// Veto sequences are not recorded anywhere yet. Rather than invent a tree, this
// shows the closest honest signal: which maps this team has actually played.
export async function render(root, hub) {
  const matches = await window.cci.getMatches(hub.team.id);

  root.append(hubHead('Veto History', 'Map bans and picks are not tracked yet', [hub.ctxToggle]));

  root.append(
    el('div', { class: 'card', style: 'margin-bottom:14px;' }, [
      miniEmpty(
        'Veto sequences are not recorded',
        'Coach Intel does not capture bans and picks yet, so nothing is shown here. Logged matches below are the closest record of what actually got played.'
      ),
    ])
  );

  if (!matches.length) {
    root.append(
      el('div', { class: 'card' }, [miniEmpty('No matches logged', 'Log a match to start building map history.')])
    );
    return;
  }

  const byMap = statsByKey(matches, (m) => m.map || 'Unknown');
  const card = el('div', { class: 'card compact' }, [
    el('div', { class: 'card-head' }, [
      el('div', { class: 'card-title' }, 'Maps played'),
      el('div', { class: 'card-meta' }, `${matches.length} match${matches.length === 1 ? '' : 'es'}`),
    ]),
  ]);

  for (const row of byMap) {
    card.append(
      el('div', { class: 'crow' }, [
        el('div', { class: 'crow-main' }, [
          el('div', { class: 'crow-title' }, row.key),
          el('div', { class: 'crow-sub' }, [el('span', {}, `${row.wins}W - ${row.losses}L`)]),
        ]),
        el('div', { class: `crow-meta ${row.winRate >= 50 ? 'win' : 'loss'}` }, `${row.winRate}%`),
      ])
    );
  }
  root.append(card);

  const recent = [...matches].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8);
  const log = el('div', { class: 'card compact', style: 'margin-top:14px;' }, [
    el('div', { class: 'card-head' }, [el('div', { class: 'card-title' }, 'Recent matches')]),
  ]);
  for (const match of recent) {
    log.append(
      el(
        'div',
        {
          class: 'crow',
          role: 'button',
          tabindex: '0',
          onclick: () => hub.navigate('matches'),
          onkeydown: (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              hub.navigate('matches');
            }
          },
        },
        [
          el('div', { class: 'crow-main' }, [
            el('div', { class: 'crow-title' }, `${match.map || 'Unknown map'} · ${match.mode || 'Unknown mode'}`),
            el('div', { class: 'crow-sub' }, [el('span', {}, `vs ${match.opponent || 'Unknown'}`)]),
          ]),
          el('span', { class: `pill ${match.result === 'Win' ? 'win' : 'loss'}` }, match.result || '—'),
          el('div', { class: 'crow-meta' }, fmtDate(match.date)),
        ]
      )
    );
  }
  root.append(log);
}
