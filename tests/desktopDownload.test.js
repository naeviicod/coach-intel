const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '..');
const web = path.join(root, 'web');

function read(rel) {
  return fs.readFileSync(path.join(web, rel), 'utf8');
}

function libUrl(rel) {
  return pathToFileURL(path.join(web, rel)).href;
}

test('gamer tag reads the canonical session identity, with a safe fallback', async () => {
  const { displayGamerTag } = await import(libUrl('lib/desktop-release.js'));
  assert.equal(displayGamerTag({ name: 'Naevii' }), 'Naevii');
  assert.equal(displayGamerTag({ name: 'Signed in' }), 'Player', 'the identity fallback string must not leak into the UI as a fake tag');
  assert.equal(displayGamerTag({ name: '' }), 'Player');
  assert.equal(displayGamerTag(null), 'Player');
  assert.equal(displayGamerTag(undefined), 'Player');
});

test('release filenames are invariant and never contain member identity', async () => {
  const { releaseFilename } = await import(libUrl('lib/desktop-release.js'));

  assert.equal(releaseFilename('windows', '3.9.0'), 'Coach-Intel-Setup-3.9.0.exe');
  assert.equal(releaseFilename('mac', '3.9.0'), 'Coach-Intel-3.9.0-macOS.dmg');
  assert.equal(releaseFilename('mac', '3.9.0-beta.1'), 'Coach-Intel-3.9.0-beta.1-macOS.dmg');
  assert.equal(releaseFilename('mac', 'Naevii'), null);
  assert.equal(releaseFilename('other', '3.9.0'), null);
});

test('release date formats real timestamps and never throws on bad input', async () => {
  const { releaseDateLabel } = await import(libUrl('lib/desktop-release.js'));
  assert.equal(releaseDateLabel(null), null);
  assert.equal(releaseDateLabel(undefined), null);
  assert.equal(releaseDateLabel('not-a-date'), null);
  assert.equal(releaseDateLabel('2026-08-16T00:00:00Z'), 'Aug 16, 2026');
});

test('platform availability is honest: no release row and a failed lookup both read as unavailable, never a fake link', async () => {
  const { platformDownload } = await import(libUrl('lib/desktop-release.js'));

  const missing = platformDownload(null, 'windows');
  assert.equal(missing.available, false);
  assert.equal(missing.url, null);
  assert.equal(missing.filename, null);

  const release = { version: '1.5.4', windows_url: 'https://github.com/naeviicod/coach-intel/releases/download/v1.5.4/win.exe', mac_url: null, published_at: '2026-08-16T00:00:00Z' };
  const win = platformDownload(release, 'windows');
  assert.equal(win.available, true);
  assert.equal(win.url, release.windows_url);
  assert.equal(win.filename, 'Coach-Intel-Setup-1.5.4.exe');
  assert.equal(win.version, '1.5.4');

  const mac = platformDownload(release, 'mac');
  assert.equal(mac.available, false, 'a platform with no URL in the row must not offer a download');
  assert.equal(mac.filename, null);
});

test('platform recommendation follows the request, and non-desktop visitors get no false recommendation', async () => {
  const { recommendedPlatform } = await import(libUrl('lib/desktop-release.js'));
  assert.equal(recommendedPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'windows');
  assert.equal(recommendedPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)'), 'mac');
  assert.equal(recommendedPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), null);
  assert.equal(recommendedPlatform(''), null);
});

test('CI Desktop settings section is registered and wired end to end', () => {
  const access = read('lib/settings-access.js');
  assert.match(access, /key: 'ci-desktop'/);
  assert.match(access, /scope: 'everyone'/);

  const icons = read('lib/icons.js');
  assert.match(icons, /desktop:/);

  const shell = read('components/settings-shell.js');
  assert.match(shell, /DesktopDownloadCard/);
  assert.match(shell, /sectionKey === 'ci-desktop'/);
  assert.match(shell, /release/);
  assert.match(shell, /detectedPlatform/);

  const page = read('app/(shell)/settings/[section]/page.js');
  assert.match(page, /getLatestRelease/);
  assert.match(page, /recommendedPlatform/);
  assert.match(page, /headers\(\)/);
  assert.match(page, /user-agent/);
});

test('the download card renders both platforms, creates a server-side Mac setup session, and never leaks identifiers', () => {
  const card = read('components/desktop-download.js');
  assert.match(card, /'use client'/);
  assert.match(card, /Download for \$\{meta\.label\}/);
  assert.match(card, /displayGamerTag/);
  assert.match(card, /Prepared for/);
  assert.match(card, /platformDownload/);
  assert.match(card, /desktop-download-sessions/);
  assert.match(card, /After moving Coach Intel to Applications/);
  assert.doesNotMatch(card, /user\.email|supabaseId|user_id|access_token|refresh_token/i);
});

test('an unavailable platform shows an honest coming-soon state, not a dead button', () => {
  const card = read('components/desktop-download.js');
  assert.match(card, /badge-soon/);
  assert.match(card, /Coming soon/);
  assert.match(card, /Currently unavailable/);
  assert.match(card, /disabled=\{!available/);
});

test('the download action is keyboard operable and announces its status', () => {
  const card = read('components/desktop-download.js');
  assert.match(card, /<button/);
  assert.match(card, /type="button"/);
  assert.match(card, /role="status"/);
  assert.match(card, /aria-live="polite"/);
  assert.match(card, /aria-describedby/);
});

test('Settings download uses the current GitHub Windows installer when app_releases is missing or stale', () => {
  const { overlayCurrentRelease, githubWindowsUrl } = require(path.join(web, 'lib', 'releases.js'));
  const current = require(path.join(web, 'package.json')).version;
  assert.equal(current, '3.9.2');
  assert.equal(
    githubWindowsUrl('3.9.2'),
    'https://github.com/naeviicod/coach-intel/releases/download/v3.9.2/Coach-Intel-Setup-3.9.2.exe',
  );

  const fromEmpty = overlayCurrentRelease(null, '3.9.2');
  assert.equal(fromEmpty.version, '3.9.2');
  assert.equal(fromEmpty.windows_url, githubWindowsUrl('3.9.2'));
  assert.equal(fromEmpty.mac_url, null);

  const stale = overlayCurrentRelease({
    version: '3.5.0',
    windows_url: 'https://example.com/old.exe',
    mac_url: 'https://example.com/old.dmg',
  }, '3.9.2');
  assert.equal(stale.version, '3.9.2');
  assert.equal(stale.windows_url, githubWindowsUrl('3.9.2'));
  assert.equal(stale.mac_url, null);

  const currentRow = overlayCurrentRelease({
    version: '3.9.2',
    windows_url: 'https://cdn.example/Coach-Intel-Setup-3.9.2.exe',
    mac_url: 'https://cdn.example/Coach-Intel-3.9.2-macOS.dmg',
  }, '3.9.2');
  assert.equal(currentRow.windows_url, 'https://cdn.example/Coach-Intel-Setup-3.9.2.exe');
  assert.equal(currentRow.mac_url, 'https://cdn.example/Coach-Intel-3.9.2-macOS.dmg');
});

test('CI Desktop stays inside the authenticated settings shell, which already gates signed-out visitors', () => {
  // The (shell) layout redirects to sign-in before any settings section renders,
  // so the download UI never needs its own auth check.
  const layout = read('app/(shell)/layout.js');
  assert.match(layout, /if \(!user\) redirect\('\/sign-in/);
});
