const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('node:url');

const webUrl = (name) => pathToFileURL(path.join(__dirname, '..', 'web', 'lib', name)).href;
const libUrl = (name) => pathToFileURL(path.join(__dirname, '..', 'src', 'renderer', 'lib', name)).href;

test('BO5 series is HP-SnD-OL-HP-SnD and writes one match per filled map', async () => {
  const series = await import(webUrl('series.js'));
  const modes = series.bo5Modes(['Hardpoint', 'Search & Destroy', 'Overload']);
  assert.deepEqual(modes, ['Hardpoint', 'Search & Destroy', 'Overload', 'Hardpoint', 'Search & Destroy']);
  const maps = series.emptyBo5(modes);
  maps[0].map = 'Raid';
  maps[0].result = 'Win';
  maps[0].score = '250-180';
  maps[1].map = 'Hacienda';
  maps[1].result = 'Loss';
  maps[1].score = '5-6';
  const records = series.seriesMatchRecords({
    teamId: 'rome',
    opponent: 'Optic',
    date: '2026-08-26',
    maps,
  });
  assert.equal(records.length, 2);
  assert.equal(records[0].payload.game, 1);
  assert.equal(records[0].payload.mode, 'Hardpoint');
  assert.equal(records[1].payload.mode, 'Search & Destroy');
  assert.equal(records[0].payload.players.length, 0);
});

test('pasted scoreboard lines attach kills to the playing roster', async () => {
  const series = await import(webUrl('series.js'));
  const members = [
    { id: 'a', gamertag: 'NaeviiSZN', slot: 'starter' },
    { id: 'b', gamertag: 'vxlt', slot: 'starter' },
    { id: 'c', gamertag: 'Coach', slot: 'staff' },
  ];
  const players = series.applyScoreboardToRoster('NaeviiSZN 24 8 6 2840\nvxlt 18 11 4 2100', members);
  assert.equal(players.length, 2);
  assert.equal(players.find((p) => p.member_id === 'a').kills, 24);
  assert.equal(players.find((p) => p.member_id === 'b').damage, 2100);
});

test('Naevii and org owners keep competitive stats; staff do not', async () => {
  const { showsCompetitiveStats } = await import(webUrl('series.js'));
  assert.equal(showsCompetitiveStats({ gamertag: 'NaeviiSZN', slot: 'starter', title: 'Developer' }), true);
  assert.equal(showsCompetitiveStats({ gamertag: 'Owner', slot: 'staff', title: 'Org Owner' }), true);
  assert.equal(showsCompetitiveStats({ gamertag: 'Abloh', slot: 'staff', title: 'Coach' }), false);
  assert.equal(showsCompetitiveStats({ gamertag: 'vxlt', slot: 'starter', title: 'Player' }), true);
});

test('desktop series helper matches the web BO5 order', async () => {
  const series = await import(libUrl('series.js'));
  assert.deepEqual(series.bo5Modes(['Hardpoint', 'Search & Destroy', 'Overload'])[2], 'Overload');
});
