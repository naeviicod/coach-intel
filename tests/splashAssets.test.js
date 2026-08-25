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
  assert.match(styles, /grid-template-columns:\s*auto auto/);
  assert.match(styles, /--lockup-h:\s*min\(248px, 21vw\)/);
  assert.match(styles, /--mark-nudge:\s*-10px/);
  assert.match(styles, /width:\s*calc\(var\(--lockup-h\) \* 2\.38\)/);
  assert.match(styles, /column-gap:\s*clamp\(4px, 0\.7vw, 10px\)/);
  assert.match(styles, /\.splash-slogan-frame \{\s*width: 100%/);
});

test('the splash logo has a staged GPU-only entrance that is visible before handoff', () => {
  const styles = fs.readFileSync(path.join(renderer, 'styles.css'), 'utf8');

  for (const name of ['splashVeilLift', 'splashFrostLift', 'splashMarkIn', 'splashCopyIn', 'splashSloganIn']) {
    assert.match(styles, new RegExp(`@keyframes ${name}`), `${name} must exist`);
  }
  assert.match(styles, /\.splash-veil \{[\s\S]{0,280}opacity:\s*0\.72/);
  assert.match(styles, /\.splash-veil \{[\s\S]{0,320}animation:\s*splashVeilLift 650ms/);
  assert.match(styles, /\.splash-frost \{[\s\S]{0,500}filter:\s*blur\(48px\) brightness\(0\.28\)/);
  assert.match(styles, /\.splash-frost \{[\s\S]{0,700}splashFrostLift 650ms/);
  assert.match(styles, /\.splash-logo-mark-frame \{[\s\S]{0,400}opacity:\s*0/);
  assert.match(styles, /\.splash-logo-mark-frame \{[\s\S]{0,450}animation:\s*splashMarkIn 1600ms var\(--ease-out\) 650ms/);
  assert.match(styles, /\.splash-lockup-copy \{[\s\S]{0,400}opacity:\s*0/);
  assert.match(styles, /\.splash-lockup-copy \{[\s\S]{0,450}animation:\s*splashCopyIn 1680ms var\(--ease-out\) 740ms/);
  assert.match(styles, /\.splash-slogan-frame \{[\s\S]{0,400}opacity:\s*0/);
  assert.match(styles, /\.splash-slogan-frame \{[\s\S]{0,450}animation:\s*splashSloganIn 1500ms var\(--ease-out\) 900ms/);
  assert.doesNotMatch(styles, /@keyframes splashLogoScan/);
  assert.doesNotMatch(styles, /\.splash-logo::after/);
  assert.match(styles, /will-change:\s*transform, opacity/);
});

test('the splash dissolves as one plane before the app is revealed', () => {
  const styles = fs.readFileSync(path.join(renderer, 'styles.css'), 'utf8');
  const app = fs.readFileSync(path.join(renderer, 'app.js'), 'utf8');
  const signIn = fs.readFileSync(path.join(renderer, 'pages', 'signIn.js'), 'utf8');

  assert.match(styles, /#splash\.dissolving \{[\s\S]{0,140}opacity:\s*0/);
  assert.match(styles, /#splash \{[\s\S]{0,320}transition:\s*opacity var\(--dur-splash\) var\(--ease-out\)/);
  assert.doesNotMatch(styles, /#splash\.handoff/);
  assert.doesNotMatch(styles, /#splash\.landed/);
  assert.doesNotMatch(styles, /splashLockupExit/);

  const fade = Number(app.match(/const SPLASH_DISSOLVE_MS = (\d+)/)[1]);
  const dur = Number(styles.match(/--dur-splash:\s*(\d+)ms/)[1]);
  assert.equal(fade, dur, 'the JS timeout must match the CSS dissolve');
  assert.equal(fade, 420);
  assert.match(app, /const SPLASH_MIN_MS = 7000/);
  assert.match(app, /const SPLASH_VEIL_MS = 1000/);
  assert.match(app, /transform: 'scaleX\(0\)'/);
  assert.match(styles, /\.splash-bar-fill \{[\s\S]{0,220}transform:\s*scaleX\(0\)/);
  assert.match(signIn, /asset\('splash-logo\.png'\)/);
});

test('the finished screen fades in as one stable surface after the dissolve', () => {
  const html = fs.readFileSync(index, 'utf8');
  const styles = fs.readFileSync(path.join(renderer, 'styles.css'), 'utf8');
  const app = fs.readFileSync(path.join(renderer, 'app.js'), 'utf8');

  assert.match(html, /id="app" class="booting"/);
  assert.match(styles, /#app\.booting \{[\s\S]{0,220}opacity:\s*0/);
  assert.match(styles, /#app\.booting \{[\s\S]{0,220}will-change:\s*opacity/);
  assert.doesNotMatch(styles, /#app\.booting \{[\s\S]{0,260}transform:/);
  assert.match(styles, /#app \{[\s\S]{0,220}opacity var\(--dur-app-reveal\)/);
  assert.match(styles, /--dur-app-reveal:\s*240ms/);
  assert.doesNotMatch(styles, /\.signin-screen \{[\s\S]{0,300}transition:/);
  assert.doesNotMatch(styles, /\.signin-discord \{[\s\S]{0,300}transition:/);
  assert.match(app, /function revealApp\(\)/);
  assert.match(app, /requestAnimationFrame\(\(\) => app\.classList\.remove\('booting'\)\)/);
  assert.match(app, /splash\.classList\.add\('dissolving'\)/);
  assert.match(app, /signalSplashDone\(\);\s*revealApp\(\);/);
  assert.doesNotMatch(app, /playSignInHandoff/);
  assert.doesNotMatch(app, /HAND_OFF_MS/);
});

test('the sign-in destination retains a compact version of the splash identity', () => {
  const signIn = fs.readFileSync(path.join(renderer, 'pages', 'signIn.js'), 'utf8');
  const styles = fs.readFileSync(path.join(renderer, 'styles.css'), 'utf8');

  assert.match(signIn, /class: 'signin-lockup'/);
  assert.match(signIn, /class: 'signin-wordmark'/);
  assert.match(signIn, /asset\('splash-wordmark\.png'\)/);
  assert.match(signIn, /class: 'signin-slogan-frame'/);
  assert.match(signIn, /asset\('splash-slogan\.png'\)/);
  assert.match(styles, /\.signin-lockup \{[\s\S]{0,280}grid-template-columns:\s*auto minmax\(0, 1fr\)/);
  assert.match(styles, /\.signin-wordmark \{[\s\S]{0,220}width:\s*min\(280px, 48vw\)/);
  assert.match(styles, /\.signin-slogan-frame \{[\s\S]{0,260}aspect-ratio:\s*17 \/ 1/);
});

test('the splash background visibly moves during the seven-second splash window', () => {
  const styles = fs.readFileSync(path.join(renderer, 'styles.css'), 'utf8');
  const html = fs.readFileSync(index, 'utf8');

  assert.match(html, /class="splash-glow"/);
  assert.match(html, /class="splash-veil"/);
  assert.match(html, /class="splash-frost"/);
  assert.doesNotMatch(html, /splash-sweep/);
  for (const name of ['splashDrift', 'splashBreath', 'splashVeilLift', 'splashFrostLift']) {
    assert.match(styles, new RegExp(`@keyframes ${name}`), `${name} must exist`);
  }
  assert.match(styles, /splashDrift 16s/);
  assert.doesNotMatch(styles, /@keyframes splashDrift[\s\S]{0,180}translate3d/, 'the pit must not slide sideways');
  assert.match(styles, /splashBreath 3\.6s/);
  assert.match(styles, /splashFrostLift 650ms/);
  assert.match(styles, /#splash\.dissolving/);
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
  assert.match(about, /https:\/\/coach\.championshipseries\.eu\//);
  assert.equal(about.includes("class: 'brand-tint'"), false, 'the hue-rotate approximation is gone');
  assert.match(styles, /\.ci-lockup-accent[^}]*background: var\(--accent\)/);
});
