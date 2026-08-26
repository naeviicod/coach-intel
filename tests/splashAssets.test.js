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
  assert.match(html, /id="atmosphere"/);
  assert.match(html, /splash-atmosphere arena/);
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
  assert.match(styles, /--mark-h:\s*min\(292px, 25vw\)/);
  assert.match(styles, /--mark-nudge:\s*0px/);
  assert.match(styles, /\.splash-logo \{[\s\S]{0,420}align-items:\s*center/);
  assert.match(styles, /width:\s*calc\(var\(--lockup-h\) \* 2\.38\)/);
  assert.match(styles, /column-gap:\s*clamp\(4px, 0\.7vw, 10px\)/);
  assert.match(styles, /\.splash-slogan-frame \{\s*width: 100%/);
});

test('the splash logo has a staged GPU-only entrance that is visible before handoff', () => {
  const styles = fs.readFileSync(path.join(renderer, 'styles.css'), 'utf8');

  for (const name of ['splashMarkIn', 'splashCopyIn', 'splashSloganIn']) {
    assert.match(styles, new RegExp(`@keyframes ${name}`), `${name} must exist`);
  }
  assert.match(styles, /#splash \{[\s\S]{0,280}background:\s*transparent/);
  assert.match(styles, /\.splash-logo-mark-frame \{[\s\S]{0,400}opacity:\s*0/);
  assert.match(styles, /\.splash-logo-mark-frame \{[\s\S]{0,450}animation:\s*splashMarkIn 980ms var\(--ease-out\) 180ms/);
  assert.match(styles, /\.splash-lockup-copy \{[\s\S]{0,400}opacity:\s*0/);
  assert.match(styles, /\.splash-lockup-copy \{[\s\S]{0,450}animation:\s*splashCopyIn 1040ms var\(--ease-out\) 260ms/);
  assert.match(styles, /\.splash-slogan-frame \{[\s\S]{0,400}opacity:\s*0/);
  assert.match(styles, /\.splash-slogan-frame \{[\s\S]{0,450}animation:\s*splashSloganIn 900ms var\(--ease-out\) 420ms/);
  assert.doesNotMatch(styles, /@keyframes splashLogoScan/);
  assert.doesNotMatch(styles, /\.splash-logo::after/);
  assert.match(styles, /will-change:\s*transform, opacity/);
});

test('the splash dissolves into the app as one overlapping handoff', () => {
  const styles = fs.readFileSync(path.join(renderer, 'styles.css'), 'utf8');
  const app = fs.readFileSync(path.join(renderer, 'app.js'), 'utf8');
  const signIn = fs.readFileSync(path.join(renderer, 'pages', 'signIn.js'), 'utf8');

  assert.match(styles, /#splash\.dissolving \{[\s\S]{0,140}opacity:\s*0/);
  assert.match(styles, /#splash \{[\s\S]{0,360}transition:\s*opacity var\(--dur-splash\) var\(--ease-out\)/);
  assert.match(styles, /@keyframes splashBarSweep/);
  assert.doesNotMatch(styles, /@keyframes splashStageOut/);
  assert.doesNotMatch(styles, /transform:\s*scale\(0\.64\)/);
  assert.doesNotMatch(styles, /#splash\.dissolving \.splash-stage/);
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

test('the finished screen fades in under the dissolving splash', () => {
  const html = fs.readFileSync(index, 'utf8');
  const styles = fs.readFileSync(path.join(renderer, 'styles.css'), 'utf8');
  const app = fs.readFileSync(path.join(renderer, 'app.js'), 'utf8');

  assert.match(html, /id="app" class="booting"/);
  assert.match(styles, /#app\.booting \{[\s\S]{0,220}opacity:\s*0/);
  assert.match(styles, /#app\.booting \{[\s\S]{0,220}will-change:\s*opacity/);
  assert.doesNotMatch(styles, /#app\.booting \{[\s\S]{0,260}transform:/);
  assert.match(styles, /#app \{[\s\S]{0,220}opacity var\(--dur-app-reveal\)/);
  assert.match(styles, /--dur-app-reveal:\s*420ms/);
  assert.doesNotMatch(styles, /@keyframes signinSettle/);
  assert.doesNotMatch(styles, /#splash\.dissolving:not\(\.hide\) ~ #app \.signin-brief/);
  assert.doesNotMatch(styles, /\.signin-screen \{[\s\S]{0,300}transition:/);
  assert.doesNotMatch(styles, /\.signin-discord \{[\s\S]{0,300}transition:/);
  assert.match(app, /function revealApp\(\)/);
  assert.match(app, /function enterApp\(\)/);
  assert.match(app, /onComplete: \(\) => enterApp\(\)/);
  assert.doesNotMatch(app, /signIn\.render\(content, \{ onComplete: \(\) => window\.location\.reload\(\) \}\)/);
  assert.match(app, /requestAnimationFrame\(\(\) => app\.classList\.remove\('booting'\)\)/);
  assert.match(app, /splash\.classList\.add\('dissolving'\);\s*revealApp\(\)/);
  assert.match(app, /signalSplashDone\(\);/);
  assert.match(app, /settleAtmosphere\(\);\s*revealApp\(\)/);
  assert.doesNotMatch(app, /playSignInHandoff/);
  assert.doesNotMatch(app, /HAND_OFF_MS/);
});

test('the sign-in destination retains a compact version of the splash identity', () => {
  const signIn = fs.readFileSync(path.join(renderer, 'pages', 'signIn.js'), 'utf8');
  const styles = fs.readFileSync(path.join(renderer, 'styles.css'), 'utf8');

  assert.match(signIn, /class: 'signin-brief'/);
  assert.match(signIn, /class: 'signin-lockup'/);
  assert.match(signIn, /class: 'signin-wordmark'/);
  assert.match(signIn, /asset\('splash-wordmark\.png'\)/);
  assert.doesNotMatch(signIn, /signin-slogan/);
  assert.doesNotMatch(signIn, /splash-slogan\.png/);
  assert.match(styles, /\.signin-lockup \{[\s\S]{0,280}grid-template-columns:\s*auto minmax\(0, 1fr\)/);
  assert.match(styles, /\.signin-brief \{[\s\S]{0,280}width:\s*min\(680px, 92vw\)/);
  assert.match(styles, /\.signin-wordmark \{[\s\S]{0,220}width:\s*min\(220px, 42vw\)/);
  assert.match(styles, /\.signin-discord \{[\s\S]{0,220}border-radius:\s*999px/);
});

test('splash sits on the app pit with no pulse HUD', () => {
  const styles = fs.readFileSync(path.join(renderer, 'styles.css'), 'utf8');
  const html = fs.readFileSync(index, 'utf8');

  assert.match(html, /class="splash-atmosphere arena"/);
  assert.doesNotMatch(html, /intel-hud/);
  assert.doesNotMatch(html, /intel-wave/);
  assert.doesNotMatch(html, /splash-flow/);
  assert.doesNotMatch(html, /arena-scan/);
  assert.doesNotMatch(html, /splash-glow/);
  assert.doesNotMatch(html, /class="splash-background"/);
  assert.doesNotMatch(styles, /splashBarPulse/);
  assert.doesNotMatch(styles, /splashSheen/);
  assert.match(styles, /#splash \{[\s\S]{0,280}background:\s*transparent/);
  assert.match(styles, /#splash\.dissolving/);
});

test('wallpaper art follows a non-lime accent instead of staying gold', () => {
  const styles = fs.readFileSync(path.join(renderer, 'styles.css'), 'utf8');
  assert.match(styles, /html\.accent-tinted #atmosphere\.art-bg \.arena-art-img \{[\s\S]{0,160}filter:\s*var\(--brand-tint/);
  assert.match(styles, /html\.accent-tinted #atmosphere\.art-bg \.arena-art-tint \{ opacity: 0\.58; \}/);
});

test('the pit stays frosted until the splash is gone', () => {
  const html = fs.readFileSync(index, 'utf8');
  const styles = fs.readFileSync(path.join(renderer, 'styles.css'), 'utf8');
  const app = fs.readFileSync(path.join(renderer, 'app.js'), 'utf8');
  assert.match(html, /class="arena-frost"/);
  assert.match(styles, /\.arena-frost \{[\s\S]{0,280}backdrop-filter:\s*blur\(36px\)/);
  assert.match(styles, /#atmosphere:not\(\.settled\) \.arena-art/);
  assert.match(styles, /filter:\s*blur\(32px\)/);
  assert.match(app, /function settleAtmosphere\(\)/);
  assert.match(app, /classList\.add\('settled'\)/);
});

test('the sidebar brand is the wordmark only', () => {
  const app = fs.readFileSync(path.join(renderer, 'app.js'), 'utf8');
  const styles = fs.readFileSync(path.join(renderer, 'styles.css'), 'utf8');
  assert.match(app, /class: 'sb-wordmark'/);
  assert.doesNotMatch(app, /class: 'sb-lockup'/);
  assert.doesNotMatch(app, /class: 'sb-mark'/);
  assert.match(styles, /\.sb-brand \{[\s\S]{0,180}flex-direction:\s*column/);
  assert.doesNotMatch(styles, /\.sb-lockup \{/);
  assert.doesNotMatch(styles, /\.sb-mark \{/);
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
