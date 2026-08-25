const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { detectPlatform, pickDownload } = require('../web/lib/platform');

const root = path.join(__dirname, '..');
const web = path.join(root, 'web');

test('the web app opens Coach Intel over coachintel://', () => {
  const page = fs.readFileSync(path.join(web, 'app', 'page.js'), 'utf8');
  const open = fs.readFileSync(path.join(web, 'app', 'open', 'page.js'), 'utf8');
  const readme = fs.readFileSync(path.join(web, 'README.md'), 'utf8');
  assert.match(page, /href="coachintel:\/\/"/);
  assert.match(page, /Open Coach Intel/);
  assert.match(page, /Know More\. Win More\./);
  assert.doesNotMatch(page, /Download for Mac|Download for Windows|mac_url|windows_url/);
  assert.match(open, /coachintel:\/\//);
  assert.match(readme, /Root Directory/);
  assert.equal(fs.existsSync(path.join(web, 'public', 'favicon.png')), true, 'favicon.png must ship with the site');
  assert.equal(fs.existsSync(path.join(web, 'app', 'icon.png')), true, 'app/icon.png must ship with the site');
  for (const name of ['splash-logo.png', 'splash-wordmark.png', 'splash-slogan.png', 'splash-background.png']) {
    assert.equal(fs.existsSync(path.join(web, 'public', 'assets', name)), true, `${name} must ship with the site`);
  }
  assert.match(page, /splash-logo\.png/);
  assert.match(page, /splash-wordmark\.png/);
  assert.match(page, /splash-background\.png/);
});

test('Vercel env example and releases schema are ready to apply', () => {
  const env = fs.readFileSync(path.join(web, '.env.example'), 'utf8');
  const sql = fs.readFileSync(path.join(root, 'scripts', 'supabase', 'releases.sql'), 'utf8');
  assert.match(env, /NEXT_PUBLIC_SUPABASE_URL=/);
  assert.match(env, /NEXT_PUBLIC_SUPABASE_ANON_KEY=/);
  assert.match(env, /Root Directory: web/);
  assert.match(sql, /create table if not exists public\.app_releases/);
  assert.match(sql, /to anon, authenticated/);
  assert.match(sql, /using \(published = true\)/);
});

test('download picker follows the visitor OS and skips empty URLs', () => {
  assert.equal(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)'), 'mac');
  assert.equal(detectPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'windows');
  assert.equal(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), 'mobile');

  const release = {
    mac_url: 'https://example.com/mac.zip',
    windows_url: 'https://example.com/win.exe',
  };
  const mac = pickDownload(release, 'mac');
  assert.equal(mac.primary.id, 'mac');
  assert.equal(mac.other.id, 'windows');
  assert.equal(mac.both, null);

  const win = pickDownload(release, 'windows');
  assert.equal(win.primary.id, 'windows');
  assert.equal(win.other.id, 'mac');

  const phone = pickDownload(release, 'mobile');
  assert.equal(phone.primary, null);
  assert.equal(phone.both.length, 2);

  const macOnly = pickDownload({ mac_url: release.mac_url }, 'windows');
  assert.equal(macOnly.primary, null);
  assert.equal(macOnly.other.id, 'mac');
});
