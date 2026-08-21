const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const renderer = path.join(__dirname, '..', 'src', 'renderer');
const assets = path.join(renderer, 'assets');
const index = path.join(renderer, 'index.html');
const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

test('splash uses the supplied branded background and identity assets', () => {
  const names = [
    'splash-background.png',
    'splash-logo.png',
    'splash-wordmark.png',
    'splash-slogan.png',
  ];

  for (const name of names) {
    const file = path.join(assets, name);
    assert.equal(fs.existsSync(file), true, `${name} must be bundled`);
    assert.equal(fs.readFileSync(file).subarray(0, 4).equals(pngMagic), true, `${name} must be a PNG`);
  }

  const html = fs.readFileSync(index, 'utf8');
  assert.match(html, /splash-background\.png/);
  assert.match(html, /splash-logo\.png/);
  assert.match(html, /splash-wordmark\.png/);
  assert.match(html, /splash-slogan\.png/);
  assert.match(html, /alt="Coach Intel logo"/);
  assert.match(html, /alt="Coach Intel"/);
  assert.match(html, /alt="Competitive Intelligence for Call of Duty"/);
});
