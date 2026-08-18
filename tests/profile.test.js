const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('node:url');

const libUrl = (name) => pathToFileURL(path.join(__dirname, '..', 'src', 'renderer', 'lib', name)).href;

test('NaeviiSZN / Naevii default to Developer', async () => {
  const { isNaevii, memberStaffTitle } = await import(libUrl('profile.js'));
  assert.equal(isNaevii('NaeviiSZN'), true);
  assert.equal(isNaevii('Naevii'), true);
  assert.equal(isNaevii('naevii.szn'), true);
  assert.equal(isNaevii('Ion'), false);
  assert.equal(memberStaffTitle({ gamertag: 'NaeviiSZN' }), 'Developer');
  assert.equal(memberStaffTitle({ name: 'Naevii', gamertag: 'VTX Naevii' }), 'Developer');
  assert.equal(memberStaffTitle({ gamertag: 'NaeviiSZN', title: 'Owner' }), 'Owner');
  assert.equal(memberStaffTitle({ gamertag: 'Shotzzy' }), '');
});

test('org role can list more than one job', async () => {
  const { orgTitles } = await import(libUrl('profile.js'));
  assert.deepEqual(orgTitles({ title: 'Player, Developer' }), ['Player', 'Developer']);
  assert.deepEqual(orgTitles({ gamertag: 'NaeviiSZN' }), ['Developer']);
});

test('org staff titles include creatives and ownership', async () => {
  const { isOrgStaffTitle } = await import(libUrl('profile.js'));
  assert.equal(isOrgStaffTitle('Artist'), true);
  assert.equal(isOrgStaffTitle('Graphic Designer'), true);
  assert.equal(isOrgStaffTitle('Org Owner'), true);
  assert.equal(isOrgStaffTitle('Admin'), true);
  assert.equal(isOrgStaffTitle('Content Creator'), true);
  assert.equal(isOrgStaffTitle('Player'), false);
  assert.equal(isOrgStaffTitle(''), false);
});

test('handles keep known social and gaming ids', async () => {
  const { normalizeHandles } = await import(libUrl('profile.js'));
  const handles = normalizeHandles({
    activision: ' Naevii#1234567 ',
    checkmate: 'checkmategaming.com/player/naevii',
    discord: 'naeviiszn',
    junk: 'nope',
    twitter: '',
  });
  assert.equal(handles.activision, 'Naevii#1234567');
  assert.equal(handles.checkmate, 'checkmategaming.com/player/naevii');
  assert.equal(handles.discord, 'naeviiszn');
  assert.equal(handles.junk, undefined);
  assert.equal(handles.twitter, undefined);
});

test('top-bar chip uses the signed-in person, not a generic Coach', async () => {
  const { chipIdentity } = await import(libUrl('profile.js'));
  const filled = chipIdentity(
    { profileName: 'Ion', profileTitle: 'Head Coach', profilePhoto: 'org/profile-photo.png' },
    { local: false, me: { discord_username: 'NaeviiSZN', avatar_url: 'https://cdn.discordapp.com/a.png' } }
  );
  assert.equal(filled.name, 'Ion');
  assert.equal(filled.title, 'Head Coach');
  assert.equal(filled.photo, 'org/profile-photo.png');

  const discordFallback = chipIdentity(
    {},
    { local: false, me: { discord_username: 'NaeviiSZN' } }
  );
  assert.equal(discordFallback.name, 'NaeviiSZN');
  assert.equal(discordFallback.title, 'Developer');

  const local = chipIdentity({ coachName: 'Coach' }, { local: true, me: null });
  assert.equal(local.name, 'Coach');
  assert.equal(local.title, 'Local');
  assert.equal(local.verified, false);
  assert.equal(filled.verified, true);
  assert.equal(discordFallback.verified, true);
});
