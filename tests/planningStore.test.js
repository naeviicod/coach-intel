const test = require('node:test');
const assert = require('node:assert/strict');
const fss = require('fs');
const os = require('os');
const path = require('path');

// Point the store at a throwaway root before requiring it, so nothing here
// touches the repo's real data directory.
const ROOT = fss.mkdtempSync(path.join(os.tmpdir(), 'cci-planning-'));
process.env.CCI_DATA_ROOT = ROOT;
const planning = require('../src/main/planningStore');

const TEAM = 'test-team';

test.after(() => fss.rmSync(ROOT, { recursive: true, force: true }));

// ---------- Schedule events ----------

test('events round-trip and update by id', async () => {
  const saved = await planning.saveEvent(TEAM, { title: 'Film Session', type: 'meeting', date: '2026-08-20' });
  assert.ok(saved.event_id);
  assert.equal(saved.type, 'meeting');
  assert.equal(saved.team_id, TEAM);

  const list = await planning.getEvents(TEAM);
  assert.equal(list.length, 1);

  const updated = await planning.saveEvent(TEAM, { event_id: saved.event_id, title: 'Film Session 2' });
  assert.equal(updated.title, 'Film Session 2');
  assert.equal(updated.created_at, saved.created_at);
  assert.equal((await planning.getEvents(TEAM)).length, 1);

  await planning.deleteEvent(TEAM, saved.event_id);
  assert.equal((await planning.getEvents(TEAM)).length, 0);
});

test('an unknown event type falls back to training', async () => {
  const saved = await planning.saveEvent(TEAM, { title: 'X', type: 'nonsense', date: '2026-08-21' });
  assert.equal(saved.type, 'training');
  await planning.deleteEvent(TEAM, saved.event_id);
});

test('calendar event types include league match, scrim and vod review', async () => {
  const saved = await planning.saveEvent(TEAM, { title: 'CDL Week 3', type: 'league-match', date: '2026-08-22' });
  assert.equal(saved.type, 'league-match');
  const vod = await planning.saveEvent(TEAM, { title: 'Film', type: 'vod-review', date: '2026-08-23' });
  assert.equal(vod.type, 'vod-review');
  await planning.deleteEvent(TEAM, saved.event_id);
  await planning.deleteEvent(TEAM, vod.event_id);
});

test('org-wide events are stored off the team folders', async () => {
  const saved = await planning.saveEvent('', { title: 'Staff meeting', type: 'meeting', date: '2026-08-26' });
  assert.equal(saved.team_id, '');
  assert.equal((await planning.getEvents('')).some((row) => row.event_id === saved.event_id), true);
  assert.equal((await planning.getEvents(TEAM)).some((row) => row.event_id === saved.event_id), false);
  await planning.deleteEvent('', saved.event_id);
  assert.equal((await planning.getEvents('')).length, 0);
});

test('league-match events persist opponent, maps and time', async () => {
  const saved = await planning.saveEvent(TEAM, {
    title: 'vs FaZe',
    type: 'league-match',
    date: '2026-08-22',
    time: '18:00',
    opponent: 'Atlanta FaZe',
    maps: 'Den, Raid, Scar',
  });
  assert.equal(saved.opponent, 'Atlanta FaZe');
  assert.deepEqual(saved.maps, ['Den', 'Raid', 'Scar']);
  assert.equal(saved.time, '18:00');
  await planning.deleteEvent(TEAM, saved.event_id);
});

// ---------- Scrims ----------

test('scrims normalize map results and scores', async () => {
  const saved = await planning.saveScrim(TEAM, {
    opponent: 'Rivals',
    date: '2026-08-19',
    format: 'Bo5',
    maps: [
      { map: 'Den', mode: 'Hardpoint', result: 'Win', us: '250', them: '210' },
      { map: 'Raid', mode: 'Search & Destroy', result: 'bogus', us: '', them: null },
    ],
  });
  assert.equal(saved.maps.length, 2);
  assert.equal(saved.maps[0].us, 250);
  assert.equal(saved.maps[0].result, 'Win');
  // An invalid result is dropped to empty, and blank scores become null.
  assert.equal(saved.maps[1].result, '');
  assert.equal(saved.maps[1].us, null);

  await planning.deleteScrim(TEAM, saved.scrim_id);
  assert.equal((await planning.getScrims(TEAM)).length, 0);
});

test('scrims persist a playing lineup and drop duplicate ids', async () => {
  const saved = await planning.saveScrim(TEAM, {
    opponent: 'Rivals',
    date: '2026-08-19',
    lineup: ['p1', 'p2', 'p3', 'p4', 'p4', 'p5'],
  });
  assert.deepEqual(saved.lineup, ['p1', 'p2', 'p3', 'p4', 'p5']);
  const again = await planning.saveScrim(TEAM, { ...saved, notes: 'focus HP' });
  assert.deepEqual(again.lineup, ['p1', 'p2', 'p3', 'p4', 'p5']);
  await planning.deleteScrim(TEAM, saved.scrim_id);
});

// ---------- VODs ----------

test('vod markers keep integer timestamps', async () => {
  const saved = await planning.saveVod(TEAM, {
    title: 'GF G3',
    url: 'https://example.com/watch',
    markers: [{ t: '90', label: 'Bad trade' }, { t: 12.9, label: 'Rotation' }],
  });
  assert.equal(saved.markers.length, 2);
  assert.equal(saved.markers[0].t, 90);
  assert.equal(saved.markers[1].t, 12);
  await planning.deleteVod(TEAM, saved.vod_id);
});

// ---------- Vetoes ----------

test('saving a veto writes the plan onto the opponent scout card', async () => {
  const saved = await planning.saveVeto(TEAM, {
    opponent: 'Rivals',
    format: 'Bo5',
    first: 'them',
    steps: [{ action: 'ban', team: 'them', mode: 'Hardpoint', map: 'Den' }],
  });
  const opponents = await planning.getOpponents();
  const rivals = opponents.find((o) => o.name === 'Rivals');
  assert.ok(rivals, 'opponent is created from the veto');
  assert.equal(rivals.veto_history.length, 1);
  assert.equal(rivals.veto_history[0].veto_id, saved.veto_id);
  assert.equal(rivals.veto_history[0].steps[0].map, 'Den');

  await planning.deleteVeto(TEAM, saved.veto_id);
  const after = (await planning.getOpponents()).find((o) => o.name === 'Rivals');
  assert.equal((after?.veto_history || []).length, 0);
});

test('veto steps are sanitized to ban/pick and us/them', async () => {
  const saved = await planning.saveVeto(TEAM, {
    opponent: 'Rivals',
    format: 'Bo5',
    first: 'them',
    steps: [
      { action: 'ban', team: 'us', mode: 'Hardpoint', map: 'Scar' },
      { action: 'weird', team: 'nobody', mode: 'Hardpoint', map: null },
    ],
  });
  assert.equal(saved.first, 'them');
  assert.equal(saved.steps[0].action, 'ban');
  assert.equal(saved.steps[1].action, 'ban'); // invalid action defaults to ban
  assert.equal(saved.steps[1].team, 'us'); // invalid team defaults to us
  await planning.deleteVeto(TEAM, saved.veto_id);
});

// ---------- Scouting (org-level) ----------

test('opponents persist rosters and map notes', async () => {
  const saved = await planning.saveOpponent({
    name: 'Sunset',
    tag: 'SUN',
    players: [{ gamertag: 'Ace', role: 'Sniper', note: 'aggressive' }],
    map_notes: [{ map: 'Den', mode: 'Hardpoint', threat: 'high', note: 'strong P2' }],
  });
  assert.ok(saved.opponent_id);
  assert.equal(saved.players.length, 1);
  assert.equal(saved.map_notes[0].threat, 'high');

  const fetched = await planning.getOpponent(saved.opponent_id);
  assert.equal(fetched.name, 'Sunset');

  await planning.deleteOpponent(saved.opponent_id);
  assert.equal(await planning.getOpponent(saved.opponent_id), null);
});

// ---------- Rankings (org-level) ----------

test('rankings default empty and normalize saved teams', async () => {
  const empty = await planning.getRankings();
  assert.deepEqual(empty.teams, []);

  const saved = await planning.saveRankings({
    region: 'CDL NA',
    teams: [{ name: 'Alpha', wins: '5', losses: 2, points: '15' }],
  });
  assert.equal(saved.region, 'CDL NA');
  assert.equal(saved.teams[0].wins, 5);
  assert.equal(saved.teams[0].points, 15);
  assert.ok(saved.teams[0].id, 'each standings row gets an id');
  assert.ok(saved.updated_at);

  const removed = await planning.saveRankings({
    region: saved.region,
    teams: saved.teams.filter((t) => t.id !== saved.teams[0].id),
  });
  assert.equal(removed.teams.length, 0);
});

// ---------- Security ----------

test('a traversal team id is rejected before it becomes a path', async () => {
  await assert.rejects(() => planning.getScrims('../../etc'), /Invalid team id/);
  await assert.rejects(() => planning.saveEvent('..', { title: 'x' }), /Invalid team id/);
});
