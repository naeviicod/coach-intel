const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('node:url');

// The libs are renderer-side ES modules; import them dynamically from this CJS
// test file. They are DOM-free, so they load and run under plain Node.
const libUrl = (name) => pathToFileURL(path.join(__dirname, '..', 'src', 'renderer', 'lib', name)).href;

const RULESET_MODES = ['Hardpoint', 'Search & Destroy', 'Overload'];
const POOLS = {
  Hardpoint: ['Colossus', 'Den', 'Gridlock', 'Hacienda', 'Sake', 'Scar'],
  'Search & Destroy': ['Den', 'Fringe', 'Gridlock', 'Hacienda', 'Raid', 'Sake'],
  Overload: ['Den', 'Exposure', 'Gridlock', 'Scar'],
};

// ---------- Veto ----------

test('veto: a Bo5 expands to the right mode order and game counts', async () => {
  const veto = await import(libUrl('veto.js'));
  const modes = veto.seriesModes('Bo5', RULESET_MODES);
  assert.deepEqual(modes, ['Hardpoint', 'Search & Destroy', 'Overload', 'Hardpoint', 'Search & Destroy']);
  const { games } = veto.modeBreakdown(modes);
  assert.deepEqual(games, { Hardpoint: 2, 'Search & Destroy': 2, Overload: 1 });
});

test('veto: bans reduce each pool down to the required picks', async () => {
  const veto = await import(libUrl('veto.js'));
  const modes = veto.seriesModes('Bo5', RULESET_MODES);
  const { steps } = veto.buildVetoSequence({ modes, poolsByMode: POOLS, first: 'us' });
  // HP 6-2 + 2 picks, SnD 6-2 + 2 picks, OVL 4-1 + 1 pick = 6 + 6 + 4 = 16.
  assert.equal(steps.length, 16);
  assert.equal(steps[0].team, 'us');
  assert.equal(steps[1].team, 'them'); // turns alternate globally
  const bans = steps.filter((s) => s.action === 'ban').length;
  const picks = steps.filter((s) => s.action === 'pick').length;
  assert.equal(picks, 5);
  assert.equal(bans, 11);
});

test('veto: available maps exclude what is already used in that mode', async () => {
  const veto = await import(libUrl('veto.js'));
  const modes = veto.seriesModes('Bo5', RULESET_MODES);
  const { steps } = veto.buildVetoSequence({ modes, poolsByMode: POOLS, first: 'us' });
  steps[0].map = 'Den'; // first HP ban
  const next = steps.find((s, i) => i > 0 && s.mode === 'Hardpoint');
  const avail = veto.availableMaps(next, steps, POOLS);
  assert.ok(!avail.includes('Den'));
  assert.equal(avail.length, POOLS.Hardpoint.length - 1);
});

test('veto: resultSeries reads picks back in series order and completion is detected', async () => {
  const veto = await import(libUrl('veto.js'));
  const modes = veto.seriesModes('Bo3', RULESET_MODES);
  const { steps } = veto.buildVetoSequence({ modes, poolsByMode: POOLS, first: 'us' });
  assert.equal(veto.isSequenceComplete(steps), false);
  // Assign each step a map from its remaining pool.
  for (const step of steps) {
    const avail = veto.availableMaps(step, steps, POOLS);
    step.map = avail[0];
  }
  assert.equal(veto.isSequenceComplete(steps), true);
  const series = veto.resultSeries(modes, steps);
  assert.equal(series.length, 3);
  assert.equal(series[0].mode, 'Hardpoint');
  assert.ok(series[0].map);
});

// ---------- Report ----------

const MATCHES = [
  { date: '2026-08-15', mode: 'Hardpoint', map: 'Den', opponent: 'Rivals', result: 'Win', score: '250-200', players: [{ member_id: 'nova', kills: 20, deaths: 10, assists: 3, damage: 2500, hill_time: 40 }] },
  { date: '2026-08-13', mode: 'Search & Destroy', map: 'Raid', opponent: 'Sunset', result: 'Loss', score: '4-6', players: [{ member_id: 'nova', kills: 8, deaths: 9, assists: 1, damage: 1200 }] },
];
const MEMBERS = [{ id: 'nova', gamertag: 'Nova' }];

test('report: team report summarizes record and emits markdown tables', async () => {
  const report = await import(libUrl('report.js'));
  const built = report.buildTeamReport({ team: { name: 'Team Naevii' }, matches: MATCHES, members: MEMBERS });
  assert.equal(built.kpis[0].label, 'Record');
  assert.equal(built.kpis[0].value, '1-1');
  const headings = built.sections.map((s) => s.heading);
  assert.ok(headings.includes('By Mode'));
  assert.ok(headings.includes('Players'));
  assert.match(built.markdown, /# Team Naevii — Performance Report/);
  assert.match(built.markdown, /\| Mode \| Played \| W-L \| Win % \|/);
});

test('report: opponent report keys head-to-head off the opponent name', async () => {
  const report = await import(libUrl('report.js'));
  const built = report.buildOpponentReport({ opponent: { name: 'Rivals', players: [] }, matches: MATCHES });
  assert.equal(built.kpis[0].label, 'Head-to-Head');
  assert.equal(built.kpis[0].value, '1-0');
});

// ---------- Standings ----------

test('standings: sorted by points then win percentage', async () => {
  const standings = await import(libUrl('standings.js'));
  const sorted = standings.sortStandings([
    { name: 'B', wins: 3, losses: 3, points: 9 },
    { name: 'A', wins: 6, losses: 0, points: 18 },
    { name: 'C', wins: 1, losses: 5, points: 3 },
  ]);
  assert.deepEqual(sorted.map((t) => t.name), ['A', 'B', 'C']);
  assert.equal(standings.winPct({ wins: 3, losses: 1 }), 75);
});

test('standings: form reflects the most recent results newest-first', async () => {
  const standings = await import(libUrl('standings.js'));
  const form = standings.formFromMatches(MATCHES, 10);
  assert.equal(form.results.length, 2);
  assert.equal(form.results[0], 'W');
  assert.equal(form.wins, 1);
  assert.equal(form.winRate, 50);
});

test('veto intel: known opponent beats league when suggesting a ban', async () => {
  const intel = await import(libUrl('vetoIntel.js'));
  const vetoes = [
    {
      veto_id: 'a',
      opponent: 'Rivals',
      first: 'them',
      steps: [
        { action: 'ban', team: 'them', mode: 'Hardpoint', map: 'Den' },
        { action: 'pick', team: 'them', mode: 'Hardpoint', map: 'Scar' },
      ],
    },
    {
      veto_id: 'b',
      opponent: 'Sunset',
      first: 'us',
      steps: [
        { action: 'ban', team: 'them', mode: 'Hardpoint', map: 'Colossus' },
        { action: 'pick', team: 'them', mode: 'Hardpoint', map: 'Gridlock' },
      ],
    },
  ];
  const book = intel.intelForOpponent('Rivals', vetoes);
  assert.equal(book.known, true);
  assert.equal(book.profile.theirFirstBans[0].map, 'Den');
  const hints = intel.suggestForStep(book, { action: 'ban', team: 'them', mode: 'Hardpoint' }, ['Den', 'Colossus', 'Scar']);
  assert.equal(hints[0].map, 'Den');
  assert.equal(hints[0].source, 'vs them');

  const fresh = intel.intelForOpponent('Newblood', vetoes);
  assert.equal(fresh.known, false);
  const leagueHints = intel.suggestForStep(fresh, { action: 'ban', team: 'them', mode: 'Hardpoint' }, ['Den', 'Colossus']);
  assert.ok(leagueHints.length);
  assert.equal(leagueHints[0].source, 'league');
});

test('veto: groupStepsByMode keeps adjacent mode columns', async () => {
  const veto = await import(libUrl('veto.js'));
  const groups = veto.groupStepsByMode([
    { mode: 'Hardpoint', action: 'ban' },
    { mode: 'Hardpoint', action: 'pick' },
    { mode: 'Search & Destroy', action: 'ban' },
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].steps.length, 2);
  assert.equal(veto.shortMode('Search & Destroy'), 'SnD');
});

// ---------- Calendar ----------

test('calendar: month matrix is a full six-week grid', async () => {
  const cal = await import(libUrl('calendar.js'));
  const weeks = cal.monthMatrix(2026, 7); // August 2026
  assert.equal(weeks.length, 6);
  assert.ok(weeks.every((w) => w.length === 7));
  assert.equal(cal.isoDate(2026, 7, 1), '2026-08-01');
  assert.ok(weeks.flat().some((d) => d.date === '2026-08-01' && d.inMonth));
});

test('calendar: shiftMonth rolls the year over and bucketByDate groups items', async () => {
  const cal = await import(libUrl('calendar.js'));
  assert.deepEqual(cal.shiftMonth(2026, 11, 1), { year: 2027, month: 0 });
  const buckets = cal.bucketByDate([{ date: '2026-08-01', x: 1 }, { date: '2026-08-01', x: 2 }, { date: '2026-08-02', x: 3 }]);
  assert.equal(buckets['2026-08-01'].length, 2);
  assert.equal(buckets['2026-08-02'].length, 1);
});
