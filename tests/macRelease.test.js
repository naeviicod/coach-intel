const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('mac packaging creates immutable universal DMG and ZIP artifacts with hardened signing configuration', () => {
  const pkg = require(path.join(root, 'package.json'));
  assert.equal(pkg.build.appId, 'com.naevii.coachintel');
  assert.equal(pkg.build.mac.artifactName, 'Coach-Intel-${version}-macOS.${ext}');
  assert.equal(pkg.build.mac.hardenedRuntime, true);
  assert.equal(pkg.build.mac.notarize, true);
  assert.equal(pkg.build.mac.entitlements, 'build/entitlements.mac.plist');
  assert.equal(pkg.build.mac.entitlementsInherit, 'build/entitlements.mac.inherit.plist');
  assert.deepEqual(pkg.build.mac.target.map((target) => target.target), ['dmg', 'zip']);
  assert.deepEqual(pkg.build.mac.target.map((target) => target.arch), [['universal'], ['universal']]);
  assert.equal(pkg.build.dmg.background, 'src/renderer/assets/splash-background.webp');
  assert.match(read('build/Install Coach Intel.txt'), /Drag Coach Intel to the Applications folder/);
  assert.equal(fs.existsSync(path.join(root, 'build', 'icon.icns')), true);
});

test('the mac build script packages only and never mutates /Applications or post-signs an app', () => {
  const script = read('scripts/dist-mac.sh');
  assert.match(script, /electron-builder --mac --universal --publish never/);
  assert.match(script, /unsigned development artifacts/);
  assert.doesNotMatch(script, /\/Applications\//);
  assert.doesNotMatch(script, /codesign --force/);
  assert.doesNotMatch(script, /rm -rf/);
});

test('CI discovers tests on Node 20 and publishes Windows even when macOS signing is skipped', () => {
  const pkg = require(path.join(root, 'package.json'));
  const workflow = read('.github/workflows/release.yml');
  assert.equal(pkg.scripts.test, 'node scripts/run-tests.js');
  assert.match(workflow, /if: always\(\) && startsWith\(github\.ref, 'refs\/tags\/v'\) && needs\.release-windows\.result == 'success'/);
  assert.match(workflow, /CSC_IDENTITY_AUTO_DISCOVERY: false/);
  assert.match(workflow, /continue-on-error: true/);
});

test('Electron keeps auth tokens out of the renderer and uses hardened browser boundaries', () => {
  const main = read('src/main/main.js');
  const preload = read('src/main/preload.js');
  const store = read('src/main/supabase/store.js');
  assert.match(main, /sandbox: true/);
  assert.match(main, /setWindowOpenHandler/);
  assert.match(main, /will-navigate/);
  assert.match(main, /setPermissionRequestHandler/);
  assert.match(main, /rendererAuthState/);
  assert.match(main, /session: session \? \{ authenticated: true \} : null/);
  assert.match(preload, /desktopSetup/);
  assert.match(store, /allowInsecureStorage = false/);
  assert.match(store, /production session persistence is disabled/);
});
