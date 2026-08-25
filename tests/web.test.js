const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { detectPlatform, pickDownload } = require('../web/lib/platform');

const root = path.join(__dirname, '..');
const web = path.join(root, 'web');

function read(rel) {
  return fs.readFileSync(path.join(web, rel), 'utf8');
}

test('the public site is a product gateway, not an Open App splash', () => {
  const page = read('app/page.js');
  const gateway = read('components/public-gateway.js');
  const lockup = read('components/splash-lockup.js');
  const signIn = read('components/discord-sign-in.js');
  const open = read('app/open/page.js');
  const readme = read('README.md');
  assert.match(page, /PublicGateway/);
  assert.match(page, /\/dashboard/);
  assert.doesNotMatch(page, /coachintel:\/\//);
  assert.match(gateway, /SplashLockup/);
  assert.match(lockup, /splash-logo\.png/);
  assert.match(lockup, /splash-wordmark\.png/);
  assert.match(lockup, /splash-slogan\.png/);
  assert.match(signIn, /Sign in with Discord/);
  assert.doesNotMatch(gateway, /coachintel:\/\//);
  assert.match(open, /coachintel:\/\//);
  assert.match(readme, /Root Directory/);
  assert.match(readme, /Coach Intel.*Supabase|not.*ECS/i);
  assert.equal(fs.existsSync(path.join(web, 'public', 'favicon.png')), true);
  assert.equal(fs.existsSync(path.join(web, 'public', 'favicon.ico')), true);
  assert.equal(fs.existsSync(path.join(web, 'app', 'icon.png')), true);
  assert.equal(fs.existsSync(path.join(web, 'app', 'favicon.ico')), false);
  const icon = fs.readFileSync(path.join(web, 'app', 'icon.png'));
  assert.equal(icon.readUInt32BE(16), 32);
  assert.equal(icon.readUInt32BE(20), 32);
  for (const name of ['splash-logo.png', 'splash-wordmark.png', 'splash-slogan.png', 'splash-background.png']) {
    assert.equal(fs.existsSync(path.join(web, 'public', 'assets', name)), true, `${name} must ship with the site`);
  }
});

test('web auth talks only to the Coach Intel Supabase project', () => {
  const config = read('lib/config.js');
  const env = read('.env.example');
  const callback = read('app/auth/callback/route.js');
  const signIn = read('app/sign-in/page.js');
  const gateway = read('components/public-gateway.js');
  assert.match(config, /buzqhwoaoiyeqkvmsghm\.supabase\.co/);
  assert.doesNotMatch(config, /ecs_|AUTH_DATABASE|championshipseries\.supabase/i);
  assert.match(env, /Coach Intel Supabase only/);
  assert.match(env, /\/auth\/callback/);
  assert.match(callback, /exchangeCodeForSession/);
  assert.match(signIn, /PublicGateway/);
  assert.match(gateway, /DiscordSignIn/);
  const invite = read('lib/invite.js');
  const invitePage = read('app/invite/[token]/page.js');
  assert.match(invite, /invite_preview/);
  assert.match(invite, /redeem_invite/);
  assert.match(invitePage, /previewInvite/);
  assert.match(invitePage, /redeemInvite/);
  const oauth = read('components/discord-sign-in.js');
  const middleware = read('middleware.js');
  assert.match(oauth, /redirectTo: `\$\{origin\}\/auth\/callback`/);
  assert.doesNotMatch(oauth, /callback\?next=/);
  assert.match(middleware, /pathname !== '\/auth\/callback'/);
  assert.match(middleware, /searchParams\.get\('code'\)/);
});

test('signed-in shell reads teams and members from Supabase', () => {
  const data = read('lib/data.js');
  const dash = read('app/dashboard/page.js');
  const team = read('app/teams/[id]/page.js');
  assert.match(data, /from\('teams'\)/);
  assert.match(data, /from\('members'\)/);
  assert.match(dash, /listTeams/);
  assert.match(team, /listMembers/);
});

test('Vercel env example and releases schema are ready to apply', () => {
  const env = read('.env.example');
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
