const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('node:url');

const libUrl = (name) => pathToFileURL(path.join(__dirname, '..', 'src', 'renderer', 'lib', name)).href;

test('staff titles pick an invite access role', async () => {
  const { suggestedAccessRole, accessRoleLabel, inviteUrl } = await import(libUrl('invite.js'));
  assert.equal(suggestedAccessRole({ title: 'Free Agent' }), 'free_agent');
  assert.equal(suggestedAccessRole({ slot: 'fa' }), 'free_agent');
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
  assert.equal(
    inviteUrl('abc_DEF-1234567890', 'Bracke'),
    'https://coach.championshipseries.eu/join/bracke/abc_DEF-1234567890'
  );
});

test('a personal invite names the org and the gamertag', async () => {
  const webUrl = pathToFileURL(path.join(__dirname, '..', 'web', 'lib', 'invite.js')).href;
  const { inviteCopy, normalizeInviteEmail, inviteeSlug, joinUrl } = await import(webUrl);
  const named = inviteCopy({
    org_name: 'Phantix',
    invitee_email: 'xx@gmail.com',
    gamertag: 'Bracke',
    team_name: 'CDL',
    access_role: 'user',
  });
  assert.equal(named.kicker, "You've been invited");
  assert.equal(named.title, 'Join Phantix');
  assert.equal(named.body, "Bracke, you've been invited to Phantix on Coach Intel.");
  assert.doesNotMatch(named.body, /xx@gmail/);
  assert.match(named.detail, /CDL/);
  const byTag = inviteCopy({ org_name: 'VANTIX', gamertag: 'Rome', team_name: 'Challengers', access_role: 'coach' });
  assert.equal(byTag.body, "Rome, you've been invited to VANTIX on Coach Intel.");
  const starter = inviteCopy({
    org_name: 'Vantix',
    gamertag: 'NaeviiSZN',
    team_name: 'Rome',
    play_role: 'SMG',
    slot: 'starter',
    access_role: 'user',
  });
  assert.match(starter.body, /as SMG on Rome's main roster/);
  assert.match(starter.detail, /Main roster/);
  assert.match(starter.detail, /SMG/);
  const bench = inviteCopy({
    org_name: 'Vantix',
    gamertag: 'Abloh',
    team_name: 'Rome',
    play_role: 'Main AR',
    slot: 'bench',
    access_role: 'user',
  });
  assert.match(bench.body, /as Main AR on Rome's bench/);
  assert.match(bench.detail, /Bench/);
  assert.equal(normalizeInviteEmail('  xx@Gmail.com '), 'xx@gmail.com');
  assert.throws(() => normalizeInviteEmail('not-an-email'), /email/);
  assert.equal(inviteeSlug('Bracke'), 'bracke');
  assert.equal(inviteeSlug('VTX Bracke'), 'vtx-bracke');
  assert.equal(joinUrl('abc_DEF-1234567890', 'Bracke'), 'https://coach.championshipseries.eu/join/bracke/abc_DEF-1234567890');
});

test('session identity prefers the linked roster slot over Discord, then Settings overrides', async () => {
  const { sessionIdentity } = await import(pathToFileURL(path.join(__dirname, '..', 'web', 'lib', 'identity.js')).href);
  const linked = sessionIdentity({
    user: { id: 'u1', user_metadata: { full_name: 'DiscordName' } },
    profile: { role: 'member', discord_username: 'DiscordName' },
    members: [{ user_id: 'u1', gamertag: 'Bracke', title: 'Player' }],
  });
  assert.equal(linked.name, 'Bracke');
  assert.equal(linked.title, 'Player');

  const renamed = sessionIdentity({
    user: { id: 'u1' },
    profile: { role: 'member', display_name: 'Rome', title: 'IGL', discord_username: 'DiscordName' },
    members: [{ user_id: 'u1', gamertag: 'Bracke', title: 'Player' }],
  });
  assert.equal(renamed.name, 'Rome');
  assert.equal(renamed.title, 'IGL');

  const unlinked = sessionIdentity({
    user: { id: 'u2', user_metadata: { full_name: 'Coach' } },
    profile: { role: 'owner', discord_username: 'Coach' },
    members: [{ user_id: 'u1', gamertag: 'Bracke' }],
    org: { profileName: 'Naevii', profileTitle: 'Developer' },
  });
  assert.equal(unlinked.name, 'Naevii');
  assert.equal(unlinked.title, 'Developer');

  const playerIgnoresOrgChip = sessionIdentity({
    user: { id: 'u1', user_metadata: { full_name: 'DiscordName' } },
    profile: { role: 'member', discord_username: 'DiscordName' },
    members: [{ user_id: 'u1', gamertag: 'Bracke', title: 'Player' }],
    org: { profileName: 'Naevii', profileTitle: 'Developer' },
  });
  assert.equal(playerIgnoresOrgChip.name, 'Bracke');
  assert.equal(playerIgnoresOrgChip.title, 'Player');
});

test('the invite email is signed for the invitee and uses Coach Intel marks', async () => {
  const webUrl = pathToFileURL(path.join(__dirname, '..', 'web', 'lib', 'invite-email.js')).href;
  const { inviteEmailSubject, renderInviteEmail } = await import(webUrl);
  assert.equal(inviteEmailSubject({ who: 'Ion', org: 'Vantix' }), "Ion, you've been invited to Vantix");
  const html = renderInviteEmail({
    who: 'Ion',
    email: 'ion@ikstudios.nl',
    org: 'Vantix',
    team: 'Rome',
    role: 'Player',
  });
  assert.match(html, /Coach Intel/);
  assert.match(html, /bgcolor="#14181c"/);
  assert.match(html, /bgcolor="#ebe6d6"/);
  assert.match(html, /bgcolor="#b6f542"/);
  assert.match(html, /border-radius:24px/);
  assert.match(html, /border-radius:999px/);
  assert.doesNotMatch(html, /<img/i);
  assert.match(html, /Ion, you've been invited to Vantix on Coach Intel/);
  assert.match(html, /ion@ikstudios\.nl/);
  assert.match(html, /Know More\. Win More/);
  assert.match(html, /Signed for/);
  assert.match(html, /#b6f542/);
  assert.match(html, /bgcolor="#1c2127"[\s\S]*color:#f4f6f8[\s\S]*You've been invited[\s\S]*bgcolor="#ebe6d6"/);
  assert.match(html, /https:\/\/coach\.championshipseries\.eu\/join\/preview/);
  assert.doesNotMatch(html, /localhost/);
});

test('a Vantix invite can carry the org and team logos', async () => {
  const webUrl = pathToFileURL(path.join(__dirname, '..', 'web', 'lib', 'invite-email.js')).href;
  const { renderInviteEmail } = await import(webUrl);
  const html = renderInviteEmail({
    who: 'NaeviiSZN',
    email: 'ion@ikstudios.nl',
    org: 'Vantix',
    team: 'Rome',
    role: 'Player',
    playRole: 'SMG',
    slot: 'starter',
    url: 'https://coach.championshipseries.eu/join/naeviiszn/preview',
    accent: '#e10600',
    ciLogoSrc: 'cid:ci-logo',
    wordmarkSrc: 'cid:ci-wordmark',
    orgLogoSrc: 'cid:org-logo',
    teamLogoSrc: 'cid:team-logo',
  });
  assert.match(html, /cid:ci-logo/);
  assert.match(html, /cid:ci-wordmark/);
  assert.match(html, /cid:org-logo/);
  assert.match(html, /cid:team-logo/);
  assert.match(html, /alt="Coach Intel"/);
  assert.match(html, /border-radius:54px/);
  assert.match(html, /border-radius:36px/);
  assert.match(html, /alt="Vantix"/);
  assert.match(html, /alt="Rome"/);
  assert.match(html, /NaeviiSZN, you've been invited to Vantix on Coach Intel as SMG on Rome(&#39;|')s main roster/);
  assert.match(html, /Main roster/);
  assert.match(html, />SMG</);
  assert.match(html, /bgcolor="#e10600"/);
  assert.doesNotMatch(html, /#b6f542/);
  assert.match(html, /bgcolor="#1c2127"[\s\S]*color:#f4f6f8[\s\S]*You've been invited[\s\S]*bgcolor="#ebe6d6"/);
  assert.match(html, /https:\/\/coach\.championshipseries\.eu\/join\/naeviiszn\/preview/);
});

test('preview and personal join links are the live site', async () => {
  const webUrl = pathToFileURL(path.join(__dirname, '..', 'web', 'lib', 'invite.js')).href;
  const { previewJoinUrl, joinUrl } = await import(webUrl);
  assert.equal(previewJoinUrl(), 'https://coach.championshipseries.eu/join/preview');
  assert.equal(previewJoinUrl('NaeviiSZN'), 'https://coach.championshipseries.eu/join/naeviiszn/preview');
  assert.equal(
    joinUrl('abc_DEF-1234567890', 'Abloh'),
    'https://coach.championshipseries.eu/join/abloh/abc_DEF-1234567890'
  );
  assert.doesNotMatch(previewJoinUrl(), /localhost/);
});

test('invite copy and email read org and roster from the app', async () => {
  const webUrl = pathToFileURL(path.join(__dirname, '..', 'web', 'lib', 'app-invite.js')).href;
  const { buildInviteFromApp, orgDisplayName } = await import(webUrl);
  assert.equal(orgDisplayName({ name: 'Vantix', tag: 'VTX' }), 'Vantix');
  const invite = buildInviteFromApp({
    org: { name: 'Vantix', tag: 'VTX', accent: '#e10600' },
    teams: [{ id: 'rome', name: 'Rome' }],
    members: [
      { gamertag: 'Abloh', title: 'Player' },
      { gamertag: 'NaeviiSZN', name: 'Naevii', role: 'SMG', slot: 'starter', team_id: 'rome' },
    ],
    who: 'NaeviiSZN',
    email: 'ion@ikstudios.nl',
  });
  assert.equal(invite.org_name, 'Vantix');
  assert.equal(invite.team_name, 'Rome');
  assert.equal(invite.gamertag, 'NaeviiSZN');
  assert.equal(invite.play_role, 'SMG');
  assert.equal(invite.slot, 'starter');
  assert.equal(invite.invitee_email, 'ion@ikstudios.nl');
  assert.equal(invite.accent, '#e10600');
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

test('players do not see every team; team leaders see them but only edit their own', async () => {
  const { seesAllTeams, canAccessPage, canEditTeam, canTransferMembers, isStaff } = await import(libUrl('access.js'));
  assert.equal(seesAllTeams('owner'), true);
  assert.equal(seesAllTeams('admin'), true);
  assert.equal(seesAllTeams('coach'), true);
  assert.equal(seesAllTeams('analyst'), true);
  assert.equal(seesAllTeams('team_leader'), true);
  assert.equal(seesAllTeams('user'), false);
  assert.equal(seesAllTeams('member'), false);
  assert.equal(seesAllTeams('creative'), true);
  assert.equal(isStaff('admin'), true);
  assert.equal(isStaff('owner'), true);
  assert.equal(isStaff('creative'), false);
  assert.equal(canEditTeam('team_leader', 'rome', { teamIds: ['rome'] }), true);
  assert.equal(canEditTeam('team_leader', 'other', { teamIds: ['rome'] }), false);
  const { canEdit } = await import(libUrl('access.js'));
  assert.equal(canEdit('team_leader'), false);
  assert.equal(canEdit('coach'), true);
  assert.equal(canTransferMembers('team_leader'), false);
  assert.equal(canTransferMembers('admin'), true);
  assert.equal(canAccessPage('admin', 'war-room'), true);
  assert.equal(canAccessPage('admin', 'database'), true);
  assert.equal(canAccessPage('owner', 'settings'), true);
  assert.equal(canAccessPage('creative', 'database'), true);
  assert.equal(canAccessPage('creative', 'veto-lab'), false);
  // Staff — including team leaders — keep the org calendar on Main.
  // Players, analysts and creatives schedule from the team hub Planner.
  assert.equal(canAccessPage('creative', 'calendar'), false);
  assert.equal(canAccessPage('analyst', 'calendar'), false);
  assert.equal(canAccessPage('owner', 'calendar'), true);
  assert.equal(canAccessPage('coach', 'calendar'), true);
  assert.equal(canAccessPage('team_leader', 'calendar'), true);
  assert.equal(canAccessPage('user', 'calendar'), false);
});

test('players keep Main dashboard and Intel Feed; tools stay with org admins', async () => {
  const { canAccessPage } = await import(libUrl('access.js'));
  assert.equal(canAccessPage('user', 'dashboard'), true);
  assert.equal(canAccessPage('user', 'intel-feed'), true);
  assert.equal(canAccessPage('user', 'tasks'), false);
  assert.equal(canAccessPage('user', 'maps-modes'), false);
  assert.equal(canAccessPage('user', 'integrations'), false);
  assert.equal(canAccessPage('developer', 'integrations'), true);
  assert.equal(canAccessPage('owner', 'maps-modes'), true);
});

test('signing in as Naevii or NaeviiSZN is full developer access', async () => {
  const { accessFromProfile, canEditTeam, canTransferMembers } = await import(libUrl('access.js'));
  const access = accessFromProfile({ role: 'user', discord_username: 'Naevii' }, { teamIds: [] });
  assert.equal(access.role, 'developer');
  assert.equal(access.canEdit, true);
  assert.equal(canEditTeam(access.role, 'rome', { teamIds: [] }), true);
  assert.equal(canTransferMembers(access.role), true);
  const fromSlot = accessFromProfile({ role: 'member' }, { linkedNames: ['NaeviiSZN'] });
  assert.equal(fromSlot.role, 'developer');
});
