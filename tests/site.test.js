const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const site = path.join(__dirname, '..', 'docs', 'site');

test('the Coach Intel site opens the desktop app over coachintel://', () => {
  const html = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
  const open = fs.readFileSync(path.join(site, 'open.html'), 'utf8');
  assert.match(html, /href="coachintel:\/\/"/);
  assert.match(html, /Open Coach Intel/);
  assert.match(html, /Know More\. Win More\./);
  assert.match(open, /coachintel:\/\//);
  for (const name of ['logo-mark-base.webp', 'logo-mark-accent.webp', 'wordmark.webp', 'slogan.webp']) {
    assert.equal(fs.existsSync(path.join(site, 'assets', name)), true, `${name} must ship with the site`);
  }
});
