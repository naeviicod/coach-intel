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

test('team leaders are not org editors; they only manage their own roster', () => {
  const { canEdit, canEditTeam, canTransferMembers } = require('../src/main/access');
  assert.equal(canEdit('team_leader'), false);
  assert.equal(canEdit('coach'), true);
  assert.equal(canEdit('developer'), true);
  assert.equal(canEditTeam('team_leader', 'rome', { teamIds: ['rome'] }), true);
  assert.equal(canEditTeam('team_leader', 'other', { teamIds: ['rome'] }), false);
  assert.equal(canTransferMembers('team_leader'), false);
});

test('org roles that span every team include coaches, analysts, creatives and team leaders', () => {
  const { seesAllTeams, canEditTeam, canTransferMembers } = require('../src/main/access');
  assert.equal(seesAllTeams('owner'), true);
  assert.equal(seesAllTeams('admin'), true);
  assert.equal(seesAllTeams('coach'), true);
  assert.equal(seesAllTeams('analyst'), true);
  assert.equal(seesAllTeams('creative'), true);
  assert.equal(seesAllTeams('team_leader'), true);
  assert.equal(seesAllTeams('user'), false);
  assert.equal(canEditTeam('team_leader', 'rome', { teamIds: ['rome'] }), true);
  assert.equal(canEditTeam('team_leader', 'other', { teamIds: ['rome'] }), false);
  assert.equal(canEditTeam('admin', 'other', { teamIds: ['rome'] }), true);
  assert.equal(canTransferMembers('team_leader'), false);
  assert.equal(canTransferMembers('coach'), false);
  assert.equal(canTransferMembers('admin'), true);
  assert.equal(canTransferMembers('developer'), true);
  assert.equal(canTransferMembers('owner'), true);
  assert.equal(canTransferMembers('owner', { local: true }), true);
});

test('the org calendar is on the main nav for staff, including team leaders', () => {
  const { canAccessPage } = require('../src/renderer/lib/access.js');
  for (const role of ['owner', 'admin', 'developer', 'coach', 'team_leader']) {
    assert.equal(canAccessPage(role, 'calendar'), true, role);
  }
  for (const role of ['analyst', 'creative', 'user', 'member', 'player']) {
    assert.equal(canAccessPage(role, 'calendar'), false, role);
  }
});

test('players keep dashboard and analytics, not org calendar, tasks, tools or integrations', async () => {
  const { canAccessPage } = await import('../src/renderer/lib/access.js');
  assert.equal(canAccessPage('user', 'dashboard'), true);
  assert.equal(canAccessPage('user', 'intel-feed'), true);
  assert.equal(canAccessPage('user', 'teams'), true);
  assert.equal(canAccessPage('user', 'playbooks'), true);
  assert.equal(canAccessPage('user', 'calendar'), false);
  assert.equal(canAccessPage('user', 'tasks'), false);
  assert.equal(canAccessPage('user', 'maps-modes'), false);
  assert.equal(canAccessPage('user', 'scouting'), false);
  assert.equal(canAccessPage('user', 'integrations'), false);
  assert.equal(canAccessPage('team_leader', 'calendar'), true);
  assert.equal(canAccessPage('team_leader', 'maps-modes'), false);
  assert.equal(canAccessPage('coach', 'integrations'), false);
  assert.equal(canAccessPage('admin', 'maps-modes'), true);
  assert.equal(canAccessPage('developer', 'integrations'), true);
  assert.equal(canAccessPage('owner', 'scouting'), true);
});

test('every role that plans still reaches the team hub planner', () => {
  const { canAccessPage } = require('../src/renderer/lib/access.js');
  for (const role of ['owner', 'coach', 'team_leader', 'user', 'member', 'player']) {
    assert.equal(canAccessPage(role, 'team-hub'), true, role);
  }
});

test('Naevii / NaeviiSZN get developer rights even when profiles.role is user', async () => {
  const { resolveAccessRole, assertCanEdit, assertCanEditTeam, assertCanTransfer, canEditTeam, canTransferMembers } = require('../src/main/access');
  assert.equal(resolveAccessRole({ role: 'user', discord_username: 'Naevii' }), 'developer');
  assert.equal(resolveAccessRole({ role: 'user', display_name: 'NaeviiSZN' }), 'developer');
  assert.equal(resolveAccessRole({ role: 'user' }, { names: ['NaeviiSZN'] }), 'developer');
  assert.equal(resolveAccessRole({ role: 'user', discord_username: 'Shotzzy' }), 'user');
  assert.equal(canEditTeam('developer', 'other', { teamIds: [] }), true);
  assert.equal(canTransferMembers('developer'), true);

  const naevii = {
    get: () => ({
      getState: async () => ({ configured: true, session: { user: { id: '1' } } }),
      listProfiles: async () => ({
        me: { role: 'user', discord_username: 'Naevii' },
        teamIds: ['rome'],
        linkedNames: ['NaeviiSZN'],
      }),
    }),
  };
  await assertCanEdit(naevii);
  await assertCanEditTeam(naevii, 'other');
  await assertCanTransfer(naevii);

  const { accessFromProfile, canEdit } = await import('../src/renderer/lib/access.js');
  const access = accessFromProfile(
    { role: 'user', discord_username: 'Naevii' },
    { teamIds: ['rome'], linkedNames: ['NaeviiSZN'] },
  );
  assert.equal(access.role, 'developer');
  assert.equal(access.canEdit, true);
  assert.equal(canEdit(access.role), true);
});

test('unlinked players keep local teams so a revoke cannot wipe the org', () => {
  const { scopeTeams } = require('../src/main/access');
  const teams = [{ id: 'rome' }, { id: 'other' }];
  assert.deepEqual(scopeTeams(teams, { role: 'user', teamIds: [] }).map((t) => t.id), ['rome', 'other']);
  assert.deepEqual(scopeTeams(teams, { role: 'user', teamIds: null }).map((t) => t.id), ['rome', 'other']);
  assert.deepEqual(scopeTeams(teams, { role: 'user', teamIds: ['rome'] }).map((t) => t.id), ['rome']);
  assert.deepEqual(scopeTeams(teams, { role: 'developer', teamIds: [] }).map((t) => t.id), ['rome', 'other']);
});
