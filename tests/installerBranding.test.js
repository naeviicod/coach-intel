const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.join(__dirname, '..');
const brandDir = path.join(root, 'build', 'installer-brand');
const generator = path.join(root, 'scripts', 'generate-installer-sidebar.js');
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const BACKGROUND_BGR = [19, 17, 13];

function nonBackgroundPixels(bmp, box) {
  const width = bmp.readInt32LE(18);
  const height = Math.abs(bmp.readInt32LE(22));
  const offset = bmp.readUInt32LE(10);
  const rowStride = Math.ceil((width * 3) / 4) * 4;
  let count = 0;
  for (let y = Math.max(0, box.y); y < Math.min(height, box.y + box.height); y++) {
    for (let x = Math.max(0, box.x); x < Math.min(width, box.x + box.width); x++) {
      const at = offset + (y * rowStride) + (x * 3);
      if (BACKGROUND_BGR.some((value, index) => bmp[at + index] !== value)) count++;
    }
  }
  return count;
}

test('release selection names Vantix and Rome and points to committed PNG marks', () => {
  const selection = JSON.parse(fs.readFileSync(path.join(brandDir, 'selection.json'), 'utf8'));
  assert.equal(selection.organization.name, 'Vantix');
  assert.equal(selection.team.name, 'Rome');

  for (const relative of [selection.organization.logo, selection.team.logo]) {
    const file = path.join(brandDir, relative);
    assert.equal(fs.existsSync(file), true, `${relative} must be committed`);
    assert.deepEqual(fs.readFileSync(file).subarray(0, 8), PNG_MAGIC);
  }
});

test('generator writes a 164 by 314 top-down 24-bit BMP with three visible marks', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'coach-intel-installer-brand-'));
  const output = path.join(temp, 'sidebar.bmp');
  const run = spawnSync(process.execPath, [generator, '--output', output], { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);

  const bmp = fs.readFileSync(output);
  assert.equal(bmp.toString('ascii', 0, 2), 'BM');
  assert.equal(bmp.readInt32LE(18), 164);
  assert.equal(bmp.readInt32LE(22), -314);
  assert.equal(bmp.readUInt16LE(28), 24);
  for (const box of [
    { x: 52, y: 16, width: 60, height: 60 },
    { x: 27, y: 86, width: 110, height: 110 },
    { x: 32, y: 203, width: 100, height: 100 },
  ]) {
    assert.ok(nonBackgroundPixels(bmp, box) > 40, `${JSON.stringify(box)} must contain a logo`);
  }
});

test('generator rejects a selected logo that does not exist', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'coach-intel-installer-brand-'));
  const config = path.join(temp, 'selection.json');
  fs.writeFileSync(config, JSON.stringify({
    organization: { name: 'Vantix', logo: 'missing.png' },
    team: { name: 'Rome', logo: 'missing.png' },
  }));

  const run = spawnSync(process.execPath, [generator, '--config', config, '--output', path.join(temp, 'sidebar.bmp')], { cwd: root, encoding: 'utf8' });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /Unable to read selected organization logo/);
});
