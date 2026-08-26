import { el, icon, fmtDate, teamWinRate, roleClass } from '../utils.js';
import { kpi, iconBtn } from './teamHub/parts.js';
import { pageHeader, emptyState, openForm, confirmModal, toast } from './planningShared.js';
import { intelForOpponent, summaryLines } from '../lib/vetoIntel.js';
import { shortMode } from '../lib/veto.js';

const ROLES = ['IGL', 'AR', 'SMG', 'Sniper', 'Flex', 'Main Sub', 'Main AR'];
const THREATS = [['high', 'High'], ['medium', 'Medium'], ['low', 'Low']];
// Matches planningStore.js's INTEL_CONFIDENCE — duplicated locally rather than
// fetched, since it's a fixed, tiny list (same pattern as ROLES/THREATS above).
const CONFIDENCE_OPTIONS = ['CONFIRMED', 'LIKELY', 'OLD DATA', 'UNVERIFIED'];
const CONFIDENCE_COLORS = { CONFIRMED: 'var(--win)', LIKELY: 'var(--accent)', 'OLD DATA': '#ffb870', UNVERIFIED: 'var(--loss)' };

function confidenceBadge(confidence) {
  const c = CONFIDENCE_OPTIONS.includes(confidence) ? confidence : 'UNVERIFIED';
  const color = CONFIDENCE_COLORS[c];
  return el(
    'span',
    {
      style: `font-size:9.5px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;padding:2px 6px;border-radius:5px;background:${color}22;color:${color};flex-shrink:0;white-space:nowrap;`,
    },
    c
  );
}

async function loadAllMatches() {
  const teams = await window.cci.getTeams();
  const packs = await Promise.all(teams.map((team) => window.cci.getMatches(team.id)));
  return packs.flat();
}

function headToHead(name, matches) {
  return matches.filter((m) => (m.opponent || '').toLowerCase() === (name || '').toLowerCase());
}

export async function render(container, ctx) {
  const [opponents, allMatches, ruleset] = await Promise.all([
    window.cci.getOpponents(),
    loadAllMatches(),
    window.cci.getCdlRuleset(),
  ]);

  const reload = () => {
    container.innerHTML = '';
    return render(container, ctx);
  };

  const current = ctx.param ? opponents.find((o) => o.opponent_id === ctx.param) : null;
  if (current) {
    await renderDetail(container, ctx, current, allMatches, ruleset, reload);
    return;
  }
  renderList(container, ctx, opponents, allMatches, reload);
}

function renderList(container, ctx, opponents, allMatches, reload) {
  container.append(
    pageHeader(
      'Scouting',
      'Opponent breakdowns and matchup prep',
      el('button', { class: 'btn primary', onclick: () => opponentForm(reload) }, [
        el('span', { class: 'icon', style: 'display:inline-flex;vertical-align:-2px;margin-right:6px;', html: icon('plus', 13) }),
        'Add Opponent',
      ])
    )
  );

  if (!opponents.length) {
    container.append(
      emptyState(
        'No opponents scouted yet',
        'Build a scouting profile for a team you expect to face — roster, map tendencies and head-to-head history in one place.',
        el('button', { class: 'btn primary', onclick: () => opponentForm(reload) }, 'Scout your first opponent')
      )
    );
    return;
  }

  const grid = el('div', { class: 'grid cols-3' });
  for (const opp of opponents) {
    const h2h = headToHead(opp.name, allMatches);
    const wins = h2h.filter((m) => m.result === 'Win').length;
    grid.append(
      el(
        'div',
        {
          class: 'card clickable',
          role: 'button',
          tabindex: '0',
          onclick: () => ctx.navigate('scouting', opp.opponent_id),
          onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ctx.navigate('scouting', opp.opponent_id); } },
        },
        [
          el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;' }, [
            el('div', { style: 'font-weight:700;font-size:14px;min-width:0;overflow:hidden;text-overflow:ellipsis;' }, opp.name),
            opp.tag ? el('span', { class: 'role-badge' }, opp.tag) : null,
          ]),
          el('div', { class: 'field-hint', style: 'margin-bottom:10px;' }, opp.region || 'Region unset'),
          el('div', { style: 'display:flex;gap:16px;' }, [
            miniStat(`${wins}-${h2h.length - wins}`, 'Head-to-head'),
            miniStat(String((opp.players || []).length), 'Roster'),
            miniStat(String((opp.veto_history || []).length), 'Vetoes'),
          ]),
        ]
      )
    );
  }
  container.append(grid);
}

function miniStat(value, label) {
  return el('div', {}, [
    el('div', { style: 'font-size:16px;font-weight:700;font-family:var(--font-mono);' }, value),
    el('div', { class: 'field-hint' }, label),
  ]);
}

async function renderDetail(container, ctx, opp, allMatches, ruleset, reload) {
  const mapNames = (ruleset?.maps || []).filter((m) => m.active !== false).map((m) => m.name);
  const modeNames = ruleset?.modes || ['Hardpoint', 'Search & Destroy', 'Overload'];
  const h2h = headToHead(opp.name, allMatches);
  const wins = h2h.filter((m) => m.result === 'Win').length;

  container.append(
    el('button', { class: 'btn sm subtle', style: 'margin-bottom:14px;', onclick: () => ctx.navigate('scouting') }, '‹ All opponents')
  );
  container.append(
    pageHeader(
      opp.name,
      [opp.tag, opp.region].filter(Boolean).join(' · ') || 'Scouting profile',
      el('div', { style: 'display:flex;gap:8px;' }, [
        el('button', { class: 'btn sm', onclick: () => ctx.navigate('reports', `opponent/${opp.opponent_id}`) }, 'Open Report'),
        el('button', { class: 'btn sm', onclick: () => opponentForm(reload, opp) }, 'Edit'),
        el('button', {
          class: 'btn sm danger',
          onclick: () =>
            confirmModal({
              title: 'Delete opponent?',
              body: `The scouting profile for ${opp.name} will be permanently removed.`,
              onConfirm: async () => {
                await window.cci.deleteOpponent(opp.opponent_id);
                ctx.navigate('scouting');
              },
            }),
        }, 'Delete'),
      ])
    )
  );

  container.append(
    el('div', { class: 'kpi-row' }, [
      kpi({ label: 'Head-to-Head', value: `${wins}-${h2h.length - wins}`, meta: `${h2h.length} matches`, disabled: true }),
      kpi({ label: 'Win Rate', value: `${teamWinRate(h2h)}%`, meta: 'Your results', disabled: true }),
      kpi({ label: 'Roster', value: (opp.players || []).length, meta: 'Scouted players', disabled: true }),
      kpi({ label: 'Veto Book', value: (opp.veto_history || []).length, meta: 'Saved plans', disabled: true }),
    ])
  );

  const cols = el('div', { class: 'grid cols-2', style: 'align-items:start;' });

  // Roster
  const roster = sectionCard('Roster', () => addPlayer(opp, reload));
  if (!(opp.players || []).length) roster.append(el('div', { class: 'field-hint', style: 'padding:6px 2px;' }, 'No players scouted yet.'));
  for (let i = 0; i < (opp.players || []).length; i++) {
    const p = opp.players[i];
    roster.append(
      el('div', { class: 'crow', style: 'cursor:default;align-items:flex-start;' }, [
        el('div', { class: 'crow-main' }, [
          el('div', { class: 'crow-title' }, p.gamertag),
          p.note ? el('div', { class: 'field-hint', style: 'margin-top:2px;line-height:1.5;' }, p.note) : null,
        ]),
        el('span', { class: `role-badge ${roleClass(p.role)}` }, p.role || 'Flex'),
        el('div', { class: 'crow-actions' }, [
          iconBtn('edit', 'Edit player', () => editPlayer(opp, i, reload)),
          iconBtn('trash', 'Remove player', async () => {
            const players = opp.players.slice();
            players.splice(i, 1);
            await window.cci.saveOpponent({ ...opp, players });
            reload();
          }),
        ]),
      ])
    );
  }
  cols.append(roster);

  // Map notes
  const notes = sectionCard('Map & Mode Notes', () => addMapNote(opp, mapNames, modeNames, reload));
  if (!(opp.map_notes || []).length) notes.append(el('div', { class: 'field-hint', style: 'padding:6px 2px;' }, 'No map notes yet.'));
  for (let i = 0; i < (opp.map_notes || []).length; i++) {
    const m = opp.map_notes[i];
    const provenance = [m.source, m.date ? fmtDate(m.date) : null].filter(Boolean).join(' · ');
    notes.append(
      el('div', { class: 'crow', style: 'cursor:default;align-items:flex-start;' }, [
        el('span', { class: `veto-turn ${m.threat === 'high' ? 'them' : 'us'}`, style: m.threat === 'medium' ? 'background:#5c3d1f33;color:#ffb870;' : null }, (m.threat || 'med').slice(0, 1).toUpperCase()),
        el('div', { class: 'crow-main' }, [
          el('div', { style: 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;' }, [
            el('div', { class: 'crow-title' }, `${m.map}${m.mode ? ` · ${m.mode}` : ''}`),
            confidenceBadge(m.confidence),
          ]),
          m.note ? el('div', { class: 'field-hint', style: 'margin-top:2px;line-height:1.5;' }, m.note) : null,
          provenance ? el('div', { class: 'field-hint', style: 'margin-top:2px;opacity:.75;' }, provenance) : null,
        ]),
        el('div', { class: 'crow-actions' }, [
          iconBtn('edit', 'Edit note', () => editMapNote(opp, i, mapNames, modeNames, reload)),
          iconBtn('trash', 'Remove note', async () => {
            const map_notes = opp.map_notes.slice();
            map_notes.splice(i, 1);
            await window.cci.saveOpponent({ ...opp, map_notes });
            reload();
          }),
        ]),
      ])
    );
  }
  cols.append(notes);
  container.append(cols);

  // Discrete, confidence-rated intel items — veto reads, rotations, player
  // tendencies — separate from the single tendencies/notes free-text blocks
  // below, which stay as a general catch-all.
  const intelCard = sectionCard('Opponent Intel', () => addIntel(opp, reload));
  const intelItems = [...(opp.intel || [])].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  if (!intelItems.length) {
    intelCard.append(
      el('div', { class: 'field-hint', style: 'padding:6px 2px;' },
        'No rated intel yet — HP rotations, common breaks, opening routes, plant preferences, player reads…')
    );
  }
  for (const item of intelItems) {
    const idx = (opp.intel || []).findIndex((i) => i.intel_id === item.intel_id);
    const provenance = [item.source, item.date ? fmtDate(item.date) : null].filter(Boolean).join(' · ');
    intelCard.append(
      el('div', { class: 'crow', style: 'cursor:default;align-items:flex-start;' }, [
        el('div', { class: 'crow-main' }, [
          el('div', { style: 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;' }, [
            el('span', { class: 'role-badge' }, item.category || 'General'),
            confidenceBadge(item.confidence),
          ]),
          el('div', { style: 'margin-top:4px;line-height:1.5;' }, item.text),
          provenance ? el('div', { class: 'field-hint', style: 'margin-top:2px;opacity:.75;' }, provenance) : null,
        ]),
        el('div', { class: 'crow-actions' }, [
          iconBtn('edit', 'Edit intel', () => editIntel(opp, idx, reload)),
          iconBtn('trash', 'Remove intel', async () => {
            const intel = (opp.intel || []).filter((i) => i.intel_id !== item.intel_id);
            await window.cci.saveOpponent({ ...opp, intel });
            reload();
          }),
        ]),
      ])
    );
  }
  container.append(intelCard);

  const history = opp.veto_history || [];
  if (history.length) {
    const intel = intelForOpponent(opp.name, history.map((row) => ({ ...row, opponent: opp.name })));
    const book = el('div', { class: 'card', style: 'margin-top:14px;' }, [
      el('div', { class: 'card-head' }, [
        el('div', { class: 'card-title' }, 'Veto Book'),
        el('button', { class: 'btn sm subtle', onclick: () => ctx.navigate('veto-lab') }, 'Open Veto Lab'),
      ]),
    ]);
    for (const line of summaryLines(intel, 4)) {
      book.append(el('div', { class: 'veto-intel-line', style: 'margin-bottom:4px;' }, line));
    }
    for (const row of history.slice(0, 6)) {
      const picks = (row.steps || []).filter((s) => s.action === 'pick' && s.map).map((s) => `${shortMode(s.mode)} ${s.map}`);
      book.append(
        el('div', { class: 'crow', style: 'cursor:default;' }, [
          el('div', { class: 'crow-main' }, [
            el('div', { class: 'crow-title' }, picks.length ? picks.join(' · ') : 'Draft / incomplete'),
            el('div', { class: 'crow-sub' }, `${row.format} · ${row.first === 'us' ? 'we veto first' : 'they veto first'}`),
          ]),
          el('div', { class: 'crow-meta' }, row.recorded_at ? row.recorded_at.slice(0, 10) : ''),
        ])
      );
    }
    container.append(book);
  }

  // Tendencies + free notes
  container.append(
    el('div', { class: 'card', style: 'margin-top:14px;' }, [
      el('div', { class: 'card-head' }, [
        el('div', { class: 'card-title' }, 'Tendencies & Notes'),
        el('button', { class: 'btn sm subtle', onclick: () => editNotes(opp, reload) }, 'Edit'),
      ]),
      opp.tendencies
        ? el('div', { style: 'font-size:12.5px;line-height:1.6;color:var(--text-dim);white-space:pre-wrap;margin-bottom:10px;' }, opp.tendencies)
        : el('div', { class: 'field-hint' }, 'No tendencies recorded — veto habits, favoured setups, comeback patterns…'),
      opp.notes ? el('div', { style: 'font-size:12.5px;line-height:1.6;color:var(--text-dim);white-space:pre-wrap;border-top:1px solid var(--border);padding-top:10px;' }, opp.notes) : null,
    ])
  );

  // Head-to-head matches
  if (h2h.length) {
    const log = el('div', { class: 'card', style: 'margin-top:14px;' }, [el('div', { class: 'card-head' }, [el('div', { class: 'card-title' }, 'Head-to-Head Matches')])]);
    for (const m of [...h2h].sort((a, b) => (a.date < b.date ? 1 : -1))) {
      log.append(
        el('div', { class: 'crow', style: 'cursor:default;' }, [
          el('div', { class: 'crow-main' }, [
            el('div', { class: 'crow-title' }, `${m.map || 'Unknown'} · ${m.mode || ''}`),
            el('div', { class: 'crow-sub' }, m.score || ''),
          ]),
          el('span', { class: `pill ${m.result === 'Win' ? 'win' : 'loss'}` }, m.result || '—'),
          el('div', { class: 'crow-meta' }, fmtDate(m.date)),
        ])
      );
    }
    container.append(log);
  }
}

function sectionCard(title, onAdd) {
  return el('div', { class: 'card' }, [
    el('div', { class: 'card-head' }, [
      el('div', { class: 'card-title' }, title),
      el('button', { class: 'btn sm subtle', onclick: onAdd }, '+ Add'),
    ]),
  ]);
}

function opponentForm(reload, opp = null) {
  openForm({
    title: opp ? 'Edit Opponent' : 'Add Opponent',
    fields: [
      { key: 'name', label: 'Team Name', required: true, placeholder: 'Opponent organization' },
      [
        { key: 'tag', label: 'Tag', placeholder: 'e.g. OPTC' },
        { key: 'region', label: 'Region', placeholder: 'e.g. NA / EU' },
      ],
    ],
    values: opp || {},
    onSubmit: async (values) => {
      const saved = await window.cci.saveOpponent({ ...(opp || {}), ...values });
      toast(opp ? 'Opponent updated' : 'Opponent added', 'ok');
      reload();
      return saved;
    },
  });
}

function playerFields() {
  return [
    { key: 'gamertag', label: 'Gamertag', required: true, placeholder: 'Player tag' },
    { key: 'role', label: 'Role', type: 'select', options: ROLES },
    { key: 'note', label: 'Note', type: 'textarea', placeholder: 'Playstyle, weapons, tendencies' },
  ];
}

function addPlayer(opp, reload) {
  openForm({
    title: 'Add Player',
    fields: playerFields(),
    values: { role: 'Flex' },
    onSubmit: async (values) => {
      const players = [...(opp.players || []), values];
      await window.cci.saveOpponent({ ...opp, players });
      reload();
    },
  });
}

function editPlayer(opp, index, reload) {
  openForm({
    title: 'Edit Player',
    fields: playerFields(),
    values: opp.players[index],
    onSubmit: async (values) => {
      const players = opp.players.slice();
      players[index] = values;
      await window.cci.saveOpponent({ ...opp, players });
      reload();
    },
  });
}

function mapNoteFields(mapNames, modeNames) {
  return [
    [
      { key: 'map', label: 'Map', type: 'select', options: ['', ...mapNames] },
      { key: 'mode', label: 'Mode', type: 'select', options: ['', ...modeNames] },
    ],
    [
      { key: 'threat', label: 'Threat', type: 'select', options: THREATS },
      { key: 'confidence', label: 'Confidence', type: 'select', options: CONFIDENCE_OPTIONS },
    ],
    { key: 'note', label: 'Note', type: 'textarea', placeholder: 'What they do well / how to punish it' },
    [
      { key: 'source', label: 'Source', placeholder: 'e.g. Scrim vs them, VOD review' },
      { key: 'date', label: 'Date', type: 'date' },
    ],
    { key: 'vod_timestamp', label: 'VOD Reference', placeholder: 'Link or timestamp (optional)' },
  ];
}

function addMapNote(opp, mapNames, modeNames, reload) {
  openForm({
    title: 'Add Map Note',
    fields: mapNoteFields(mapNames, modeNames),
    values: { threat: 'medium', confidence: 'UNVERIFIED', mode: modeNames[0] },
    onSubmit: async (values) => {
      const map_notes = [...(opp.map_notes || []), values];
      await window.cci.saveOpponent({ ...opp, map_notes });
      reload();
    },
  });
}

function editMapNote(opp, index, mapNames, modeNames, reload) {
  openForm({
    title: 'Edit Map Note',
    fields: mapNoteFields(mapNames, modeNames),
    values: opp.map_notes[index],
    onSubmit: async (values) => {
      const map_notes = opp.map_notes.slice();
      map_notes[index] = values;
      await window.cci.saveOpponent({ ...opp, map_notes });
      reload();
    },
  });
}

const INTEL_CATEGORIES = ['General', 'Veto', 'Hardpoint', 'Search & Destroy', 'Overload', 'Player'];

function intelFields() {
  return [
    { key: 'text', label: 'Intel', type: 'textarea', required: true, placeholder: 'e.g. Rotates P2→P3 early on Den, weak to a fast pinch' },
    [
      { key: 'category', label: 'Category', type: 'select', options: INTEL_CATEGORIES },
      { key: 'confidence', label: 'Confidence', type: 'select', options: CONFIDENCE_OPTIONS },
    ],
    [
      { key: 'source', label: 'Source', placeholder: 'e.g. Scrim, VOD review, teammate' },
      { key: 'date', label: 'Date', type: 'date' },
    ],
    { key: 'vod_timestamp', label: 'VOD Reference', placeholder: 'Link or timestamp (optional)' },
  ];
}

function addIntel(opp, reload) {
  openForm({
    title: 'Add Intel',
    fields: intelFields(),
    values: { category: 'General', confidence: 'UNVERIFIED', date: new Date().toISOString().slice(0, 10) },
    onSubmit: async (values) => {
      const intel = [...(opp.intel || []), values];
      await window.cci.saveOpponent({ ...opp, intel });
      toast('Intel added', 'ok');
      reload();
    },
  });
}

function editIntel(opp, index, reload) {
  openForm({
    title: 'Edit Intel',
    fields: intelFields(),
    values: opp.intel[index],
    onSubmit: async (values) => {
      const intel = opp.intel.slice();
      intel[index] = { ...intel[index], ...values };
      await window.cci.saveOpponent({ ...opp, intel });
      toast('Intel updated', 'ok');
      reload();
    },
  });
}

function editNotes(opp, reload) {
  openForm({
    title: 'Tendencies & Notes',
    width: '520px',
    fields: [
      { key: 'tendencies', label: 'Tendencies', type: 'textarea', rows: 5, placeholder: 'Veto habits, favoured setups, mid-game patterns…' },
      { key: 'notes', label: 'General Notes', type: 'textarea', rows: 4, placeholder: 'Anything else worth remembering' },
    ],
    values: { tendencies: opp.tendencies || '', notes: opp.notes || '' },
    onSubmit: async (values) => {
      await window.cci.saveOpponent({ ...opp, tendencies: values.tendencies, notes: values.notes });
      toast('Notes updated', 'ok');
      reload();
    },
  });
}
