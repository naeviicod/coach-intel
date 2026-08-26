const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('node:url');

const libUrl = (name) => pathToFileURL(path.join(__dirname, '..', 'src', 'renderer', 'lib', name)).href;

test('NaeviiSZN / Naevii default to Super Admin', async () => {
  const { isNaevii, memberStaffTitle } = await import(libUrl('profile.js'));
  assert.equal(isNaevii('NaeviiSZN'), true);
  assert.equal(isNaevii('Naevii'), true);
  assert.equal(isNaevii('naevii.szn'), true);
  assert.equal(isNaevii('Ion'), false);
  assert.equal(memberStaffTitle({ gamertag: 'NaeviiSZN' }), 'Super Admin');
  assert.equal(memberStaffTitle({ name: 'Naevii', gamertag: 'VTX Naevii' }), 'Super Admin');
  assert.equal(memberStaffTitle({ gamertag: 'NaeviiSZN', title: 'Owner' }), 'Owner');
  assert.equal(memberStaffTitle({ gamertag: 'Shotzzy' }), '');
});

test('org role can list more than one job', async () => {
  const { orgTitles } = await import(libUrl('profile.js'));
  assert.deepEqual(orgTitles({ title: 'Player, Developer' }), ['Player', 'Developer']);
  assert.deepEqual(orgTitles({ gamertag: 'NaeviiSZN' }), ['Super Admin']);
});

test('org staff titles include creatives and ownership', async () => {
  const { isOrgStaffTitle } = await import(libUrl('profile.js'));
  assert.equal(isOrgStaffTitle('Artist'), true);
  assert.equal(isOrgStaffTitle('Graphic Designer'), true);
  assert.equal(isOrgStaffTitle('Super Admin'), true);
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
    { profileName: 'Org Chip', profileTitle: 'Org Title', profilePhoto: 'org/profile-photo.png' },
    {
      local: false,
      me: {
        display_name: 'Ion',
        title: 'Head Coach',
        discord_username: 'NaeviiSZN',
        photo: 'org/profiles/u.png',
        avatar_url: 'https://cdn.discordapp.com/a.png',
      },
    }
  );
  assert.equal(filled.name, 'Ion');
  assert.equal(filled.title, 'Head Coach');
  assert.equal(filled.photo, 'org/profiles/u.png');

  const discordFallback = chipIdentity(
    {},
    { local: false, me: { discord_username: 'NaeviiSZN' } }
  );
  assert.equal(discordFallback.name, 'NaeviiSZN');
  assert.equal(discordFallback.title, 'Super Admin');

  const local = chipIdentity({ coachName: 'Coach' }, { local: true, me: null });
  assert.equal(local.name, 'Coach');
  assert.equal(local.title, 'Local');
  assert.equal(local.verified, false);
  assert.equal(filled.verified, true);
  assert.equal(discordFallback.verified, true);
});

test('a Discord-linked member is confirmed', async () => {
  const { memberDiscordVerified } = await import(libUrl('profile.js'));
  assert.equal(memberDiscordVerified({ gamertag: 'Abloh' }), false);
  assert.equal(memberDiscordVerified({ gamertag: 'NaeviiSZN', user_id: 'u-1' }), true);
  assert.equal(memberDiscordVerified({ gamertag: 'vxlt', linked: { id: 'u-2', discord_username: 'vxlt' } }), true);
});
