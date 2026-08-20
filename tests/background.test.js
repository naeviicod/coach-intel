const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('node:url');

const libUrl = pathToFileURL(path.join(__dirname, '..', 'src', 'renderer', 'lib', 'background.js')).href;
const assets = path.join(__dirname, '..', 'src', 'renderer', 'assets');

test('unknown or empty ids fall back to the pit', async () => {
  const { DEFAULT_BACKGROUND, resolveBackground } = await import(libUrl);
  assert.equal(DEFAULT_BACKGROUND, 'pit');
  assert.equal(resolveBackground(null), 'pit');
  assert.equal(resolveBackground(''), 'pit');
  assert.equal(resolveBackground('nope'), 'pit');
});

test('known background ids resolve as-is', async () => {
  const { resolveBackground, backgroundOption } = await import(libUrl);
  assert.equal(resolveBackground('hex'), 'hex');
  assert.equal(backgroundOption('hex').src, 'backgrounds/hex.png');
  assert.equal(backgroundOption('lattice').name, 'Lattice');
  assert.equal(backgroundOption('pit').src, null);
});

test('the retired frame wallpaper maps onto hex', async () => {
  const { resolveBackground } = await import(libUrl);
  assert.equal(resolveBackground('frame'), 'hex');
});

test('art files are real PNGs, not chat-compressed JPEGs', async () => {
  const { BACKGROUND_OPTIONS } = await import(libUrl);
  const ids = BACKGROUND_OPTIONS.map((opt) => opt.id);
  assert.deepEqual(ids, ['pit', 'hex', 'lattice']);
  const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  for (const opt of BACKGROUND_OPTIONS) {
    if (opt.id === 'pit') {
      assert.equal(opt.src, null);
      continue;
    }
    const file = path.join(assets, opt.src);
    assert.equal(fs.existsSync(file), true);
    const buf = fs.readFileSync(file);
    assert.equal(buf.subarray(0, 4).equals(pngMagic), true, `${opt.src} must be a PNG`);
    assert.ok(buf.readUInt32BE(16) >= 1920, `${opt.src} must be at least 1920px wide`);
  }
});

test('splash uses the pit so brand lime is never hue-rotated', async () => {
  const { DEFAULT_BACKGROUND, applyBackground, backgroundOption } = await import(libUrl);
  assert.equal(applyBackground(DEFAULT_BACKGROUND), 'pit');
  assert.equal(backgroundOption('pit').src, null);
});

test('frame art is pushed past the corners so the empty middle shrinks', async () => {
  const { BACKGROUND_OPTIONS, backgroundOption } = await import(libUrl);
  assert.equal(backgroundOption('pit').zoom, 1);
  for (const opt of BACKGROUND_OPTIONS.filter((o) => o.src)) {
    assert.ok(opt.zoom > 1, `${opt.id} must zoom past 1`);
    assert.ok(opt.zoom <= 1.5, `${opt.id} zoom must stay sane`);
  }
});

test('preloading the pit needs no Image and still resolves', async () => {
  const { preloadBackground } = await import(libUrl);
  assert.equal(await preloadBackground('pit'), 'pit');
  assert.equal(await preloadBackground('nope'), 'pit');
});

test('preloading art decodes before it resolves', async () => {
  const { preloadBackground } = await import(libUrl);
  const calls = [];
  global.Image = class {
    set src(value) {
      calls.push(value);
      setTimeout(() => this.onload(), 0);
    }
    decode() {
      calls.push('decode');
      return Promise.resolve();
    }
  };
  try {
    assert.equal(await preloadBackground('lattice'), 'lattice');
    assert.equal(calls.length, 2);
    assert.match(calls[0], /lattice\.png/);
    assert.equal(calls[1], 'decode');
  } finally {
    delete global.Image;
  }
});
