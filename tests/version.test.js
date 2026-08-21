const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

test('release metadata and user-visible fallbacks are 1.5.3', () => {
  const pkg = require('../package.json');
  const html = fs.readFileSync(path.join(root, 'src', 'renderer', 'index.html'), 'utf8');
  const about = fs.readFileSync(path.join(root, 'src', 'renderer', 'pages', 'settings', 'sections', 'about.js'), 'utf8');
  const versioning = fs.readFileSync(path.join(root, 'docs', 'RELEASE_VERSIONING.md'), 'utf8');

  assert.equal(pkg.version, '1.5.3');
  assert.match(html, /Version 1\.5\.3/);
  assert.match(about, /1\.5\.3/);
  assert.match(versioning, /Major: `\+1`/);
  assert.match(versioning, /Minor: `\+0\.1`/);
  assert.match(versioning, /Mini: `\+0\.0\.1`/);
});
