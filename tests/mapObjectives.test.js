const test = require('node:test');
const assert = require('node:assert/strict');
const fss = require('fs');
const os = require('os');
const path = require('path');

const ROOT = fss.mkdtempSync(path.join(os.tmpdir(), 'cci-obj-'));
process.env.CCI_DATA_ROOT = ROOT;
const { bundledFor, mergeObjectives, isUnverified } = require('../src/main/mapObjectives');
const store = require('../src/main/dataStore');

test.after(() => fss.rmSync(ROOT, { recursive: true, force: true }));

test('bundled Den Hardpoint uses the GamesAtlas rotation', () => {
  const data = bundledFor('den', 'Den', 'hardpoint');
  assert.equal(data.hills[0].location, 'Courtyard');
  assert.equal(data.hills[1].location, 'Balcony');
  assert.equal(data.hills[2].location, 'Helipad');
  assert.equal(data.hills[3].location, 'Terrace');
  assert.ok(data.keys.blue.length);
  assert.ok(data.keys.red.length);
});

test('unverified saved Overload fields fill from bundled research', () => {
  const bundled = bundledFor('den', 'Den', 'overload');
  const existing = {
    map: 'Den',
    mode: 'Overload',
    device_spawns: [],
    team_a_zone: 'NEEDS_VERIFICATION',
    team_b_zone: 'NEEDS_VERIFICATION',
  };
  const merged = mergeObjectives(bundled, existing, existing);
  assert.equal(isUnverified(merged.team_a_zone), false);
  assert.match(merged.team_a_zone, /Blue/);
  assert.match(merged.team_b_zone, /Red/);
  assert.equal(merged.device_spawns.length, 3);
  assert.equal(merged.keys.blue.length, 2);
});

test('a coach override wins over bundled callouts', () => {
  const bundled = bundledFor('raid', 'Raid', 'snd');
  const existing = {
    bombsites: [
      { label: 'A', location: 'Dining' },
      { label: 'B', location: 'Court' },
    ],
    bomb_spawn: 'Mid',
    offense_spawn: 'Circle Drive',
    defense_spawn: 'Back',
  };
  const merged = mergeObjectives(bundled, existing, existing);
  assert.equal(merged.bombsites[0].location, 'Dining');
});

test('getMapObjectives returns Den Overload research instead of empty placeholders', async () => {
  await store.ensureDirectories();
  const data = await store.getMapObjectives('den', 'Den', 'Overload');
  assert.ok(data.device_spawns.length);
  assert.equal(isUnverified(data.team_a_zone), false);
  assert.equal(isUnverified(data.team_b_zone), false);
});

test('new strats default piece scale to 70 percent', async () => {
  await store.ensureDirectories();
  const team = await store.saveTeam({ name: 'Scale Team', tag: 'SCL' });
  const saved = await store.saveStrat(team.id, {
    strategy_name: 'Scale check',
    map: 'Den',
    mode: 'Hardpoint',
    player_positions: [],
    drawings: [],
  });
  assert.equal(saved.piece_scale, 0.7);
});
