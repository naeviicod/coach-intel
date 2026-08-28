const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('node:url');

const libUrl = pathToFileURL(path.join(__dirname, '..', 'src', 'renderer', 'lib', 'background.js')).href;
const assets = path.join(__dirname, '..', 'src', 'renderer', 'assets');

test('unknown or empty ids fall back to orbit', async () => {
  const { DEFAULT_BACKGROUND, resolveBackground } = await import(libUrl);
  assert.equal(DEFAULT_BACKGROUND, 'orbit');
  assert.equal(resolveBackground(null), 'orbit');
  assert.equal(resolveBackground(''), 'orbit');
  assert.equal(resolveBackground('nope'), 'orbit');
});

test('known background ids resolve as-is and cycle through every supplied option', async () => {
  const { BACKGROUND_OPTIONS, resolveBackground, backgroundOption, nextBackground } = await import(libUrl);
  assert.equal(resolveBackground('hex'), 'hex');
  assert.equal(resolveBackground('command-ring'), 'command-ring');
  assert.equal(backgroundOption('hex').src, 'backgrounds/hex.webp');
  assert.equal(backgroundOption('hex').name, 'Hex');
  assert.equal(backgroundOption('pit').src, null);
  assert.deepEqual(BACKGROUND_OPTIONS.map((opt) => opt.id), [
    'pit', 'hex', 'focus', 'command-ring', 'blackout', 'prism', 'vector', 'strata', 'hex-front', 'orbit',
  ]);
  assert.equal(nextBackground('pit'), 'hex');
  assert.equal(nextBackground('orbit'), 'pit');
});

test('the retired frame wallpaper maps onto hex', async () => {
  const { resolveBackground } = await import(libUrl);
  assert.equal(resolveBackground('frame'), 'hex');
  assert.equal(resolveBackground('lattice'), 'hex');
  assert.equal(resolveBackground('sector'), 'hex');
});

test('art files are real high-resolution WebP, not chat-compressed JPEGs', async () => {
  const { BACKGROUND_OPTIONS } = await import(libUrl);
  const ids = BACKGROUND_OPTIONS.map((opt) => opt.id);
  assert.deepEqual(ids, ['pit', 'hex', 'focus', 'command-ring', 'blackout', 'prism', 'vector', 'strata', 'hex-front', 'orbit']);
  // WebP's dimensions live at different byte offsets depending on which of its
  // sub-formats (VP8 / VP8L / VP8X) the encoder picked, so this checks the
  // container is genuinely WebP and large enough to be a real export, rather
  // than parsing the bitstream for exact pixels the way the old PNG check did.
  for (const opt of BACKGROUND_OPTIONS) {
    if (opt.id === 'pit') {
      assert.equal(opt.src, null);
      continue;
    }
    const file = path.join(assets, opt.src);
    assert.equal(fs.existsSync(file), true);
    const buf = fs.readFileSync(file);
    assert.equal(buf.subarray(0, 4).toString('ascii'), 'RIFF', `${opt.src} must be a WebP container`);
    assert.equal(buf.subarray(8, 12).toString('ascii'), 'WEBP', `${opt.src} must be a WebP container`);
    assert.ok(buf.length >= 20000, `${opt.src} must retain its supplied high-resolution export`);
  }
});

test('splash uses orbit art', async () => {
  const { DEFAULT_BACKGROUND, SPLASH_BACKGROUND, applyBackground, backgroundOption } = await import(libUrl);
  assert.equal(DEFAULT_BACKGROUND, 'orbit');
  assert.equal(SPLASH_BACKGROUND, 'orbit');
  assert.equal(applyBackground(DEFAULT_BACKGROUND), 'orbit');
  assert.equal(backgroundOption('orbit').src, 'backgrounds/orbit.webp');
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
  assert.equal(await preloadBackground('nope'), 'orbit');
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
    assert.equal(await preloadBackground('hex'), 'hex');
    assert.equal(calls.length, 2);
    assert.match(calls[0], /hex\.webp/);
    assert.equal(calls[1], 'decode');
  } finally {
    delete global.Image;
  }
});
