const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('node:url');

const libUrl = (name) => pathToFileURL(path.join(__dirname, '..', 'src', 'renderer', 'lib', name)).href;

test('staff titles pick an invite access role', async () => {
  const { suggestedAccessRole, accessRoleLabel, inviteUrl } = await import(libUrl('invite.js'));
  assert.equal(suggestedAccessRole({ title: 'Team Leader' }), 'team_leader');
  assert.equal(suggestedAccessRole({ title: 'Head Coach' }), 'coach');
  assert.equal(suggestedAccessRole({ title: 'Analyst' }), 'analyst');
  assert.equal(suggestedAccessRole({ title: 'Org Owner' }), 'owner');
  assert.equal(suggestedAccessRole({ title: 'Admin' }), 'admin');
  assert.equal(suggestedAccessRole({ title: 'General Manager' }), 'admin');
  assert.equal(suggestedAccessRole({ title: 'Artist' }), 'creative');
  assert.equal(suggestedAccessRole({ title: 'Graphic Designer' }), 'creative');
  assert.equal(suggestedAccessRole({ title: 'Content Creator' }), 'creative');
  assert.equal(suggestedAccessRole({ title: 'Developer', gamertag: 'NaeviiSZN' }), 'user');
  assert.equal(accessRoleLabel('user'), 'Player');
  assert.equal(accessRoleLabel('admin'), 'Admin');
  assert.equal(accessRoleLabel('owner'), 'Org owner');
  assert.equal(inviteUrl('abc_DEF-1234567890'), 'coachintel://invite/abc_DEF-1234567890');
});

test('players and team leaders do not see every team', async () => {
  const { seesAllTeams, canAccessPage, isStaff } = await import(libUrl('access.js'));
  assert.equal(seesAllTeams('owner'), true);
  assert.equal(seesAllTeams('admin'), true);
  assert.equal(seesAllTeams('coach'), true);
  assert.equal(seesAllTeams('analyst'), true);
  assert.equal(seesAllTeams('team_leader'), false);
  assert.equal(seesAllTeams('user'), false);
  assert.equal(seesAllTeams('member'), false);
  assert.equal(seesAllTeams('creative'), true);
  assert.equal(isStaff('admin'), true);
  assert.equal(isStaff('owner'), true);
  assert.equal(isStaff('creative'), false);
  assert.equal(canAccessPage('admin', 'war-room'), true);
  assert.equal(canAccessPage('admin', 'database'), true);
  assert.equal(canAccessPage('owner', 'settings'), true);
  assert.equal(canAccessPage('creative', 'database'), true);
  assert.equal(canAccessPage('creative', 'veto-lab'), false);
  // The org calendar narrowed to the roles that plan for the whole org;
  // everyone else schedules from the Planner in their team's hub.
  assert.equal(canAccessPage('creative', 'calendar'), false);
  assert.equal(canAccessPage('analyst', 'calendar'), false);
  assert.equal(canAccessPage('owner', 'calendar'), true);
  assert.equal(canAccessPage('coach', 'calendar'), true);
  assert.equal(canAccessPage('user', 'calendar'), false);
});
