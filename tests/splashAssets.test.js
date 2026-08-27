const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
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

  assert.match(styles, /#splash\.dissolving \{[\s\S]{0,180}opacity:\s*0/);
  assert.match(styles, /#splash\.dissolving \{[\s\S]{0,220}filter:\s*blur\(12px\)/);
  assert.match(styles, /#splash \{[\s\S]{0,420}transition:\s*opacity var\(--dur-splash\) var\(--ease-out\), filter var\(--dur-splash\) var\(--ease-out\)/);
  assert.match(styles, /@keyframes splashBarSweep/);
  assert.match(styles, /@keyframes splashBarPulse/);
  assert.match(styles, /@keyframes splashStageOut/);
  assert.match(styles, /@keyframes splashPieceOut/);
  assert.match(styles, /#splash\.dissolving \.splash-stage/);
  assert.match(styles, /\.splash-bar \{[\s\S]{0,520}splashBarPulse/);
  assert.match(styles, /#splash\.loaded \.splash-bar[\s\S]{0,120}animation:\s*none/);
  assert.match(app, /function runSplashBarPulse/);
  assert.doesNotMatch(app, /scaleY\(2\.1\)/, 'the bar pulse must brighten in place, not grow and shrink');
  assert.match(app, /\{ opacity: 0\.38 \}/);
  assert.match(app, /\{ opacity: 1 \}/);
  assert.doesNotMatch(styles, /transform:\s*scale\(0\.64\)/);
  assert.doesNotMatch(styles, /@keyframes splashStageOut \{[\s\S]{0,160}scale\(/);
  assert.doesNotMatch(styles, /#splash\.handoff/);
  assert.doesNotMatch(styles, /#splash\.landed/);
  assert.doesNotMatch(styles, /splashLockupExit/);

  const fade = Number(app.match(/const SPLASH_DISSOLVE_MS = (\d+)/)[1]);
  const dur = Number(styles.match(/--dur-splash:\s*(\d+)ms/)[1]);
  assert.equal(fade, dur, 'the JS timeout must match the CSS dissolve');
  assert.equal(fade, 820);
  assert.match(app, /const SPLASH_MIN_MS = 5000/);
  assert.match(app, /const SPLASH_VEIL_MS = 160/);
  assert.match(app, /prepareApp\(\{ fast: true \}\)/);
  assert.match(app, /transform: 'scaleX\(0\)'/);
  assert.match(app, /easing: 'linear'/);
  assert.doesNotMatch(app, /cubic-bezier\(0\.15, 0\.82, 0\.22, 1\)/);
  assert.match(styles, /\.splash-bar-fill \{[\s\S]{0,280}linear-gradient\(90deg, #b6f542/);
  assert.match(styles, /\.splash-bar-fill \{[\s\S]{0,400}#ffffff/);
  assert.match(styles, /html\.booting-splash\.accent-tinted #atmosphere\.art-bg \.arena-art-tint \{[\s\S]{0,80}opacity:\s*0/);
  assert.match(app, /classList\.add\('booting-splash'\)/);
  assert.match(app, /classList\.remove\('booting-splash'\)/);
  assert.match(styles, /\.splash-bar \{[\s\S]{0,280}height:\s*5px/);
  assert.match(styles, /\.splash-meta \{[\s\S]{0,280}margin-top:\s*clamp\(24px, 3vw, 34px\)/);
  assert.doesNotMatch(styles, /\.splash-meta \{[\s\S]{0,280}bottom:\s*clamp/);
  assert.match(app, /raceTimeout\(completeSplashBar/);
  assert.match(styles, /\.splash-bar-fill \{[\s\S]{0,220}transform:\s*scaleX\(0\)/);
  assert.match(styles, /\.splash-bar-fill \{[\s\S]{0,220}overflow:\s*hidden/);
  assert.match(signIn, /asset\('splash-logo\.png'\)/);
});

test('splash holds five seconds then signs in or opens the dashboard once', () => {
  const html = fs.readFileSync(index, 'utf8');
  const app = fs.readFileSync(path.join(renderer, 'app.js'), 'utf8');

  assert.match(html, /class="splash-bar-fill">\s*<span class="splash-bar-sheen"/);
  assert.match(app, /const BOOT_TIMEOUT_MS = 8000/);
  assert.match(app, /onComplete: \(\) => enterApp\(\)/);
  assert.doesNotMatch(app, /signIn\.render\(content, \{ onComplete: \(\) => window\.location\.reload/);
  const enterApp = app.slice(app.indexOf('async function enterApp()'), app.indexOf('function renderOnboarding()'));
  assert.doesNotMatch(enterApp, /\bboot\(\)/);
  assert.doesNotMatch(enterApp, /location\.reload/);
  assert.doesNotMatch(enterApp, /finishSplash/);
});

test('pages swap immediately instead of fading the content pane', () => {
  const app = fs.readFileSync(path.join(renderer, 'app.js'), 'utf8');
  assert.doesNotMatch(app, /fadeEl\(content, 1, 0, 150\)/);
  assert.doesNotMatch(app, /fadeEl\(content, 0, 1, 180\)/);
  assert.match(app, /function swapPages\(/);
  assert.match(app, /if \(outgoing\) outgoing\.remove\(\)/);
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
  assert.match(styles, /--dur-app-reveal:\s*820ms/);
  assert.match(styles, /@keyframes signinSettle/);
  assert.match(styles, /#splash\.dissolving:not\(\.hide\) ~ #app \.signin-brief/);
  assert.match(styles, /#splash\.dissolving:not\(\.hide\) ~ #app\.shell/);
  assert.match(styles, /@keyframes splashShellIn/);
  assert.doesNotMatch(styles, /\.signin-screen \{[\s\S]{0,300}transition:/);
  assert.doesNotMatch(styles, /\.signin-discord \{[\s\S]{0,300}transition:/);
  assert.match(app, /function revealApp\(\)/);
  assert.match(app, /function enterApp\(\)/);
  assert.match(app, /onComplete: \(\) => enterApp\(\)/);
  assert.doesNotMatch(app, /signIn\.render\(content, \{ onComplete: \(\) => window\.location\.reload\(\) \}\)/);
  assert.match(app, /requestAnimationFrame\(\(\) => app\.classList\.remove\('booting'\)\)/);
  assert.match(app, /splash\.classList\.add\('dissolving'\);\s*revealApp\(\)/);
  assert.match(app, /signalSplashDone\(\);\s*revealApp\(\);/);
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

  assert.match(html, /data-background="orbit"/);
  assert.match(html, /backgrounds\/orbit\.png/);
  assert.doesNotMatch(html, /intel-hud/);
  assert.doesNotMatch(html, /intel-wave/);
  assert.doesNotMatch(html, /splash-flow/);
  assert.doesNotMatch(html, /arena-scan/);
  assert.doesNotMatch(html, /splash-glow/);
  assert.doesNotMatch(html, /class="splash-background"/);
  assert.doesNotMatch(styles, /splashSheen/);
  assert.match(styles, /@keyframes splashBarPulse/);
  assert.match(styles, /#splash \{[\s\S]{0,280}background:\s*transparent/);
  assert.match(styles, /#splash\.dissolving/);
});

test('wallpaper art follows a non-lime accent instead of staying gold', () => {
  const styles = fs.readFileSync(path.join(renderer, 'styles.css'), 'utf8');
  assert.match(styles, /html\.accent-tinted #atmosphere\.art-bg \.arena-art-img \{[\s\S]{0,160}filter:\s*var\(--brand-tint/);
  assert.match(styles, /html\.accent-tinted #atmosphere\.art-bg \.arena-art-tint \{ opacity: 0\.58; \}/);
});

test('the splash sits on the visible arena pit', () => {
  const html = fs.readFileSync(index, 'utf8');
  const styles = fs.readFileSync(path.join(renderer, 'styles.css'), 'utf8');
  assert.match(html, /id="atmosphere"/);
  assert.match(html, /splash-atmosphere arena/);
  assert.doesNotMatch(html, /arena-frost/);
  assert.match(styles, /#atmosphere\.arena \{[\s\S]{0,280}radial-gradient/);
  assert.doesNotMatch(styles, /#atmosphere:not\(\.settled\) \.arena-art/);
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

test('renderer modules parse so a syntax error cannot trap the splash', () => {
  const files = [];
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const next = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(next);
      else if (ent.name.endsWith('.js')) files.push(next);
    }
  };
  walk(renderer);
  const result = spawnSync(
    process.execPath,
    [
      '--experimental-vm-modules',
      '--eval',
      `import vm from 'node:vm';
       import fs from 'node:fs';
       const files = ${JSON.stringify(files)};
       const failed = [];
       for (const file of files) {
         try { new vm.SourceTextModule(fs.readFileSync(file, 'utf8')); }
         catch (err) { failed.push(file + ': ' + String(err.message).split('\\n')[0]); }
       }
       if (failed.length) { console.error(failed.join('\\n')); process.exit(1); }`,
    ],
    { encoding: 'utf8' }
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
