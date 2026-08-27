const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

test('release metadata and user-visible fallbacks are 3.8.0', () => {
  const pkg = require('../package.json');
  const webPkg = require('../web/package.json');
  const html = fs.readFileSync(path.join(root, 'src', 'renderer', 'index.html'), 'utf8');
  const about = fs.readFileSync(path.join(root, 'src', 'renderer', 'pages', 'settings', 'sections', 'about.js'), 'utf8');
  const shell = fs.readFileSync(path.join(root, 'web', 'components', 'desktop-shell.js'), 'utf8');
  const versioning = fs.readFileSync(path.join(root, 'docs', 'RELEASE_VERSIONING.md'), 'utf8');

  assert.equal(pkg.version, '3.8.0');
  assert.equal(webPkg.version, '3.8.0');
  assert.match(html, /Version 3\.8\.0/);
  assert.match(about, /3\.8\.0/);
  assert.match(shell, /v3\.8\.0/);
  assert.match(versioning, /Major: `\+1`/);
  assert.match(versioning, /Minor: `\+0\.1`/);
  assert.match(versioning, /Mini: `\+0\.0\.1`/);
});
