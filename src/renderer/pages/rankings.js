import { el, icon, fmtStamp } from '../utils.js';
import { iconBtn } from './teamHub/parts.js';
import { pageHeader, emptyState, openForm, confirmModal, toast } from './planningShared.js';
import { sortStandings, winPct, formFromMatches } from '../lib/standings.js';

export async function render(container, ctx) {
  const reload = () => {
    container.innerHTML = '';
    return render(container, ctx);
  };
  const [rankings, teams] = await Promise.all([window.cci.getRankings(), window.cci.getTeams()]);

  const ownNames = new Set(teams.map((t) => (t.name || '').toLowerCase()));

  container.append(
    pageHeader(
      'Rankings',
      'League and regional standings alongside your own form',
      el('div', { style: 'display:flex;gap:8px;' }, [
        el('button', { class: 'btn sm', onclick: () => editRegion(rankings, reload) }, 'Region'),
        el('button', { class: 'btn primary', onclick: () => teamForm(rankings, reload) }, [
          el('span', { class: 'icon', style: 'display:inline-flex;vertical-align:-2px;margin-right:6px;', html: icon('plus', 13) }),
          'Add Team',
        ]),
      ])
    )
  );

  // ----- Your form -----
  if (teams.length) {
    const formWrap = el('div', { class: 'grid cols-3', style: 'margin-bottom:22px;' });
    for (const team of teams) {
      const matches = await window.cci.getMatches(team.id);
      const form = formFromMatches(matches, 10);
      formWrap.append(
        el('div', { class: 'card' }, [
          el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:8px;' }, [
            el('div', { style: 'font-weight:700;font-size:13.5px;' }, team.name),
            el('span', { class: 'pill win', style: form.winRate < 50 ? 'background:#ff5c5c22;color:var(--loss);' : null }, `${form.winRate}%`),
          ]),
          el('div', { class: 'field-hint', style: 'margin-top:2px;' }, `${form.wins}-${form.losses} last ${form.results.length || 0}`),
          form.results.length
            ? el('div', { class: 'form-strip' }, form.results.slice().reverse().map((r) => el('div', { class: `form-cell ${r === 'W' ? 'win' : 'loss'}` }, r)))
            : el('div', { class: 'field-hint', style: 'margin-top:8px;' }, 'No matches logged yet.'),
        ])
      );
    }
    container.append(el('div', { class: 'section-title' }, 'Your Form'));
    container.append(formWrap);
  }

  // ----- Standings -----
  container.append(
    el('div', { class: 'section-title' }, [
      el('span', {}, rankings.region ? `Standings — ${rankings.region}` : 'Standings'),
      rankings.updated_at ? el('span', { class: 'card-meta', style: 'font-weight:600;' }, `Updated ${fmtStamp(rankings.updated_at)}`) : null,
    ])
  );

  const standings = sortStandings(rankings.teams || []);
  if (!standings.length) {
    container.append(
      emptyState(
        'No standings entered',
        'Rankings are yours to maintain — add the teams in your league or region with their records and points to track the table.',
        el('button', { class: 'btn primary', onclick: () => teamForm(rankings, reload) }, 'Add the first team')
      )
    );
    return;
  }

  const table = el('table', {}, [
    el('thead', {}, el('tr', {}, [
      el('th', { style: 'width:38px;' }, '#'),
      el('th', {}, 'Team'),
      el('th', {}, 'W-L'),
      el('th', {}, 'Win %'),
      el('th', {}, 'Points'),
      el('th', {}, 'Note'),
      el('th', { style: 'width:70px;' }, ''),
    ])),
    el(
      'tbody',
      {},
      standings.map((team, i) => {
        const mine = ownNames.has((team.name || '').toLowerCase());
        return el('tr', { style: mine ? 'background:var(--accent-dim);' : null }, [
          el('td', { style: 'font-family:var(--font-mono);color:var(--text-faint);' }, String(i + 1)),
          el('td', { style: 'font-weight:700;' }, [team.name, mine ? el('span', { class: 'role-badge', style: 'margin-left:8px;' }, 'You') : null]),
          el('td', { class: 'num' }, `${team.wins || 0}-${team.losses || 0}`),
          el('td', { class: 'num' }, `${winPct(team)}%`),
          el('td', { class: 'num', style: 'font-weight:700;' }, String(team.points || 0)),
          el('td', { class: 'field-hint', style: 'color:var(--text-dim);' }, team.note || '—'),
          el('td', {}, el('div', { class: 'row-actions' }, [
            iconBtn('edit', 'Edit team', () => teamForm(rankings, reload, team)),
            iconBtn('trash', 'Remove team', () =>
              confirmModal({
                title: 'Remove team?',
                body: `${team.name} will be removed from the standings.`,
                onConfirm: async () => {
                  const next = (rankings.teams || []).filter((t) => t.id !== team.id);
                  await window.cci.saveRankings({ ...rankings, teams: next });
                  reload();
                },
              })
            ),
          ])),
        ]);
      })
    ),
  ]);
  container.append(el('div', { class: 'card' }, table));
}

function editRegion(rankings, reload) {
  openForm({
    title: 'League / Region',
    fields: [{ key: 'region', label: 'Label', placeholder: 'e.g. CDL Major III · NA' }],
    values: { region: rankings.region || '' },
    onSubmit: async (values) => {
      await window.cci.saveRankings({ ...rankings, region: values.region });
      toast('Region updated', 'ok');
      reload();
    },
  });
}

function teamForm(rankings, reload, team = null) {
  openForm({
    title: team ? 'Edit Team' : 'Add Team',
    fields: [
      { key: 'name', label: 'Team Name', required: true, placeholder: 'Team in the standings' },
      [
        { key: 'wins', label: 'Wins', type: 'number', placeholder: '0' },
        { key: 'losses', label: 'Losses', type: 'number', placeholder: '0' },
      ],
      [
        { key: 'points', label: 'Points', type: 'number', placeholder: '0' },
        { key: 'note', label: 'Note', placeholder: 'Streak, seed…' },
      ],
    ],
    values: team || { wins: 0, losses: 0, points: 0 },
    onSubmit: async (values) => {
      const teams = (rankings.teams || []).slice();
      if (team) {
        const idx = teams.findIndex((t) => t.id === team.id);
        if (idx >= 0) teams[idx] = { ...team, ...values };
      } else {
        teams.push(values);
      }
      await window.cci.saveRankings({ ...rankings, teams });
      toast(team ? 'Team updated' : 'Team added', 'ok');
      reload();
    },
  });
}
