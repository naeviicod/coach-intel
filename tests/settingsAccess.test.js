const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('node:url');

const libUrl = pathToFileURL(path.join(__dirname, '..', 'src', 'renderer', 'lib', 'settingsAccess.js')).href;

const keysFor = async (access) => {
  const { visibleSettingsSections } = await import(libUrl);
  return visibleSettingsSections(access).map((section) => section.key);
};

test('org admins see every section', async () => {
  for (const role of ['super_admin', 'owner', 'admin', 'developer']) {
    const { SETTINGS_SECTIONS } = await import(libUrl);
    assert.deepEqual(await keysFor({ role }), SETTINGS_SECTIONS.map((s) => s.key), role);
  }
});

test('a solo install with no session keeps the whole app', async () => {
  const { SETTINGS_SECTIONS } = await import(libUrl);
  assert.deepEqual(await keysFor({ role: 'owner', local: true }), SETTINGS_SECTIONS.map((s) => s.key));
});

test('coaches and team leaders run a team but not the org', async () => {
  for (const role of ['coach', 'team_leader']) {
    const keys = await keysFor({ role });
    assert.deepEqual(keys, ['profile', 'game-rules', 'team-access', 'feedback', 'about'], role);
  }
});

test('players, analysts and creatives see nothing org-wide', async () => {
  for (const role of ['user', 'member', 'player', 'analyst', 'creative', '', null, undefined]) {
    const keys = await keysFor({ role });
    assert.deepEqual(keys, ['profile', 'feedback', 'about'], String(role));
  }
});

test('the danger zone is never open to a non-admin', async () => {
  for (const role of ['coach', 'team_leader', 'analyst', 'user']) {
    const keys = await keysFor({ role });
    assert.equal(keys.includes('data'), false, role);
    assert.equal(keys.includes('organization'), false, role);
    assert.equal(keys.includes('integrations'), false, role);
  }
});

test('every role keeps their own profile, feedback and about', async () => {
  for (const role of ['owner', 'coach', 'analyst', 'user', 'creative']) {
    const keys = await keysFor({ role });
    for (const key of ['profile', 'feedback', 'about']) {
      assert.equal(keys.includes(key), true, `${role} needs ${key}`);
    }
  }
});

test('a section a role cannot open falls back to their first one', async () => {
  const { resolveSettingsSection } = await import(libUrl);
  const denied = resolveSettingsSection({ role: 'user' }, 'data');
  assert.equal(denied.sectionKey, 'profile');
  const allowed = resolveSettingsSection({ role: 'owner' }, 'data');
  assert.equal(allowed.sectionKey, 'data');
  const unknown = resolveSettingsSection({ role: 'owner' }, 'nope');
  assert.equal(unknown.sectionKey, 'profile');
});

test('every section maps to a module in the settings shell', async () => {
  const fs = require('fs');
  const { SETTINGS_SECTIONS } = await import(libUrl);
  const shell = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'pages', 'settings', 'index.js'), 'utf8');
  const map = shell.slice(shell.indexOf('const MODULES = {'), shell.indexOf('};', shell.indexOf('const MODULES = {')));
  for (const section of SETTINGS_SECTIONS) {
    const wired = map.includes(`'${section.key}'`) || new RegExp(`\\b${section.key}\\b`).test(map);
    assert.equal(wired, true, `${section.key} has no module`);
  }
});
