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

test('splash keeps the separate brand assets in the supplied horizontal lockup', () => {
  const html = fs.readFileSync(index, 'utf8');
  const styles = fs.readFileSync(path.join(renderer, 'styles.css'), 'utf8');

  assert.match(html, /class="splash-logo-mark-frame"/);
  assert.match(html, /class="splash-lockup-copy"/);
  assert.match(html, /class="splash-wordmark-frame"/);
  assert.match(html, /class="splash-slogan-frame"/);
  assert.match(styles, /grid-template-columns:\s*minmax\(210px, 0\.5fr\) minmax\(0, 1fr\)/);
  assert.match(styles, /\.splash-slogan-frame \{\s*width: 100%/);
});

test('the splash logo has a staged GPU-only entrance that is visible before handoff', () => {
  const styles = fs.readFileSync(path.join(renderer, 'styles.css'), 'utf8');

  for (const name of ['splashMarkIn', 'splashCopyIn', 'splashSloganIn', 'splashLogoScan']) {
    assert.match(styles, new RegExp(`@keyframes ${name}`), `${name} must exist`);
  }
  assert.match(styles, /\.splash-logo-mark-frame \{[\s\S]{0,400}animation:\s*splashMarkIn 760ms/);
  assert.match(styles, /\.splash-lockup-copy \{[\s\S]{0,400}animation:\s*splashCopyIn 780ms/);
  assert.match(styles, /\.splash-slogan-frame \{[\s\S]{0,400}animation:\s*splashSloganIn 480ms/);
  assert.match(styles, /\.splash-logo::after \{[\s\S]{0,500}animation:\s*splashLogoScan 900ms/);
  assert.match(styles, /will-change:\s*transform, opacity/);
});

test('the splash has a visible premium exit while the CI mark carries into the gate', () => {
  const styles = fs.readFileSync(path.join(renderer, 'styles.css'), 'utf8');
  const app = fs.readFileSync(path.join(renderer, 'app.js'), 'utf8');
  const signIn = fs.readFileSync(path.join(renderer, 'pages', 'signIn.js'), 'utf8');

  assert.match(styles, /#splash\.landed \.splash-logo/);
  assert.match(styles, /animation:\s*splashLockupExit 360ms/);
  assert.match(styles, /@keyframes splashLockupExit/);
  assert.doesNotMatch(styles, /@keyframes splashLockupExit[\s\S]{0,500}filter:/, 'the exit must stay on compositor-friendly properties');

  const fade = Number(app.match(/const SPLASH_FADE_MS = (\d+)/)[1]);
  const dur = Number(styles.match(/--dur-splash:\s*(\d+)ms/)[1]);
  assert.equal(fade, dur, 'the JS settle must match the CSS fade');
  assert.equal(fade, 360);
  assert.match(app, /const HAND_OFF_MS = 520/);
  assert.match(signIn, /asset\('splash-logo\.png'\)/);
});

test('the splash background visibly moves during the five-second splash window', () => {
  const styles = fs.readFileSync(path.join(renderer, 'styles.css'), 'utf8');
  const html = fs.readFileSync(index, 'utf8');

  assert.match(html, /class="splash-glow"/);
  assert.match(html, /class="splash-sweep"/);
  for (const name of ['splashDrift', 'splashBreath', 'splashSweep']) {
    assert.match(styles, new RegExp(`@keyframes ${name}`), `${name} must exist`);
  }
  const durations = [...styles.matchAll(/animation: (splashDrift|splashBreath|splashSweep) ([\d.]+)s/g)];
  assert.equal(durations.length, 3);
  const secondsByName = Object.fromEntries(durations.map(([, name, secs]) => [name, Number(secs)]));
  assert.ok(secondsByName.splashDrift <= 16, 'the background should move perceptibly during the splash');
  assert.ok(secondsByName.splashBreath <= 4, 'the HUD glow should complete a visible pulse');
  assert.ok(secondsByName.splashSweep <= 6, 'the light sweep should cross before handoff');
  assert.match(styles, /\.splash-background,\s*\.splash-glow,\s*\.splash-sweep/);
});

test('the About lockup paints the accent rather than filtering towards it', () => {
  const styles = fs.readFileSync(path.join(renderer, 'styles.css'), 'utf8');
  const about = fs.readFileSync(path.join(renderer, 'pages', 'settings', 'sections', 'about.js'), 'utf8');

  for (const name of ['logo-mark-base.png', 'logo-mark-accent.png']) {
    const file = path.join(assets, name);
    assert.equal(fs.existsSync(file), true, `${name} must be bundled`);
    assert.equal(fs.readFileSync(file).subarray(0, 4).equals(pngMagic), true, `${name} must be a PNG`);
  }
  assert.match(about, /ci-lockup/);
  assert.equal(about.includes("class: 'brand-tint'"), false, 'the hue-rotate approximation is gone');
  assert.match(styles, /\.ci-lockup-accent[^}]*background: var\(--accent\)/);
});
