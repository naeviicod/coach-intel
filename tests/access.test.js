const test = require('node:test');
const assert = require('node:assert/strict');
const { isStaff, assertCanEdit } = require('../src/main/access');

test('owner, admin, team leader and coach are staff', () => {
  for (const role of ['owner', 'admin', 'team_leader', 'coach', 'Owner', 'ADMIN']) {
    assert.equal(isStaff(role), true, role);
  }
});

test('players and analysts are not staff', () => {
  for (const role of ['user', 'member', 'player', 'analyst', 'creative', '', null, undefined]) {
    assert.equal(isStaff(role), false, String(role));
  }
});

test('assertCanEdit allows local use with no session', async () => {
  const supabase = {
    get: () => ({
      getState: async () => ({ configured: false, session: null }),
    }),
  };
  await assertCanEdit(supabase);
});

test('assertCanEdit allows a configured app with no signed-in session', async () => {
  const supabase = {
    get: () => ({
      getState: async () => ({ configured: true, session: null }),
    }),
  };
  await assertCanEdit(supabase);
});

test('assertCanEdit blocks a signed-in player (role=user)', async () => {
  const supabase = {
    get: () => ({
      getState: async () => ({ configured: true, session: { user: { id: '1' } } }),
      listProfiles: async () => ({ me: { role: 'user' } }),
    }),
  };
  await assert.rejects(() => assertCanEdit(supabase), /permission/);
});

test('assertCanEdit allows a signed-in owner', async () => {
  const supabase = {
    get: () => ({
      getState: async () => ({ configured: true, session: { user: { id: '1' } } }),
      listProfiles: async () => ({ me: { role: 'owner' } }),
    }),
  };
  await assertCanEdit(supabase);
});

test('assertCanEdit allows a session when the profile row is missing', async () => {
  const supabase = {
    get: () => ({
      getState: async () => ({ configured: true, session: { user: { id: '1' } } }),
      listProfiles: async () => ({ me: null }),
    }),
  };
  await assertCanEdit(supabase);
});

test('assertCanEdit allows a session when the roster cannot be loaded', async () => {
  const supabase = {
    get: () => ({
      getState: async () => ({ configured: true, session: { user: { id: '1' } } }),
      listProfiles: async () => {
        throw new Error('network');
      },
    }),
  };
  await assertCanEdit(supabase);
});

test('org roles that span every team include coaches, analysts and creatives', () => {
  const { seesAllTeams } = require('../src/main/access');
  assert.equal(seesAllTeams('owner'), true);
  assert.equal(seesAllTeams('admin'), true);
  assert.equal(seesAllTeams('coach'), true);
  assert.equal(seesAllTeams('analyst'), true);
  assert.equal(seesAllTeams('creative'), true);
  assert.equal(seesAllTeams('team_leader'), false);
  assert.equal(seesAllTeams('user'), false);
});
