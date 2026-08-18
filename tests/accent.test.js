const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('node:url');

const libUrl = pathToFileURL(path.join(__dirname, '..', 'src', 'renderer', 'lib', 'accent.js')).href;

test('first launch uses lime even if a leftover org accent exists', async () => {
  const { DEFAULT_ACCENT, resolveAccent } = await import(libUrl);
  assert.equal(DEFAULT_ACCENT, '#b6f542');
  assert.equal(resolveAccent({ firstLaunch: true, org: '#ff0000' }), DEFAULT_ACCENT);
});

test('an invite accent wins so invited users adapt to the org color', async () => {
  const { resolveAccent } = await import(libUrl);
  assert.equal(
    resolveAccent({ firstLaunch: true, invite: '#9b8cff', org: '#ff0000', shared: '#e8c15a' }),
    '#9b8cff'
  );
});

test('shared team accent is used when this machine has no org color yet', async () => {
  const { resolveAccent } = await import(libUrl);
  assert.equal(resolveAccent({ shared: '#5ee0b0', org: null }), '#5ee0b0');
});

test('org accent is used once the app is past first launch', async () => {
  const { resolveAccent } = await import(libUrl);
  assert.equal(resolveAccent({ org: '#e87a6a' }), '#e87a6a');
});

test('missing or invalid colors fall back to lime', async () => {
  const { DEFAULT_ACCENT, resolveAccent, normalizeHex } = await import(libUrl);
  assert.equal(resolveAccent({}), DEFAULT_ACCENT);
  assert.equal(resolveAccent({ org: 'red', shared: 'nope' }), DEFAULT_ACCENT);
  assert.equal(normalizeHex('#B6F542'), '#b6f542');
  assert.equal(normalizeHex('ff0000'), '#ff0000');
  assert.equal(normalizeHex('not-a-color'), null);
});
