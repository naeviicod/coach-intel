const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const brandDir = path.join(root, 'build', 'installer-brand');
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

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
