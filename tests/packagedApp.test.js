const test = require('node:test');
const assert = require('node:assert/strict');
const { shouldClaimProtocol, packagedAppPath } = require('../src/main/packagedApp');

test('the packaged app always lives in /Applications', () => {
  assert.equal(packagedAppPath(), '/Applications/Coach Intel.app');
});

test('the packaged app claims coachintel://', () => {
  assert.equal(shouldClaimProtocol(true, true), true);
  assert.equal(shouldClaimProtocol(true, false), true);
});

test('dev Electron does not steal the scheme once /Applications has Coach Intel', () => {
  assert.equal(shouldClaimProtocol(false, true), false);
});

test('dev Electron may claim the scheme only when the packaged app is missing', () => {
  assert.equal(shouldClaimProtocol(false, false), true);
});
