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
  assert.equal(inviteUrl('abc_DEF-1234567890'), 'https://coach.championshipseries.eu/join/abc_DEF-1234567890');
});

test('a personal invite names the org and the person', async () => {
  const webUrl = pathToFileURL(path.join(__dirname, '..', 'web', 'lib', 'invite.js')).href;
  const { inviteCopy, normalizeInviteEmail } = await import(webUrl);
  const named = inviteCopy({
    org_name: 'Phantix',
    invitee_email: 'xx@gmail.com',
    gamertag: 'Bracke',
    team_name: 'CDL',
    access_role: 'user',
  });
  assert.equal(named.title, 'Join Phantix');
  assert.match(named.body, /You've been selected, xx@gmail\.com, to be part of Phantix on Coach Intel/);
  assert.match(named.detail, /Bracke/);
  const byTag = inviteCopy({ org_name: 'VANTIX', gamertag: 'Rome', team_name: 'Challengers', access_role: 'coach' });
  assert.match(byTag.body, /You've been selected, Rome, to be part of VANTIX on Coach Intel/);
  assert.equal(normalizeInviteEmail('  xx@Gmail.com '), 'xx@gmail.com');
  assert.throws(() => normalizeInviteEmail('not-an-email'), /email/);
});

test('a provisioned org never reopens first-run setup', async () => {
  const { shouldRunOnboarding, shouldRunUnlinked, orgIsProvisioned } = await import(libUrl('orgLock.js'));
  assert.equal(orgIsProvisioned({ name: 'VANTIX' }), true);
  assert.equal(orgIsProvisioned({ locked: true, name: 'My Organization' }), true);
  assert.equal(shouldRunOnboarding({ org: { name: 'VANTIX' }, teams: [], signedIn: true }), false);
  assert.equal(shouldRunOnboarding({ org: { name: 'VANTIX' }, teams: [], signedIn: false }), false);
  assert.equal(shouldRunOnboarding({ org: { name: 'My Organization' }, teams: [], signedIn: false }), true);
  assert.equal(shouldRunUnlinked({ org: { name: 'My Organization' }, teams: [], signedIn: true }), true);
  assert.equal(shouldRunUnlinked({ org: { name: 'VANTIX' }, teams: [], signedIn: true }), false);
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
