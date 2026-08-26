// Renderer smoke harness.
//
// Loads the real index.html with the real preload, but serves the `cci:discord*`
// IPC channels from fixtures so the Discord screens can be rendered in both the
// disconnected and connected states without touching a live Discord server.
// Domain data comes from the real dataStore.
//
// Run with: npm run verify:ui

const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');
const { registerAssetScheme, handleAssetProtocol } = require(path.join(__dirname, '..', '..', 'src', 'main', 'assetProtocol'));

registerAssetScheme();

// Electron's GUI process does not always keep the launching terminal's stdout,
// so the report is mirrored to a file the caller can read.
const REPORT_PATH = path.join(require('os').tmpdir(), 'coach-intel-verify-ui.log');
const logLines = [];

function report(line) {
  logLines.push(line);
  console.log(line);
  try {
    require('fs').writeFileSync(REPORT_PATH, `${logLines.join('\n')}\n`);
  } catch {
    /* best effort */
  }
}

report('[verify] harness starting');

const ROOT = path.join(__dirname, '..', '..');
const fs = require('fs');
const os = require('os');
const DATA_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-verify-ui-'));
process.env.CCI_DATA_ROOT = DATA_ROOT;
fs.cpSync(path.join(ROOT, 'data', 'knowledge'), path.join(DATA_ROOT, 'knowledge'), { recursive: true });
const dataStore = require(path.join(ROOT, 'src', 'main', 'dataStore'));
const planningStore = require(path.join(ROOT, 'src', 'main', 'planningStore'));
const { CHANNEL_PURPOSES, EVENTS, EVENT_GROUPS, SENSITIVITY_LABELS, STATUS_LABELS } = require(
  path.join(ROOT, 'src', 'main', 'discord', 'constants')
);

const problems = [];
let discordMode = 'disconnected';

// ---------- Discord fixtures ----------

const CATALOG = {
  purposes: CHANNEL_PURPOSES,
  events: EVENTS,
  eventGroups: EVENT_GROUPS,
  sensitivities: SENSITIVITY_LABELS,
  statuses: STATUS_LABELS,
};

function connectedIntegration() {
  return {
    id: 'di_test',
    guild_id: '100',
    guild_name: 'Team Discord',
    guild_icon: null,
    bot_installed: true,
    bot_user_id: '999',
    bot_username: 'Coach Intel',
    status: 'CONNECTED',
    connected_by: 'Coach',
    connected_at: new Date(Date.now() - 3600_000).toISOString(),
    last_verified_at: new Date(Date.now() - 480_000).toISOString(),
    last_error: null,
    channels: CHANNEL_PURPOSES.map((p, i) => ({
      purpose: p.id,
      discord_channel_id: i < 2 ? `c${i + 1}` : null,
      discord_channel_name: i < 2 ? ['coach-intel', 'match-reports'][i] : null,
      sensitivity: p.defaultSensitivity,
      enabled: i < 2,
    })),
    role_mappings: [],
    preferences: Object.fromEntries(EVENTS.map((e) => [e.id, { enabled: e.defaultEnabled, purpose: e.purpose }])),
  };
}

function discordState() {
  if (discordMode === 'disconnected') {
    return {
      connected: false,
      hasCredential: false,
      status: 'NOT_CONNECTED',
      statusLabel: 'Not Connected',
      integration: null,
      catalog: CATALOG,
      encryptionAvailable: true,
    };
  }
  return {
    connected: true,
    hasCredential: true,
    status: 'CONNECTED',
    statusLabel: 'Connected',
    integration: connectedIntegration(),
    catalog: CATALOG,
    encryptionAvailable: true,
  };
}

const CHANNELS = [
  { id: 'c1', name: 'coach-intel', type: 0, category: 'Coaching', position: 1, canPost: true, missing: [] },
  { id: 'c2', name: 'match-reports', type: 0, category: 'Coaching', position: 2, canPost: true, missing: [] },
  { id: 'c3', name: 'private-coaches', type: 0, category: null, position: 3, canPost: false, missing: ['View Channel'] },
];

const HEALTH = {
  guild: { ok: true, name: 'Team Discord', error: null },
  bot: { ok: true, username: 'Coach Intel', error: null },
  channels: [
    { purpose: 'general', label: 'General Intel', channel_id: 'c1', channel_name: 'coach-intel', ok: true, missing: [], error: null },
    { purpose: 'match_reports', label: 'Match Reports', channel_id: 'c2', channel_name: 'match-reports', ok: true, missing: [], error: null },
  ],
  status: 'CONNECTED',
  verified_at: new Date().toISOString(),
};

const AUDIT = [
  { timestamp: new Date().toISOString(), action: 'discord.guild_connected', target: 'Team Discord', actor: 'Coach', result: 'SUCCESS' },
  { timestamp: new Date().toISOString(), action: 'discord.test_message_sent', target: '#coach-intel', actor: 'Coach', result: 'SUCCESS' },
];

const ok = (data) => ({ ok: true, data });

// ---------- IPC ----------

function registerIpc() {
  const passthrough = {
    'cci:getOrg': () => dataStore.getOrg(),
    'cci:saveOrg': (e, org) => dataStore.saveOrg(org),
    'cci:syncNow': () => ({ ok: true }),
    'cci:updateMyProfile': () => ({ ok: true }),
    'cci:setMyPhoto': () => null,
    'cci:getTeams': () => dataStore.getTeams(),
    'cci:getTeam': (e, id) => dataStore.getTeam(id),
    'cci:getMembers': (e, id) => dataStore.getMembers(id),
    'cci:getMember': (e, t, m) => dataStore.getMember(t, m),
    'cci:getMatches': (e, id) => dataStore.getMatches(id),
    'cci:getStrats': (e, id) => dataStore.getStrats(id),
    'cci:getStrat': (e, t, s) => dataStore.getStrat(t, s),
    'cci:getNeedsReview': (e, id) => dataStore.getNeedsReview(id),
    'cci:listScoreboards': (e, id) => dataStore.getNeedsReview(id),
    'cci:importScoreboards': () => [],
    'cci:deleteScoreboard': () => true,
    'cci:pickScoreboards': () => [],
    'cci:pickScoreboardFolder': () => null,
    'cci:getNotes': (e, id) => dataStore.getNotes(id),
    'cci:saveNote': (e, id, note) => dataStore.saveNote(id, note),
    'cci:deleteNote': (e, id, noteId) => dataStore.deleteNote(id, noteId),
    'cci:attachNoteImage': () => null,
    'cci:getTasks': (e, id) => dataStore.getTasks(id),
    'cci:saveTask': (e, id, task) => dataStore.saveTask(id, task),
    'cci:deleteTask': (e, id, taskId) => dataStore.deleteTask(id, taskId),
    'cci:getMetaKnowledge': () => dataStore.getMetaKnowledge(),
    'cci:getCdlRuleset': () => dataStore.getCdlRuleset(),
    'cci:getAppVersion': () => require(path.join(ROOT, 'package.json')).version,
    'cci:getNotifications': () => [],
    'cci:deleteNotification': () => true,
    'cci:getMapObjectives': (e, mapSlug, mapName, mode) => dataStore.getMapObjectives(mapSlug, mapName, mode),
    'cci:saveMapObjectives': (e, mapSlug, mapName, mode, data) => dataStore.saveMapObjectives(mapSlug, mapName, mode, data),
    'cci:setTrafficLights': () => true,
    'cci:dataUrlForPath': () => null,
    'cci:pickImage': () => null,
    'cci:getEvents': (e, id) => planningStore.getEvents(id),
    'cci:saveEvent': (e, id, event) => planningStore.saveEvent(id, event),
    'cci:deleteEvent': (e, id, eventId) => planningStore.deleteEvent(id, eventId),
    'cci:getScrims': (e, id) => planningStore.getScrims(id),
    'cci:saveScrim': (e, id, scrim) => planningStore.saveScrim(id, scrim),
    'cci:deleteScrim': (e, id, scrimId) => planningStore.deleteScrim(id, scrimId),
    'cci:getVods': (e, id) => planningStore.getVods(id),
    'cci:saveVod': (e, id, vod) => planningStore.saveVod(id, vod),
    'cci:deleteVod': (e, id, vodId) => planningStore.deleteVod(id, vodId),
    'cci:getVetoes': (e, id) => planningStore.getVetoes(id),
    'cci:saveVeto': (e, id, veto) => planningStore.saveVeto(id, veto),
    'cci:deleteVeto': (e, id, vetoId) => planningStore.deleteVeto(id, vetoId),
    'cci:getOpponents': () => planningStore.getOpponents(),
    'cci:getOpponent': (e, oppId) => planningStore.getOpponent(oppId),
    'cci:saveOpponent': (e, opponent) => planningStore.saveOpponent(opponent),
    'cci:deleteOpponent': (e, oppId) => planningStore.deleteOpponent(oppId),
    'cci:getRankings': () => planningStore.getRankings(),
    'cci:saveRankings': (e, rankings) => planningStore.saveRankings(rankings),
    'cci:authGetState': () => ({ configured: false, session: null }),
    'cci:authSignInWithDiscord': () => ({ ok: false, error: 'verify stub' }),
    'cci:authSignOut': () => true,
    'cci:authListProfiles': () => ({ ok: true, data: { profiles: [], me: null } }),
    'cci:authUpdateRole': () => ({ ok: true, data: true }),
    'cci:invitePending': () => ({ ok: true, data: null }),
    'cci:inviteCreate': () => ({ ok: false, error: 'verify stub' }),
    'cci:inviteStatus': () => ({ ok: true, data: null }),
    'cci:inviteRevoke': () => ({ ok: true, data: true }),
    'cci:inviteRedeem': () => ({ ok: false, error: 'verify stub' }),
    'cci:copyText': () => true,
    'cci:openMedia': () => true,
  };
  for (const [channel, handler] of Object.entries(passthrough)) ipcMain.handle(channel, handler);

  const discordHandlers = {
    'cci:discordGetState': () => ok(discordState()),
    'cci:discordListChannels': () => ok(CHANNELS),
    'cci:discordListRoles': () => ok([{ id: '1', name: 'Head Coach' }, { id: '2', name: 'Analyst' }]),
    'cci:discordVerify': () => ok(HEALTH),
    'cci:discordAudit': () => ok(AUDIT),
    'cci:discordSaveChannels': () => ok({ integration: connectedIntegration(), rejected: [] }),
    'cci:discordSavePreferences': () => ok(connectedIntegration()),
    'cci:discordTest': () => ok({ channel: 'coach-intel' }),
    'cci:discordShare': () => ok({ channel: 'coach-intel' }),
    'cci:discordBeginConnect': () => ok({ bot: { id: '999', username: 'Coach Intel' }, guilds: [{ id: '100', name: 'Team Discord' }] }),
    'cci:discordCompleteConnect': () => ok(connectedIntegration()),
    'cci:discordCancelConnect': () => ok(true),
    'cci:discordDisconnect': () => ok({ disconnected: true }),
    'cci:discordPublish': () => ok({ results: [] }),
    'cci:openExternal': () => true,
  };
  for (const [channel, handler] of Object.entries(discordHandlers)) ipcMain.handle(channel, handler);
}

// ---------- Assertions ----------

async function waitFor(win, expression, description, timeoutMs = 6000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await win.webContents.executeJavaScript(expression);
    if (value) return true;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  problems.push(`timed out waiting for ${description}`);
  return false;
}

const contentText = 'document.getElementById("content").innerText';

// Chromium applies `text-transform` to innerText, so the assertions compare
// case-insensitively rather than duplicating the stylesheet's casing.
async function pageText(win) {
  return (await win.webContents.executeJavaScript(contentText)).toLowerCase();
}

async function expectText(win, needles, context) {
  const text = await pageText(win);
  for (const needle of needles) {
    if (!text.includes(needle.toLowerCase())) problems.push(`${context}: expected to find "${needle}"`);
  }
}

async function goto(win, hash) {
  await win.webContents.executeJavaScript(`window.location.hash = ${JSON.stringify(hash)}`);
  // Pages render asynchronously after the hashchange.
  await new Promise((resolve) => setTimeout(resolve, 700));
}

// Screenshots land outside the repo so runs never dirty the working tree.
const SHOT_DIR = path.join(require('os').tmpdir(), 'coach-intel-ui');

async function shot(win, name) {
  const image = await win.webContents.capturePage();
  await require('fs').promises.mkdir(SHOT_DIR, { recursive: true });
  await require('fs').promises.writeFile(path.join(SHOT_DIR, `${name}.png`), image.toPNG());
}

// Shell + Team Hub coverage: every route in the nav must render without a
// console error and show the copy the layout spec calls for.
async function runShell(win) {
  const teams = await dataStore.getTeams();
  const teamId = teams[0]?.id;

  await goto(win, '#/dashboard');
  await expectText(win, ['Dashboard', 'Teams', 'Open Tasks', 'Scoreboard Inbox'], 'Dashboard');
  await shot(win, '01-dashboard');

  await goto(win, '#/needs-review');
  await expectText(win, ['Scoreboard Inbox', 'Drop scoreboard screenshots here'], 'Scoreboard Inbox');
  await shot(win, '01b-needs-review');

  await goto(win, '#/tasks');
  await expectText(win, ['Tasks'], 'Tasks');
  await shot(win, '02-tasks');

  if (!teamId) {
    problems.push('no teams in the data store, Team Hub coverage skipped');
    return;
  }

  const sections = [
    ['overview', ['QA Temp Team', 'Season Summary', 'Map Pool', 'Scoreboard inbox']],
    ['roster', ['Roster']],
    ['notes', ['Team Notes']],
    ['objectives', ['Objectives', 'Open']],
    ['veto', ['Veto History']],
    ['statistics', ['Statistics']],
    ['reports', ['Reports']],
    ['practice', ['Planner']],
    ['settings', ['Team Settings', 'Identity']],
  ];
  for (const [section, needles] of sections) {
    await goto(win, `#/team-hub/${teamId}/${section}`);
    await expectText(win, needles, `Team Hub / ${section}`);
    await shot(win, `10-hub-${section}`);
  }

  // Composers are where form controls live, and an unstyled control is only
  // visible once one is on screen.
  await goto(win, `#/team-hub/${teamId}/notes/new`);
  await expectText(win, ['Save Note', 'Cancel'], 'Team Hub / note composer');
  await shot(win, '10a-hub-note-composer');

  await goto(win, `#/team-hub/${teamId}/objectives`);
  await win.webContents.executeJavaScript(
    'Array.from(document.querySelectorAll("button")).find((b) => b.textContent.includes("New Objective"))?.click()'
  );
  await new Promise((resolve) => setTimeout(resolve, 400));
  await shot(win, '10b-hub-objective-composer');

  await goto(win, `#/playbooks/${teamId}`);
  await expectText(win, ['Strats & Playbooks', 'New Strat', 'Playbooks'], 'Playbooks');
  await shot(win, '11-playbooks');

  await goto(win, `#/playbooks/${teamId}/mode/hardpoint`);
  const activeMode = await win.webContents.executeJavaScript(
    'document.querySelector(".playbooks-modes .mode-chip.active")?.textContent || ""'
  );
  if (!activeMode.includes('HP')) problems.push('Playbooks mode filter did not mark Hardpoint active');
  await shot(win, '11-playbooks-hardpoint');

  await goto(win, `#/team-hub/${teamId}/strats/mode/hardpoint`);
  const hubStratHash = await win.webContents.executeJavaScript('window.location.hash');
  if (!hubStratHash.startsWith(`#/playbooks/${teamId}`)) {
    problems.push(`Team Hub strats link did not redirect, hash is ${hubStratHash}`);
  }

  // Legacy Command Center links must keep working.
  await goto(win, '#/command-center/' + teamId + '/strats');
  const hash = await win.webContents.executeJavaScript('window.location.hash');
  if (!hash.startsWith('#/playbooks/')) problems.push(`legacy command-center link did not redirect, hash is ${hash}`);

  await goto(win, '#/dashboard');
  const beforeCollapse = await win.webContents.executeJavaScript(
    'document.getElementById("sidebar").classList.contains("collapsed")'
  );
  await win.webContents.executeJavaScript('document.querySelector("#sidebar .sb-collapse")?.click()');
  await new Promise((resolve) => setTimeout(resolve, 400));
  const afterCollapse = await win.webContents.executeJavaScript(
    'document.getElementById("sidebar").classList.contains("collapsed")'
  );
  if (beforeCollapse === afterCollapse) problems.push('collapse button did not toggle the global navigation');
  const collapseChev = await win.webContents.executeJavaScript(`(() => {
    const btn = document.querySelector('#sidebar.collapsed .sb-collapse');
    const glyph = btn?.querySelector('.chev svg') || btn?.querySelector('.chev');
    if (!btn || !glyph) return { ok: false, reason: 'missing' };
    const r = glyph.getBoundingClientRect();
    const cs = getComputedStyle(glyph);
    return {
      ok: r.width >= 8 && r.height >= 8 && cs.display !== 'none' && cs.visibility !== 'hidden',
      width: r.width,
      display: cs.display,
    };
  })()`);
  if (!collapseChev?.ok) problems.push(`collapse chevron is not visible when nav is collapsed (${JSON.stringify(collapseChev)})`);
  await shot(win, '12-nav-collapsed');
  await win.webContents.executeJavaScript('document.querySelector("#sidebar .sb-collapse")?.click()');
  await new Promise((resolve) => setTimeout(resolve, 400));

  // Narrow viewport: the context panel becomes a toggleable drawer.
  const [w, h] = win.getSize();
  win.setSize(1120, 860);
  await goto(win, `#/team-hub/${teamId}/overview`);
  const toggleVisible = await win.webContents.executeJavaScript(
    'getComputedStyle(document.querySelector(".ctx-toggle")).display !== "none"'
  );
  if (!toggleVisible) problems.push('context panel toggle should be visible below 1340px');
  await shot(win, '13-narrow-hub');
  win.setSize(w, h);
  await new Promise((resolve) => setTimeout(resolve, 300));
}

// The seven routes that used to be "coming soon" must now render real screens
// against the real dataStore without a console error.
async function runPlanning(win) {
  const pages = [
    ['teams', ['Teams', 'Add Team'], '29-teams'],
    ['players', ['Members', 'Add Member', 'Roster'], '29a-players'],
    ['calendar', ['Calendar'], '30-calendar'],
    ['scrim-hub', ['Scrim Hub'], '31-scrim-hub'],
    ['vod-library', ['VOD Library'], '32-vod-library'],
    ['veto-lab', ['Veto Lab'], '33-veto-lab'],
    ['playbooks', ['Strats & Playbooks', 'Playbooks'], '37-playbooks'],
    ['scouting', ['Scouting'], '34-scouting'],
    ['reports', ['Reports'], '35-reports'],
    ['rankings', ['Rankings'], '36-rankings'],
  ];
  for (const [route, needles, shotName] of pages) {
    await goto(win, `#/${route}`);
    await expectText(win, needles, `Planning / ${route}`);
    await shot(win, shotName);
  }

  // No nav item may still be flagged "Soon" — the whole point of the build.
  const soonCount = await win.webContents.executeJavaScript(
    'document.querySelectorAll("#sidebar .badge-soon").length'
  );
  if (soonCount > 0) problems.push(`${soonCount} navigation item(s) still show a Soon badge`);
}

async function run(win) {
  await waitFor(win, 'document.getElementById("app").classList.contains("ready")', 'app shell to become ready');
  await new Promise((resolve) => setTimeout(resolve, 120));
  const splashExiting = await win.webContents.executeJavaScript(
    'document.getElementById("splash")?.classList.contains("dissolving")'
  );
  if (!splashExiting) problems.push('splash did not enter its visible exit transition');
  await shot(win, '00a-splash-exit');
  await runShell(win);
  await runPlanning(win);

  // Settings is sectioned: the bare route lands on Profile (the one section
  // every role can open), and every section is reachable by its own deep link.
  const settingsSections = [
    ['', ['Settings', 'Profile', 'Organization', 'Your Profile', 'Background'], '19-settings-profile'],
    ['/organization', ['Identity', 'Org Name', 'Logo', 'Highlight Color'], '19a-settings-organization'],
    ['/game-rules', ['Game & Season', 'Add Map'], '19b-settings-game-rules'],
    ['/integrations', ['Connected Services', 'Discord', 'Not Connected', 'Set Up', 'External Data'], '19c-settings-integrations'],
    ['/data', ['Storage', 'On-device only', 'Danger Zone', 'Delete All Data'], '19d-settings-data'],
    ['/feedback', ['Feedback', 'Category', 'Subject', 'Send Feedback'], '19f-settings-feedback'],
    ['/about', ['Coach Intel', 'Version', 'Ruleset'], '19e-settings-about'],
  ];
  for (const [suffix, needles, shotName] of settingsSections) {
    await goto(win, `#/settings${suffix}`);
    await waitFor(win, `${contentText}.includes("${needles[0]}")`, `Settings${suffix || ' (default)'}`);
    await expectText(win, needles, `Settings${suffix || ' (default)'}`);
    if (!suffix) {
      const titleTag = await win.webContents.executeJavaScript(
        'document.getElementById("org-profile-title")?.tagName || ""'
      );
      if (titleTag !== 'SELECT') problems.push(`Title should be a select, got ${titleTag || 'missing'}`);
    }
    await shot(win, shotName);
  }

  // Disconnected Integrations page shows the setup path.
  await goto(win, '#/integrations');
  await waitFor(win, `${contentText}.includes("Connect Discord Server")`, 'Integrations page (disconnected)');
  await expectText(
    win,
    ['Integrations', 'Discord', 'Not Connected', 'Connect Discord Server', 'What You Need First', 'Create a Discord application'],
    'Integrations (disconnected)'
  );
  await shot(win, '20-integrations-disconnected');

  // Connected Integrations page shows health, channels, notifications, roles, audit.
  discordMode = 'connected';
  await goto(win, '#/command-center');
  await goto(win, '#/integrations');
  await waitFor(win, `${contentText}.includes("Integration Health")`, 'Integrations page (connected)');
  await expectText(
    win,
    [
      'Connected',
      'Team Discord',
      'Test Connection',
      'Disconnect',
      'Integration Health',
      'Bot Token',
      'Last Verified',
      'Discord Channels',
      'General Intel',
      'Match Reports',
      'Strat Review',
      'VOD Review',
      'Alerts',
      'Discord Notifications',
      'Role Mapping',
      'Discord Activity Log',
    ],
    'Integrations (connected)'
  );
  await shot(win, '21-integrations-connected');

  // Every event group must be present in the preferences card.
  const groupsText = await win.webContents.executeJavaScript(
    'Array.from(document.querySelectorAll(".discord-group-label")).map((n) => n.textContent.toLowerCase()).join("|")'
  );
  for (const group of EVENT_GROUPS) {
    if (!groupsText.includes(group.toLowerCase())) {
      problems.push(`Integrations (connected): missing notification group "${group}"`);
    }
  }

  // Channel selectors and sensitivity selectors should be wired up.
  const selectCount = await win.webContents.executeJavaScript(
    'document.querySelectorAll(".discord-channel-row select").length'
  );
  if (selectCount !== CHANNEL_PURPOSES.length * 2) {
    problems.push(`expected ${CHANNEL_PURPOSES.length * 2} channel/sensitivity selects, found ${selectCount}`);
  }

  const prefCount = await win.webContents.executeJavaScript(
    'document.querySelectorAll(".discord-pref-row input[type=checkbox]").length'
  );
  if (prefCount !== EVENTS.length) {
    problems.push(`expected ${EVENTS.length} notification toggles, found ${prefCount}`);
  }

  // Unusable channels must be offered but disabled, not silently hidden.
  const disabledOption = await win.webContents.executeJavaScript(
    'Array.from(document.querySelectorAll(".discord-channel-row option")).some((o) => o.disabled && o.textContent.includes("private-coaches"))'
  );
  if (!disabledOption) problems.push('a channel missing permissions should appear as a disabled option');

  const teams = await dataStore.getTeams();
  const teamId = teams[0]?.id;
  if (!teamId) {
    problems.push('verify needs at least one team in the data store');
  } else {
    // Share → Discord should appear on the Intel Feed once Discord is connected.
    await goto(win, `#/command-center/${teamId}/intel`);
    await new Promise((resolve) => setTimeout(resolve, 600));
    const shareVisible = await win.webContents.executeJavaScript(
      'Array.from(document.querySelectorAll("button")).some((b) => b.textContent.trim() === "Share" && b.style.display !== "none")'
    );
    if (!shareVisible) problems.push('Intel Feed should show a visible Share button when Discord is connected');

    // Share → Discord should appear on a saved Strat.
    await goto(win, `#/command-center/${teamId}/strats`);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const stratsText = await pageText(win);
    if (!stratsText.includes('strat')) problems.push('Strats tab did not render the playbook');
  }

  // A coachintel:// link from a Discord notification must land on the right screen.
  await goto(win, '#/dashboard');
  win.webContents.send('cci:deepLink', 'integrations');
  await new Promise((resolve) => setTimeout(resolve, 700));
  const deepLinkHash = await win.webContents.executeJavaScript('window.location.hash');
  if (deepLinkHash !== '#/integrations') {
    problems.push(`a deep link should navigate the app, hash is ${deepLinkHash}`);
  }

  // Unknown routes from a stale link must be ignored rather than blanking the app.
  win.webContents.send('cci:deepLink', 'not-a-page/123');
  await new Promise((resolve) => setTimeout(resolve, 400));
  const afterBadLink = await win.webContents.executeJavaScript('window.location.hash');
  if (afterBadLink !== '#/integrations') {
    problems.push(`an unknown deep link should be ignored, hash is ${afterBadLink}`);
  }

  // The share dialog must offer only configured channels, plus the include toggles.
  await goto(win, '#/intel-feed');
  await new Promise((resolve) => setTimeout(resolve, 600));
  await win.webContents.executeJavaScript(
    'Array.from(document.querySelectorAll("button")).find((b) => b.textContent.trim() === "Share")?.click()'
  );
  await new Promise((resolve) => setTimeout(resolve, 600));

  const dialog = await win.webContents.executeJavaScript(`(() => {
    const modal = document.querySelector('.modal-overlay, .overlay, [class*="overlay"]');
    if (!modal) return null;
    const row = modal.querySelector('.discord-pref-row');
    return {
      text: modal.innerText,
      channels: Array.from(modal.querySelectorAll('select option')).map((o) => o.textContent),
      toggles: modal.querySelectorAll('input[type=checkbox]').length,
      rowDisplay: row ? getComputedStyle(row).display : null,
    };
  })()`);

  if (!dialog) {
    problems.push('the Share to Discord dialog did not open');
  } else {
    if (!dialog.text.toLowerCase().includes('share to discord')) {
      problems.push('the share dialog should be titled Share to Discord');
    }
    // Only the two mapped channels from the fixture are configured.
    if (dialog.channels.length !== 2) {
      problems.push(`the share dialog should offer 2 configured channels, offered ${dialog.channels.length}`);
    }
    if (dialog.toggles !== 3) {
      problems.push(`the share dialog should offer title/summary/link toggles, found ${dialog.toggles}`);
    }
    if (!dialog.text.toLowerCase().includes('screenshots and files are never sent')) {
      problems.push('the share dialog should state that screenshots and files are never sent');
    }
    // A toggle row is a <label>; if it inherits the block field-label style the
    // caption drops beneath its checkbox.
    if (dialog.rowDisplay !== 'flex') {
      problems.push(`share dialog toggles should sit beside their labels, row display is ${dialog.rowDisplay}`);
    }
    await shot(win, '22-share-dialog');
  }
}

if (!app) {
  console.error('✖ renderer smoke must run under Electron (ELECTRON_RUN_AS_NODE must be unset)');
  process.exit(1);
}

// A hung renderer would otherwise keep the harness alive forever.
const watchdog = setTimeout(() => {
  console.error('✖ renderer smoke: timed out after 120s');
  app.exit(1);
}, 120_000);
watchdog.unref();

app.whenReady().then(async () => {
  handleAssetProtocol();
  await dataStore.ensureDirectories();
  await dataStore.saveOrg({ name: 'QA Org', tag: 'QA', coachName: 'QA Coach' });
  const team = await dataStore.saveTeam({ name: 'QA Temp Team', tag: 'QAT' });
  await dataStore.saveMember(team.id, { gamertag: 'QATempPlayer', name: 'QA Player', role: 'Flex' });
  await dataStore.saveMatch(team.id, {
    opponent: 'Rivals',
    mode: 'Hardpoint',
    map: 'Skyline',
    result: 'Win',
    score: '250-180',
    date: '2026-08-01',
  });
  await dataStore.saveMatch(team.id, {
    opponent: 'Rivals',
    mode: 'Hardpoint',
    map: 'Skyline',
    result: 'Loss',
    score: '180-250',
    date: '2026-08-08',
  });
  await dataStore.saveMatch(team.id, {
    opponent: 'Rivals',
    mode: 'Hardpoint',
    map: 'Skyline',
    result: 'Win',
    score: '250-200',
    date: '2026-08-15',
  });
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
  win.webContents.on('render-process-gone', (e, details) => {
    problems.push(`renderer crashed: ${details.reason}`);
  });
  win.webContents.on('preload-error', (e, file, error) => {
    problems.push(`preload error in ${file}: ${error.message}`);
  });

  await win.loadFile(path.join(ROOT, 'src', 'renderer', 'index.html'));
  const activeSplashNames = async () => win.webContents.executeJavaScript(`(() => {
    const splash = document.getElementById('splash');
    return splash?.getAnimations({ subtree: true })
      .filter((animation) => animation.playState === 'running' && animation.effect?.getComputedTiming?.()?.progress != null)
      .map((animation) => animation.animationName)
      .filter(Boolean) || [];
  })()`);

  // Hold: background veil is lifting. Logos stay hidden until 1s.
  await new Promise((resolve) => setTimeout(resolve, 400));
  const rising = await activeSplashNames();
  if (!rising.includes('splashVeilLift')) {
    problems.push(`splash background veil is not lifting (${rising.join(', ') || 'none'})`);
  }
  if (!rising.includes('splashFrostLift')) {
    problems.push(`splash background blur is not lifting (${rising.join(', ') || 'none'})`);
  }
  if (rising.includes('splashMarkIn') || rising.includes('splashCopyIn')) {
    problems.push(`splash logo zoom started before the 1s veil lift (${rising.join(', ')})`);
  }

  // After the pit is fully up, the lockup must enter—not a static card.
  await new Promise((resolve) => setTimeout(resolve, 850));
  const zooming = await activeSplashNames();
  if (!zooming.includes('splashMarkIn') || !zooming.includes('splashCopyIn')) {
    problems.push(`splash logo zoom is not visibly running (${zooming.join(', ') || 'none'})`);
  }
  await shot(win, '00-intro-motion');

  // Preserve the branded lockup before the seven-second boot minimum completes.
  await new Promise((resolve) => setTimeout(resolve, 1200));
  await shot(win, '00-splash');

  try {
    await run(win);
  } catch (err) {
    problems.push(`harness error: ${err.message}`);
  }

  if (problems.length) {
    report(`✖ renderer smoke: ${problems.length} problem(s)`);
    for (const problem of problems) report(`  - ${problem}`);
  } else {
    report('✔ renderer smoke: shell, Team Hub and Discord screens rendered without errors');
  }

  app.exit(problems.length ? 1 : 0);
});
