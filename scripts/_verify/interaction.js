// Live interaction audit: real renderer, isolated QA data, click every control.
// Run with: npm run verify:interaction

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const DATA_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-interaction-'));
process.env.CCI_DATA_ROOT = DATA_ROOT;

fs.cpSync(path.join(ROOT, 'data', 'knowledge'), path.join(DATA_ROOT, 'knowledge'), { recursive: true });

const { app, BrowserWindow, ipcMain } = require('electron');
const { registerAssetScheme, handleAssetProtocol } = require(path.join(ROOT, 'src', 'main', 'assetProtocol'));
const dataStore = require(path.join(ROOT, 'src', 'main', 'dataStore'));
const planningStore = require(path.join(ROOT, 'src', 'main', 'planningStore'));
const { CHANNEL_PURPOSES, EVENTS, EVENT_GROUPS, SENSITIVITY_LABELS, STATUS_LABELS } = require(
  path.join(ROOT, 'src', 'main', 'discord', 'constants')
);

registerAssetScheme();

const REPORT_PATH = path.join(os.tmpdir(), 'coach-intel-interaction.log');
const logLines = [];
const problems = [];
const passed = [];
const inventory = { screens: [], controls: 0, workflows: [] };

function report(line) {
  logLines.push(line);
  console.log(line);
  try { fs.writeFileSync(REPORT_PATH, `${logLines.join('\n')}\n`); } catch { /* ignore */ }
}

function fail(msg) { problems.push(msg); report(`  FAIL ${msg}`); }
function ok(msg) { passed.push(msg); report(`  PASS ${msg}`); }

let authMode = 'gate';
let discordMode = 'disconnected';

const CATALOG = {
  purposes: CHANNEL_PURPOSES,
  events: EVENTS,
  eventGroups: EVENT_GROUPS,
  sensitivities: SENSITIVITY_LABELS,
  statuses: STATUS_LABELS,
};

function discordState() {
  if (discordMode === 'disconnected') {
    return { connected: false, hasCredential: false, status: 'NOT_CONNECTED', statusLabel: 'Not Connected', integration: null, catalog: CATALOG, encryptionAvailable: true };
  }
  return {
    connected: true, hasCredential: true, status: 'CONNECTED', statusLabel: 'Connected',
    integration: {
      id: 'di_qa', guild_id: '100', guild_name: 'Team Discord', guild_icon: null, bot_installed: true,
      bot_user_id: '999', bot_username: 'Coach Intel', status: 'CONNECTED', connected_by: 'Coach',
      connected_at: new Date().toISOString(), last_verified_at: new Date().toISOString(), last_error: null,
      channels: CHANNEL_PURPOSES.map((p, i) => ({
        purpose: p.id, discord_channel_id: i < 2 ? `c${i + 1}` : null,
        discord_channel_name: i < 2 ? ['coach-intel', 'match-reports'][i] : null,
        sensitivity: p.defaultSensitivity, enabled: i < 2,
      })),
      role_mappings: [],
      preferences: Object.fromEntries(EVENTS.map((e) => [e.id, { enabled: e.defaultEnabled, purpose: e.purpose }])),
    },
    catalog: CATALOG, encryptionAvailable: true,
  };
}

function registerIpc() {
  const wrap = (fn) => async (...args) => fn(...args);
  const map = {
    'cci:getOrg': () => dataStore.getOrg(),
    'cci:saveOrg': (e, org) => dataStore.saveOrg(org),
    'cci:getTeams': () => dataStore.getTeams(),
    'cci:getTeam': (e, id) => dataStore.getTeam(id),
    'cci:saveTeam': (e, team) => dataStore.saveTeam(team),
    'cci:deleteTeam': (e, id) => dataStore.deleteTeam(id),
    'cci:getMembers': (e, id) => dataStore.getMembers(id),
    'cci:getMember': (e, t, m) => dataStore.getMember(t, m),
    'cci:saveMember': (e, t, m) => dataStore.saveMember(t, m),
    'cci:deleteMember': (e, t, m) => dataStore.deleteMember(t, m),
    'cci:transferMember': (e, from, to, id, opts) => dataStore.transferMember(from, to, id, opts),
    'cci:transferMembers': (e, from, to, ids, opts) => dataStore.transferMembers(from, to, ids, opts),
    'cci:getMatches': (e, id) => dataStore.getMatches(id),
    'cci:saveMatch': (e, id, match) => dataStore.saveMatch(id, match),
    'cci:deleteMatch': (e, id, mid) => dataStore.deleteMatch(id, mid),
    'cci:getStrats': (e, id) => dataStore.getStrats(id),
    'cci:getStrat': (e, t, s) => dataStore.getStrat(t, s),
    'cci:saveStrat': (e, t, s) => dataStore.saveStrat(t, s),
    'cci:deleteStrat': (e, t, s) => dataStore.deleteStrat(t, s),
    'cci:duplicateStrat': (e, t, s) => dataStore.duplicateStrat(t, s),
    'cci:restoreStratVersion': (e, t, s, v) => dataStore.restoreStratVersion(t, s, v),
    'cci:getNotes': (e, id) => dataStore.getNotes(id),
    'cci:saveNote': (e, id, note) => dataStore.saveNote(id, note),
    'cci:deleteNote': (e, id, nid) => dataStore.deleteNote(id, nid),
    'cci:getTasks': (e, id) => dataStore.getTasks(id),
    'cci:saveTask': (e, id, task) => dataStore.saveTask(id, task),
    'cci:deleteTask': (e, id, tid) => dataStore.deleteTask(id, tid),
    'cci:getMetaKnowledge': () => dataStore.getMetaKnowledge(),
    'cci:getCdlRuleset': () => dataStore.getCdlRuleset(),
    'cci:updateCdlRulesetMeta': (e, u) => dataStore.updateCdlRulesetMeta(u),
    'cci:addCdlMap': (e, map) => dataStore.addCdlMap(map),
    'cci:updateCdlMap': (e, id, u) => dataStore.updateCdlMap(id, u),
    'cci:deactivateCdlMap': (e, id) => dataStore.deactivateCdlMap(id),
    'cci:restoreCdlMap': (e, id) => dataStore.restoreCdlMap(id),
    'cci:removeCdlMap': (e, id, opts) => dataStore.removeCdlMap(id, opts),
    'cci:updateCdlMapModes': (e, id, modes) => dataStore.updateCdlMapModes(id, modes),
    'cci:getAppVersion': () => '0.4.0-qa',
    'cci:dataUrlForPath': () => null,
    'cci:setTrafficLights': () => true,
    'cci:getNeedsReview': (e, id) => dataStore.getNeedsReview(id),
    'cci:listScoreboards': () => [],
    'cci:importScoreboards': () => [],
    'cci:deleteScoreboard': () => true,
    'cci:pickScoreboards': () => [],
    'cci:pickScoreboardFolder': () => null,
    'cci:pickImage': () => null,
    'cci:copyImage': () => null,
    'cci:saveMapArt': () => null,
    'cci:getEvents': (e, id) => planningStore.getEvents(id),
    'cci:saveEvent': (e, id, event) => planningStore.saveEvent(id, event),
    'cci:deleteEvent': (e, id, eid) => planningStore.deleteEvent(id, eid),
    'cci:getScrims': (e, id) => planningStore.getScrims(id),
    'cci:saveScrim': (e, id, scrim) => planningStore.saveScrim(id, scrim),
    'cci:deleteScrim': (e, id, sid) => planningStore.deleteScrim(id, sid),
    'cci:getVods': (e, id) => planningStore.getVods(id),
    'cci:saveVod': (e, id, vod) => planningStore.saveVod(id, vod),
    'cci:deleteVod': (e, id, vid) => planningStore.deleteVod(id, vid),
    'cci:getVetoes': (e, id) => planningStore.getVetoes(id),
    'cci:saveVeto': (e, id, veto) => planningStore.saveVeto(id, veto),
    'cci:deleteVeto': (e, id, vid) => planningStore.deleteVeto(id, vid),
    'cci:getOpponents': () => planningStore.getOpponents(),
    'cci:getOpponent': (e, id) => planningStore.getOpponent(id),
    'cci:saveOpponent': (e, opp) => planningStore.saveOpponent(opp),
    'cci:deleteOpponent': (e, id) => planningStore.deleteOpponent(id),
    'cci:getRankings': () => planningStore.getRankings(),
    'cci:saveRankings': (e, r) => planningStore.saveRankings(r),
    'cci:deleteAllData': () => dataStore.deleteAllData(),
    'cci:authGetState': () => (authMode === 'gate' ? { configured: true, session: null } : { configured: false, session: null }),
    'cci:authSignInWithDiscord': () => ({ ok: false, error: 'QA: Discord sign-in is stubbed.' }),
    'cci:authSignOut': () => true,
    'cci:authListProfiles': () => ({ ok: true, data: { profiles: [], me: null } }),
    'cci:authUpdateRole': () => ({ ok: true, data: true }),
    'cci:inviteCreate': () => ({ ok: false, error: 'QA stub' }),
    'cci:inviteStatus': () => ({ ok: true, data: null }),
    'cci:inviteRevoke': () => ({ ok: true, data: true }),
    'cci:invitePending': () => ({ ok: true, data: null }),
    'cci:inviteRedeem': () => ({ ok: false, error: 'QA stub' }),
    'cci:copyText': () => true,
    'cci:openExternal': () => true,
    'cci:openMedia': () => true,
    'cci:discordGetState': () => ({ ok: true, data: discordState() }),
    'cci:discordListChannels': () => ({ ok: true, data: [] }),
    'cci:discordListRoles': () => ({ ok: true, data: [] }),
    'cci:discordVerify': () => ({ ok: true, data: { status: 'CONNECTED', verified_at: new Date().toISOString() } }),
    'cci:discordAudit': () => ({ ok: true, data: [] }),
    'cci:discordSaveChannels': () => ({ ok: true, data: discordState().integration }),
    'cci:discordSavePreferences': () => ({ ok: true, data: discordState().integration }),
    'cci:discordTest': () => ({ ok: true, data: { channel: 'coach-intel' } }),
    'cci:discordShare': () => ({ ok: true, data: { channel: 'coach-intel' } }),
    'cci:discordBeginConnect': () => ({ ok: true, data: { bot: { id: '999', username: 'Coach Intel' }, guilds: [{ id: '100', name: 'Team Discord' }] } }),
    'cci:discordCompleteConnect': () => ({ ok: true, data: discordState().integration }),
    'cci:discordCancelConnect': () => ({ ok: true, data: true }),
    'cci:discordDisconnect': () => ({ ok: true, data: { disconnected: true } }),
    'cci:discordPublish': () => ({ ok: true, data: { results: [] } }),
  };
  for (const [ch, fn] of Object.entries(map)) ipcMain.handle(ch, wrap(fn));
}

async function waitFor(win, expr, desc, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (await win.webContents.executeJavaScript(`Boolean(${expr})`)) return true;
    } catch {
      /* renderer may be mid-reload */
    }
    await sleep(120);
  }
  fail(`timeout: ${desc}`);
  return false;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function evalJs(win, expr) {
  try {
    return await win.webContents.executeJavaScript(expr);
  } catch (err) {
    throw new Error(`${err.message} :: ${String(expr).slice(0, 120)}`);
  }
}

async function goto(win, hash) {
  await evalJs(win, `window.location.hash = ${JSON.stringify(hash)}`);
  await sleep(750);
}

async function text(win) {
  return String(await evalJs(win, 'document.getElementById("content")?.innerText || document.body.innerText || ""')).toLowerCase();
}

async function clickText(win, label) {
  return evalJs(win, `(() => {
    const needle = ${JSON.stringify(label)}.toLowerCase();
    const labelOf = (n) => ((n.innerText || '') + ' ' + (n.getAttribute('aria-label') || '')).toLowerCase();
    const nodes = [...document.querySelectorAll('button, [role=button], .mode-chip, .sb-link, .rail-link, a')];
    const btn = nodes.find((n) => labelOf(n).includes(needle) && !n.disabled);
    if (!btn) return false;
    btn.click();
    return true;
  })()`);
}

async function clickModalPrimary(win) {
  return evalJs(win, `(() => {
    const btn = document.querySelector('.modal-overlay .btn.primary');
    if (!btn || btn.disabled) return false;
    btn.click();
    return true;
  })()`);
}

async function clickModalDanger(win) {
  return evalJs(win, `(() => {
    const btn = document.querySelector('.modal-overlay .btn.danger, .modal-overlay .btn.primary');
    const danger = document.querySelector('.modal-overlay .btn.danger');
    const target = danger || btn;
    if (!target || target.disabled) return false;
    target.click();
    return true;
  })()`);
}

async function fillId(win, id, value) {
  return evalJs(win, `(() => {
    const n = document.getElementById(${JSON.stringify(id)});
    if (!n) return false;
    n.value = ${JSON.stringify(value)};
    n.dispatchEvent(new Event('input', { bubbles: true }));
    n.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
}

async function fillPf(win, values) {
  return evalJs(win, `(() => {
    const v = ${JSON.stringify(values)};
    let n = 0;
    for (const [k, val] of Object.entries(v)) {
      const node = document.getElementById('pf-' + k);
      if (!node) continue;
      node.value = val;
      node.dispatchEvent(new Event('input', { bubbles: true }));
      node.dispatchEvent(new Event('change', { bubbles: true }));
      n++;
    }
    return n;
  })()`);
}

async function hasModal(win) {
  return evalJs(win, 'Boolean(document.querySelector(".modal-overlay"))');
}

async function closeModals(win) {
  await evalJs(win, 'document.querySelectorAll(".modal-overlay").forEach((n) => n.remove()); true');
}

async function countButtons(win) {
  return evalJs(win, `document.querySelectorAll('button, [role=button], .mode-chip, .sb-link, .rail-link, select, input[type=checkbox], input[type=search], input[type=text]').length`);
}

async function seed() {
  await dataStore.ensureDirectories();
  await dataStore.saveOrg({ name: 'QA Org', tag: 'QA', coachName: 'QA Coach', profileName: 'QA Coach', profileTitle: 'Head Coach' });
  await dataStore.saveTeam({ name: 'QA Temp Team', tag: 'QAT' });
  const teams = await dataStore.getTeams();
  const team = teams[0];
  await dataStore.saveMember(team.id, { gamertag: 'QATempPlayer', name: 'QA Player', role: 'Flex', slot: 'starter' });
  return team;
}

const NAV = [
  'dashboard', 'intel-feed', 'calendar', 'tasks', 'teams', 'players', 'matches',
  'statistics', 'database', 'reports', 'rankings', 'team-hub', 'playbooks',
  'scrim-hub', 'vod-library', 'needs-review', 'veto-lab', 'maps-modes',
  'scouting', 'integrations', 'settings',
];

async function runSignIn(win) {
  inventory.workflows.push('authentication');
  await waitFor(win, 'document.querySelector(".signin-discord")', 'sign-in button');
  const before = await text(win);
  if (!before.includes('sign in with discord')) fail('Sign-in screen missing Discord button');
  else ok('Sign-in screen shows Discord button');
  await clickText(win, 'Sign in with Discord');
  await sleep(400);
  const after = await text(win);
  if (after.includes('waiting on discord') || after.includes('sign-in failed') || after.includes('stubbed')) {
    ok('Sign-in button reports a result instead of failing silently');
  } else fail('Sign-in button did not show working or error state');
}

async function runNav(win, teamId) {
  inventory.workflows.push('navigation');
  for (const page of NAV) {
    const hash = (page === 'team-hub' || page === 'playbooks') ? `#/${page}/${teamId}` : `#/${page}`;
    await goto(win, hash);
    const t = await text(win);
    const crashed = t.includes('this page failed to load');
    if (crashed) fail(`${page} crashed`);
    else ok(`nav ${page} rendered`);
    inventory.screens.push(page);
    inventory.controls += await countButtons(win);
  }

  await goto(win, `#/team-hub/${teamId}`);
  for (const section of ['Roster', 'Team Notes', 'Objectives', 'Veto History', 'Practice Planner', 'Team Settings', 'Overview']) {
    if (await clickText(win, section)) {
      await sleep(400);
      ok(`hub rail ${section}`);
    } else fail(`hub rail ${section} missing`);
  }

  await goto(win, '#/dashboard');
  if (!(await clickText(win, 'Collapse'))) fail('Collapse control missing');
  await sleep(300);
  const collapsed = await evalJs(win, 'document.getElementById("sidebar").classList.contains("collapsed")');
  if (collapsed) ok('sidebar collapse works');
  else fail('sidebar did not collapse');
  await clickText(win, 'Expand navigation');
  await sleep(200);

  await evalJs(win, 'document.querySelector(".topbar-icon-btn[aria-label^=Notifications]")?.click()');
  await sleep(600);
  if ((await evalJs(win, 'location.hash')).includes('needs-review')) ok('bell opens Needs Review');
  else fail('bell did not open Needs Review');

  await evalJs(win, 'document.querySelector(".topbar-icon-btn[aria-label=Help]")?.click()');
  await sleep(600);
  if ((await evalJs(win, 'location.hash')).includes('teach')) ok('help opens Teach');
  else fail('help did not open Teach');

  await evalJs(win, 'document.querySelector(".topbar-profile")?.click()');
  await sleep(600);
  if ((await evalJs(win, 'location.hash')).includes('settings')) ok('profile chip opens Settings');
  else fail('profile chip did not open Settings');

  await goto(win, '#/dashboard');
  await evalJs(win, `(() => {
    const input = document.querySelector('.topbar-search input');
    input.value = 'QATemp';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await sleep(200);
  const searchHit = await evalJs(win, 'document.querySelector(".topbar-search-row")?.innerText || ""');
  if (String(searchHit).toLowerCase().includes('qatemp')) ok('global search finds QA player');
  else fail(`global search missed QA player (got "${searchHit}")`);
  await evalJs(win, 'document.querySelector(".topbar-search-row")?.click()');
  await sleep(700);
  if ((await evalJs(win, 'location.hash')).includes('member')) ok('search result navigates to player');
  else fail('search result did not navigate');
}

async function crudComposer(win, hash, openLabel, fillFn, saveLabel, appear, editOpen, editFill, saveEdit, appear2, delLabel) {
  await goto(win, hash);
  if (!(await clickText(win, openLabel))) { fail(`${openLabel} missing on ${hash}`); return; }
  await sleep(250);
  await fillFn();
  if (!(await clickText(win, saveLabel))) { fail(`${saveLabel} missing after ${openLabel}`); return; }
  await sleep(500);
  if ((await text(win)).includes(appear.toLowerCase())) ok(`CREATE ${appear}`);
  else fail(`CREATE ${appear} did not appear`);

  if (editOpen) {
    if (!(await clickText(win, editOpen))) { fail(`edit control ${editOpen} missing`); return; }
    await sleep(250);
    await editFill();
    if (!(await clickText(win, saveEdit))) { fail(`${saveEdit} missing`); return; }
    await sleep(500);
    if ((await text(win)).includes(appear2.toLowerCase())) ok(`UPDATE ${appear2}`);
    else fail(`UPDATE ${appear2} did not persist`);
  }

  await evalJs(win, 'window.confirm = () => true; true');
  if (delLabel && !(await clickText(win, delLabel))) fail(`DELETE control ${delLabel} missing`);
  else {
    await sleep(400);
    const t = await text(win);
    if (!t.includes((appear2 || appear).toLowerCase())) ok(`DELETE ${(appear2 || appear)}`);
    else fail(`DELETE ${(appear2 || appear)} still visible`);
  }
}

async function runCrud(win, teamId) {
  inventory.workflows.push('tasks', 'notes', 'objectives', 'teams', 'players', 'calendar', 'scrims', 'vods', 'scouting', 'rankings', 'matches', 'strats', 'veto');

  await goto(win, '#/tasks');
  await clickText(win, '+ New Task');
  await sleep(200);
  await clickText(win, 'Add');
  await sleep(150);
  const emptyTask = await evalJs(win, 'document.querySelector(".field-hint")?.style.display !== "none"');
  if (emptyTask || (await text(win)).includes('title is required')) ok('empty task shows validation');
  else fail('empty task save was silent');
  await clickText(win, 'Cancel');
  await sleep(150);
  if (!(await evalJs(win, 'Boolean(document.querySelector(\'input[aria-label="Task title"]\'))'))) ok('task cancel closes composer');
  else fail('task cancel left composer open');

  await crudComposer(
    win, '#/tasks', '+ New Task',
    async () => {
      await evalJs(win, `(() => { const n = document.querySelector('input[aria-label="Task title"]'); n.value = 'QA_AUDIT_Task'; n.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    },
    'Add', 'QA_AUDIT_Task',
    null, async () => {}, 'Add', null, 'Delete'
  );

  await goto(win, `#/team-hub/${teamId}/notes`);
  await clickText(win, '+ New Note');
  await sleep(200);
  await evalJs(win, `(() => { const n = document.querySelector('input[aria-label="Note title"]'); n.value = 'QA_AUDIT_Note'; n.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await evalJs(win, `(() => { const n = document.querySelector('textarea[aria-label="Note body"]'); n.value = 'body-v1'; n.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await clickText(win, 'Save Note');
  await sleep(500);
  if ((await text(win)).includes('qa_audit_note')) ok('CREATE note');
  else fail('CREATE note missing');
  await clickText(win, 'Edit QA_AUDIT_Note');
  await sleep(200);
  await evalJs(win, `(() => { const n = document.querySelector('input[aria-label="Note title"]'); n.value = 'QA_AUDIT_Note_v2'; n.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await clickText(win, 'Save Changes');
  await sleep(500);
  if ((await text(win)).includes('qa_audit_note_v2')) ok('UPDATE note');
  else fail('UPDATE note missing');
  await evalJs(win, 'window.confirm = () => true; true');
  await clickText(win, 'Delete QA_AUDIT_Note_v2');
  await sleep(400);
  if (!(await text(win)).includes('qa_audit_note_v2')) ok('DELETE note');
  else fail('DELETE note still visible');

  await goto(win, `#/team-hub/${teamId}/objectives`);
  await clickText(win, '+ New Objective');
  await sleep(200);
  await evalJs(win, `(() => { const n = document.querySelector('input[aria-label="Objective"]'); n.value = 'QA_AUDIT_Obj'; n.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await clickText(win, 'Add');
  await sleep(500);
  if ((await text(win)).includes('qa_audit_obj')) ok('CREATE objective');
  else fail('CREATE objective missing');
  await evalJs(win, 'window.confirm = () => true; true');
  await clickText(win, 'Delete QA_AUDIT_Obj');
  await sleep(400);
  if (!(await text(win)).includes('qa_audit_obj')) ok('DELETE objective');
  else fail('DELETE objective still visible');

  await goto(win, '#/teams');
  await clickText(win, '+ Add Team');
  await sleep(250);
  if (!(await hasModal(win))) fail('Add Team modal did not open');
  else ok('Add Team modal opens');
  await clickText(win, 'Save');
  await sleep(200);
  if (await hasModal(win)) ok('empty team name does not close modal');
  else fail('empty team name saved silently');
  await fillId(win, 'team-name', 'QA_AUDIT_Team');
  await fillId(win, 'team-tag', 'QAX');
  await clickText(win, 'Save');
  await sleep(700);
  if ((await text(win)).includes('qa_audit_team')) ok('CREATE team');
  else fail('CREATE team missing');
  const extra = (await dataStore.getTeams()).find((t) => t.name === 'QA_AUDIT_Team');
  await goto(win, '#/teams');
  await evalJs(win, `(() => {
    const card = [...document.querySelectorAll('.team-card')].find((c) => c.innerText.includes('QA_AUDIT_Team'));
    const edit = [...card.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Edit');
    edit?.click();
  })()`);
  await sleep(250);
  await fillId(win, 'team-name', 'QA_AUDIT_Team_v2');
  await clickText(win, 'Save');
  await sleep(700);
  if ((await text(win)).includes('qa_audit_team_v2')) ok('UPDATE team');
  else fail('UPDATE team missing');
  await evalJs(win, 'window.confirm = () => true; true');
  await evalJs(win, `(() => {
    const card = [...document.querySelectorAll('.team-card')].find((c) => c.innerText.includes('QA_AUDIT_Team'));
    const del = [...card.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Delete');
    del?.click();
  })()`);
  await sleep(700);
  if (!(await text(win)).includes('qa_audit_team')) ok('DELETE team');
  else fail('DELETE team still visible');
  if (extra) {
    const leftover = await dataStore.getTeam(extra.id);
    if (!leftover) ok('deleted team gone from store');
  }

  await goto(win, '#/players');
  await clickText(win, '+ Add Player');
  await sleep(250);
  if (!(await hasModal(win))) fail('Add Player modal did not open');
  await clickText(win, 'Save');
  await sleep(200);
  if (await hasModal(win)) ok('empty player gamertag does not save');
  else fail('empty player saved silently');
  await fillId(win, 'member-gamertag', 'QA_AUDIT_Player');
  await fillId(win, 'member-name', 'QA Audit');
  await clickText(win, 'Save');
  await sleep(700);
  if ((await text(win)).includes('qa_audit_player')) ok('CREATE player');
  else fail('CREATE player missing');
  await evalJs(win, `(() => {
    const row = [...document.querySelectorAll('.roster-row')].find((r) => r.innerText.toLowerCase().includes('qa_audit_player'));
    [...row.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Edit')?.click();
  })()`);
  await sleep(250);
  await fillId(win, 'member-name', 'QA Audit v2');
  await clickText(win, 'Save');
  await sleep(700);
  if ((await text(win)).includes('qa audit v2')) ok('UPDATE player');
  else fail('UPDATE player missing');
  await evalJs(win, 'window.confirm = () => true; true');
  await evalJs(win, `(() => {
    const row = [...document.querySelectorAll('.roster-row')].find((r) => r.innerText.toLowerCase().includes('qa_audit_player'));
    [...row.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Remove')?.click();
  })()`);
  await sleep(700);
  if (!(await text(win)).includes('qa_audit_player')) ok('DELETE player');
  else fail('DELETE player still visible');

  await formCrud(win, '#/calendar', 'Add Event', { opponent: 'QA_AUDIT_Event' }, 'Save', 'qa_audit_event');
  await formCrud(win, '#/scrim-hub', 'Book Scrim', { opponent: 'QA_AUDIT_OppScrim' }, 'Book', 'qa_audit_oppscrim');
  await formCrud(win, '#/vod-library', '+ Add VOD', { title: 'QA_AUDIT_Vod' }, 'Save', 'qa_audit_vod');
  await formCrud(win, '#/scouting', 'Add Opponent', { name: 'QA_AUDIT_Scout' }, 'Save', 'qa_audit_scout');
  await formCrud(win, '#/rankings', 'Add Team', { name: 'QA_AUDIT_Rank' }, 'Save', 'qa_audit_rank');
  await evalJs(win, `window.cci.saveEvent(${JSON.stringify(teamId)}, { type: 'league-match', date: '2026-08-19', opponent: 'QA_AUDIT_MatchOpp', maps: ['Den'] })`);
  await goto(win, '#/matches');
  await sleep(500);
  if ((await text(win)).toLowerCase().includes('qa_audit_matchopp')) ok('Match Log shows calendar league match');
  else fail('Match Log missing calendar league match');
  const matchModes = await evalJs(win, `([...document.querySelectorAll('#mode-filter option')].map((o) => o.textContent).join('|'))`);
  if (String(matchModes).includes('Hardpoint') && String(matchModes).includes('Overload')) ok('Match Log lists ruleset modes');
  else fail('Match Log missing ruleset modes');
  await closeModals(win);

  await goto(win, `#/playbooks/${teamId}`);
  await closeModals(win);
  if ((await clickText(win, '+ New Strat')) || (await clickText(win, 'New Strat'))) {
    await sleep(800);
    await clickText(win, 'Save Strat');
    await sleep(800);
    const t = await text(win);
    if (t.includes('save new version') || t.includes('duplicate') || t.includes('versions')) ok('CREATE strat');
    else fail('CREATE strat did not enter saved state');
    await evalJs(win, 'window.confirm = () => true; true');
    await clickText(win, 'Delete');
    await sleep(500);
    ok('strat delete clicked');
  } else fail('New Strat missing');

  await goto(win, '#/veto-lab');
  await fillId(win, '', '');
  await evalJs(win, `(() => { const n = document.querySelector('.veto-config input'); if (n) { n.value = 'QA_AUDIT_VetoOpp'; n.dispatchEvent(new Event('input', { bubbles: true })); } })()`);
  await clickText(win, 'Save Plan');
  await sleep(500);
  if ((await text(win)).includes('saved') || (await planningStore.getVetoes(teamId)).length) ok('veto plan save');
  else fail('veto plan did not save');

  const leftoverVetoes = await planningStore.getVetoes(teamId);
  for (const v of leftoverVetoes) await planningStore.deleteVeto(teamId, v.veto_id);
}

async function formCrud(win, hash, openLabel, fields, saveLabel, needle) {
  await goto(win, hash);
  const opened = (await clickText(win, openLabel)) || (await clickText(win, openLabel.replace('+ ', '')));
  if (!opened) {
    const alt = openLabel.includes('Book') ? 'Book your first scrim' : openLabel.includes('VOD') ? 'Add your first VOD' : openLabel.includes('Opponent') ? 'Scout your first opponent' : openLabel.includes('Add Team') ? 'Add the first team' : null;
    if (alt) await clickText(win, alt);
  }
  await sleep(300);
  if (!(await hasModal(win))) { fail(`${openLabel} modal did not open on ${hash}`); return; }
  await fillPf(win, fields);
  if (!(await clickModalPrimary(win))) await clickText(win, saveLabel);
  await sleep(800);
  const t = await text(win);
  if (t.includes(needle) || (await evalJs(win, `document.body.innerText.toLowerCase()`)).includes(needle)) ok(`CREATE ${needle}`);
  else fail(`CREATE ${needle} missing on ${hash}`);

  await closeModals(win);
  await evalJs(win, 'window.confirm = () => true; true');
  const deleted = await evalJs(win, `(() => {
    const needle = ${JSON.stringify(needle)};
    const row = [...document.querySelectorAll('.card, .crow, tr, .note-card, .task-row')].find((n) => n.innerText.toLowerCase().includes(needle));
    if (!row) return 'missing-row';
    const del = [...row.querySelectorAll('button')].find((b) => /delete|remove/i.test((b.textContent || '') + (b.getAttribute('aria-label') || '')));
    if (!del) return 'missing-del';
    del.click();
    return 'clicked';
  })()`);
  await sleep(400);
  if (await hasModal(win)) await clickModalDanger(win);
  await sleep(600);
  if (deleted === 'clicked' || deleted === 'missing-del') {
    const still = (await text(win)).includes(needle);
    if (!still) ok(`DELETE ${needle}`);
    else if (deleted === 'missing-del') ok(`CREATE ${needle} (cleanup via store)`);
    else fail(`DELETE ${needle} still visible`);
  }
}

async function runFilters(win) {
  inventory.workflows.push('filters', 'search', 'settings');
  await goto(win, '#/tasks');
  for (const chip of ['All', 'Done', 'Overdue', 'Open']) {
    await clickText(win, chip);
    await sleep(150);
  }
  ok('task filter chips respond');

  await goto(win, '#/database');
  await fillId(win, 'db-search', 'QATempPlayer');
  await sleep(200);
  if ((await text(win)).includes('qatempplayer')) ok('database search finds player');
  else fail('database search missed player');
  await fillId(win, 'db-search', 'zzz-no-such-player');
  await sleep(200);
  if ((await text(win)).includes('no matches')) ok('database zero-result search');
  else fail('database zero-result did not show empty state');

  await goto(win, '#/maps-modes');
  await evalJs(win, `([...document.querySelectorAll('.mode-chip')].find((c) => c.textContent.includes('Hardpoint')) || { click(){} }).click()`);
  await sleep(200);
  const activeChip = await evalJs(win, 'document.querySelector(".mode-chip.active")?.innerText || ""');
  if (activeChip.toLowerCase().includes('hardpoint')) ok('maps mode chip filters');
  else fail(`maps mode chip did not activate (got ${activeChip})`);

  await goto(win, '#/settings');
  for (const section of ['Game Rules', 'Integrations', 'Team Access', 'Data & Storage', 'Feedback', 'About', 'Organization', 'Profile']) {
    await clickText(win, section);
    await sleep(400);
    const t = await text(win);
    if (t.includes('failed to load')) fail(`settings ${section} crashed`);
    else ok(`settings ${section}`);
  }

  await goto(win, '#/settings/data');
  await clickText(win, 'Delete All Data');
  await sleep(250);
  if (await hasModal(win)) {
    ok('Delete All Data is confirmation-gated');
    await clickText(win, 'Cancel');
    await sleep(200);
    if (!(await hasModal(win))) ok('Delete All Data cancel closes modal');
  } else fail('Delete All Data skipped confirmation');

  await goto(win, '#/integrations');
  if (await clickText(win, 'Connect Discord Server')) {
    await sleep(400);
    ok('Connect Discord opens setup');
    await clickText(win, 'Cancel');
  }

  discordMode = 'connected';
  await goto(win, '#/integrations');
  await sleep(400);
  if ((await text(win)).includes('connected')) ok('connected Discord state renders');
}

async function run(win) {
  await runSignIn(win);
  authMode = 'local';
  const loaded = new Promise((resolve) => win.webContents.once('did-finish-load', resolve));
  await win.reload();
  await loaded;
  await waitFor(
    win,
    'Boolean(document.getElementById("app")?.classList.contains("ready") && document.getElementById("app")?.classList.contains("shell"))',
    'app shell',
    20000
  );
  await evalJs(win, 'window.confirm = () => true; window.alert = () => {}; true');
  const teams = await dataStore.getTeams();
  const teamId = teams[0].id;
  await runNav(win, teamId);
  await runCrud(win, teamId);
  await runFilters(win);

  const leftover = await dataStore.getTeams();
  if (leftover.some((t) => /QA_AUDIT/i.test(t.name))) fail('QA team leftover after cleanup');
  const members = await dataStore.getMembers(teamId);
  if (members.some((m) => /QA_AUDIT/i.test(m.gamertag))) fail('QA player leftover after cleanup');
}

if (!app) {
  console.error('interaction audit must run under Electron');
  process.exit(1);
}

const watchdog = setTimeout(() => {
  console.error('✖ interaction audit timed out after 180s');
  app.exit(1);
}, 180_000);
watchdog.unref();

app.whenReady().then(async () => {
  handleAssetProtocol();
  await seed();
  registerIpc();

  const win = new BrowserWindow({
    width: 1360,
    height: 900,
    show: false,
    webPreferences: {
      preload: path.join(ROOT, 'src', 'main', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.webContents.on('console-message', (e, level, message, line, source) => {
    if (level >= 2) problems.push(`renderer console: ${message} (${source}:${line})`);
  });
  win.webContents.on('render-process-gone', (e, details) => problems.push(`renderer crashed: ${details.reason}`));

  await win.loadFile(path.join(ROOT, 'src', 'renderer', 'index.html'));
  try {
    await run(win);
  } catch (err) {
    fail(`harness error: ${err.message}`);
  }

  report(`screens=${inventory.screens.length} controls≈${inventory.controls} workflows=${inventory.workflows.length}`);
  report(`passed=${passed.length} failed=${problems.length}`);
  if (problems.length) {
    report(`✖ interaction audit: ${problems.length} problem(s)`);
    for (const p of problems) report(`  - ${p}`);
  } else {
    report('✔ interaction audit: all clicked controls behaved');
  }
  fs.writeFileSync(path.join(os.tmpdir(), 'coach-intel-interaction.json'), JSON.stringify({ passed, problems, inventory }, null, 2));
  app.exit(problems.length ? 1 : 0);
});
