const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('node:url');

const libUrl = (name) => pathToFileURL(path.join(__dirname, '..', 'src', 'renderer', 'lib', name)).href;

test('youtube watch, short and embed URLs become a player embed', async () => {
  const { parseVodUrl } = await import(libUrl('vodLink.js'));
  const watch = parseVodUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(watch.kind, 'youtube');
  assert.equal(watch.id, 'dQw4w9WgXcQ');
  assert.match(watch.embedUrl(12), /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
  assert.match(watch.stampUrl(90), /t=90s/);

  const short = parseVodUrl('https://youtu.be/dQw4w9WgXcQ?t=1m30s');
  assert.equal(short.kind, 'youtube');
  assert.equal(short.start, 90);
});

test('twitch VODs stamp a timestamp onto the watch link', async () => {
  const { parseVodUrl, fmtClock, parseClock } = await import(libUrl('vodLink.js'));
  const vod = parseVodUrl('https://www.twitch.tv/videos/123456789');
  assert.equal(vod.kind, 'twitch');
  assert.equal(vod.embedUrl, null);
  assert.equal(vod.stampUrl(125), 'https://www.twitch.tv/videos/123456789?t=0h2m5s');
  assert.equal(fmtClock(125), '2:05');
  assert.equal(parseClock('1:02:03'), 3723);
});

test('a fifth player defaults onto the bench', async () => {
  const { defaultSlot, splitRoster, isBench } = await import(libUrl('roster.js'));
  const members = [
    { id: '1', role: 'SMG' },
    { id: '2', role: 'AR' },
    { id: '3', role: 'Flex' },
    { id: '4', role: 'SMG' },
    { id: '5', role: 'Flex', slot: 'bench' },
    { id: 'c', role: 'Coach', slot: 'staff' },
    { id: 'a', title: 'Artist', role: 'Flex', slot: 'staff' },
  ];
  const split = splitRoster(members);
  assert.equal(split.starters.length, 4);
  assert.equal(split.bench.length, 1);
  assert.equal(split.staff.length, 2);
  assert.equal(defaultSlot(members), 'bench');
  assert.equal(isBench(members[4]), true);
});

test('a developer title does not kick a starter off the playing roster', async () => {
  const { splitRoster, isStaffMember } = await import(libUrl('roster.js'));
  const naevii = { id: 'n', gamertag: 'NaeviiSZN', title: 'Developer', role: 'Flex', slot: 'starter' };
  const playingCoach = { id: 'p', gamertag: 'Shotzzy', title: 'Player, Content Creator', role: 'SMG', slot: 'starter' };
  const staffOnly = { id: 's', gamertag: 'Sid', title: 'Head Coach', slot: 'staff' };
  const split = splitRoster([naevii, playingCoach, staffOnly]);
  assert.equal(isStaffMember(naevii), false);
  assert.equal(split.starters.map((m) => m.id).join(','), 'n,p');
  assert.equal(split.staff.map((m) => m.id).join(','), 's');
});

test('Naevii on a staff slot still lists with the starters', async () => {
  const { splitRoster, isStaffMember } = await import(libUrl('roster.js'));
  const naevii = { id: 'n', gamertag: 'NaeviiSZN', title: 'Developer', slot: 'staff' };
  const split = splitRoster([naevii]);
  assert.equal(isStaffMember(naevii), false);
  assert.equal(split.starters[0].id, 'n');
  assert.equal(split.staff.length, 0);
});
