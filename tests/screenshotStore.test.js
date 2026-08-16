const test = require('node:test');
const assert = require('node:assert/strict');
const fss = require('fs');
const os = require('os');
const path = require('path');

const ROOT = fss.mkdtempSync(path.join(os.tmpdir(), 'cci-shots-'));
process.env.CCI_DATA_ROOT = ROOT;
const store = require('../src/main/screenshotStore');

const TEAM = 'naevii';
// 1x1 PNG
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
  'hex'
);

test.after(() => fss.rmSync(ROOT, { recursive: true, force: true }));

test('imports a png into the team inbox', async () => {
  const src = path.join(ROOT, 'board.png');
  fss.writeFileSync(src, PNG);
  const [item] = await store.importScoreboards(TEAM, { paths: [src] });
  assert.equal(item.teamId, TEAM);
  assert.equal(item.bucket, 'inbox');
  assert.match(item.filename, /\.png$/);
  assert.ok(fss.existsSync(path.join(ROOT, item.relative)));

  const pending = await store.listPending(TEAM);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].filename, item.filename);
});

test('rejects a non-image even with a png extension', async () => {
  const src = path.join(ROOT, 'fake.png');
  fss.writeFileSync(src, 'not an image');
  await assert.rejects(() => store.importScoreboards(TEAM, { paths: [src] }), /not a valid image/);
});

test('rejects path-like filenames on delete', async () => {
  await assert.rejects(() => store.deleteScoreboard(TEAM, '../secret.png'), /Invalid screenshot/);
});

test('files a folder tree into YYYY-MM-DD inbox folders', async () => {
  const root = path.join(ROOT, 'Scrim SBs', 'series', '14-08-2026');
  fss.mkdirSync(root, { recursive: true });
  fss.writeFileSync(path.join(root, 'IMG_3531.PNG'), PNG);
  const imported = await store.importScoreboards(TEAM, { folders: [path.join(ROOT, 'Scrim SBs')] });
  assert.equal(imported.length, 1);
  assert.equal(imported[0].date, '2026-08-14');
  assert.equal(imported[0].key, '2026-08-14/img-3531.png');
  assert.ok(fss.existsSync(path.join(ROOT, imported[0].relative)));
  assert.match(imported[0].relative, /inbox\/2026-08-14\/img-3531\.png$/);

  const pending = await store.listPending(TEAM);
  assert.ok(pending.some((item) => item.key === '2026-08-14/img-3531.png'));
  await store.deleteScoreboard(TEAM, '2026-08-14/img-3531.png');
  const after = await store.listPending(TEAM);
  assert.equal(after.some((item) => item.key === '2026-08-14/img-3531.png'), false);
});

test('parseDateFolder accepts EU and ISO folder names', () => {
  assert.equal(store.parseDateFolder('14-08-2026'), '2026-08-14');
  assert.equal(store.parseDateFolder('2026-08-15'), '2026-08-15');
  assert.equal(store.parseDateFolder('AEL - Season 3'), null);
});
