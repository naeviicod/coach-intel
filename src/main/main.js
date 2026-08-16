const { app, BrowserWindow, ipcMain, dialog, nativeImage, shell, screen } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { registerAssetScheme, handleAssetProtocol } = require('./assetProtocol');

registerAssetScheme();

const dataStore = require('./dataStore');
const screenshotStore = require('./screenshotStore');
const planningStore = require('./planningStore');
const events = require('./events');
const discord = require('./discord');
const supabase = require('./supabase');
const { DEEP_LINK_SCHEME } = require('./discord/constants');
const { CODES } = require('./discord/redact');

app.setName('Coach Intel');
console.log('[main] Coach Intel starting');

const ICON_PATH = path.join(__dirname, '..', '..', 'build', 'icon.png');

let mainWindow;
// Route from a coachintel:// link that arrived before the window was ready.
let queuedDeepLink = null;

function createWindow() {
  const work = screen.getPrimaryDisplay().workArea;
  mainWindow = new BrowserWindow({
    x: work.x,
    y: work.y,
    width: work.width,
    height: work.height,
    minWidth: 1040,
    minHeight: 680,
    backgroundColor: '#080a0c',
    title: 'Coach Intel',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    icon: ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow.setTitle('Coach Intel');

  mainWindow.webContents.on('console-message', (e, level, message) => {
    if (level >= 2) console.log('[renderer]', message);
  });
  mainWindow.webContents.once('did-finish-load', () => {
    console.log('[main] Coach Intel window loaded');
    if (queuedDeepLink) {
      mainWindow.webContents.send('cci:deepLink', queuedDeepLink);
      queuedDeepLink = null;
    }
  });
}

// ---------- Deep links (coachintel://<route>) ----------

// Discord embeds render this scheme as copyable text rather than a clickable link,
// so the link is shown as inline code in the message; opening it focuses the app here.
function routeFromDeepLink(url) {
  if (typeof url !== 'string') return null;
  const prefix = `${DEEP_LINK_SCHEME}://`;
  if (!url.startsWith(prefix)) return null;
  const route = url.slice(prefix.length).replace(/^\/+/, '').trim();
  // Only accept simple route segments — never arbitrary content from a link.
  if (!/^[A-Za-z0-9/_-]*$/.test(route)) return null;
  return route || 'command-center';
}

function focusWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

// coachintel://auth-callback?code=... arrives here after the system browser
// finishes the Discord OAuth handshake with Supabase. It carries a query string,
// so it must be caught before routeFromDeepLink's route-segment regex — that
// regex would just reject it and the sign-in would silently go nowhere.
function isAuthCallback(url) {
  return typeof url === 'string' && url.startsWith(`${DEEP_LINK_SCHEME}://auth-callback`);
}

function sendAuthState(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('cci:authStateChanged', payload);
}

// Gates a fresh sign-in on membership in the org's Discord server, using the
// bot connection set up under Settings -> Integrations — not the OAuth `guilds`
// scope, so the app never needs to ask Discord for extra permissions at sign-in.
// If the bot isn't connected to a server yet, there is nothing to check against,
// so every sign-in is let through until an admin connects it.
async function checkGuildMembership(session) {
  const discordUserId =
    session?.user?.user_metadata?.provider_id ||
    session?.user?.identities?.find((i) => i.provider === 'discord')?.id ||
    null;

  let discordState;
  try {
    discordState = await discord.get().getState();
  } catch {
    return { blocked: false };
  }
  if (!discordState.connected || !discordState.integration?.guild_id || !discordUserId) {
    return { blocked: false };
  }

  try {
    await discord.get().client.get(`/guilds/${discordState.integration.guild_id}/members/${discordUserId}`);
    return { blocked: false };
  } catch (err) {
    if (err && err.code === CODES.CHANNEL_NOT_FOUND) {
      const guildName = discordState.integration.guild_name || 'the org';
      return {
        blocked: true,
        reason: `That Discord account isn't a member of ${guildName}'s server yet. Ask an admin to invite you there, then sign in again.`,
      };
    }
    // Network blip, rate limit, etc. — don't block a legitimate sign-in over a
    // transient failure to check.
    console.warn('[main] guild membership check failed, allowing sign-in:', err.message);
    return { blocked: false };
  }
}

async function handleAuthCallback(url) {
  try {
    const session = await supabase.get().handleCallback(url);
    if (!session) {
      focusWindow();
      return;
    }
    const membership = await checkGuildMembership(session);
    if (membership.blocked) {
      await supabase.get().signOut();
      sendAuthState({ session: null, error: membership.reason });
    } else {
      sendAuthState({ session, error: null });
    }
  } catch (err) {
    console.error('[main] supabase auth callback failed', err.message);
    sendAuthState({ session: null, error: err.message });
  }
  focusWindow();
}

function handleDeepLink(url) {
  if (isAuthCallback(url)) {
    handleAuthCallback(url);
    return;
  }
  const route = routeFromDeepLink(url);
  if (!route) return;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('cci:deepLink', route);
    focusWindow();
  } else {
    queuedDeepLink = route;
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  console.log('[main] another Coach Intel is already open');
  app.quit();
} else {
  app.on('second-instance', (event, argv) => {
    const link = argv.find((arg) => arg.startsWith(`${DEEP_LINK_SCHEME}://`));
    if (link) handleDeepLink(link);
    else if (mainWindow && !mainWindow.isDestroyed()) mainWindow.focus();
  });
}

app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

async function seedPackagedData() {
  if (!app.isPackaged) return;
  const dest = path.join(app.getPath('userData'), 'data');
  const marker = path.join(dest, 'knowledge', 'cdl-ruleset.json');
  try {
    await fs.access(marker);
    return;
  } catch {
    // First launch of the packaged app — copy the bundled seed data out of
    // the read-only .app so teams, ruleset and knowledge can be written.
  }
  const src = path.join(process.resourcesPath, 'data');
  try {
    await fs.cp(src, dest, { recursive: true });
  } catch (err) {
    console.error('[main] seed data copy failed', err);
  }
}

app.whenReady().then(async () => {
  handleAssetProtocol();
  console.log('[main] ready', { packaged: app.isPackaged, userData: app.getPath('userData') });
  if (process.platform === 'darwin') {
    const icon = nativeImage.createFromPath(ICON_PATH);
    if (!icon.isEmpty()) app.dock.setIcon(icon);
  }
  await seedPackagedData();
  await dataStore.ensureDirectories();

  app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME);
  discord.init({
    dataRoot: dataStore.DATA_ROOT,
    getOrgName: async () => (await dataStore.getOrg())?.name || null,
  });
  supabase.init({ dataRoot: dataStore.DATA_ROOT });

  // Domain events reach Discord only through this subscription, so the data layer
  // stays unaware of it. Delivery is filtered by the coach's notification
  // preferences, so an unconfigured or disconnected integration simply skips.
  events.subscribe((eventId, payload) => discord.get().publish(eventId, payload));

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch((err) => {
  console.error('[main] startup failed', err);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------- IPC ----------

ipcMain.handle('cci:getOrg', () => dataStore.getOrg());
ipcMain.handle('cci:saveOrg', (e, org) => dataStore.saveOrg(org));

ipcMain.handle('cci:getTeams', () => dataStore.getTeams());
ipcMain.handle('cci:getTeam', (e, teamId) => dataStore.getTeam(teamId));
ipcMain.handle('cci:saveTeam', (e, team) => dataStore.saveTeam(team));
ipcMain.handle('cci:deleteTeam', (e, teamId) => dataStore.deleteTeam(teamId));

ipcMain.handle('cci:getMembers', (e, teamId) => dataStore.getMembers(teamId));
ipcMain.handle('cci:getMember', (e, teamId, memberId) => dataStore.getMember(teamId, memberId));
ipcMain.handle('cci:saveMember', (e, teamId, member) => dataStore.saveMember(teamId, member));
ipcMain.handle('cci:deleteMember', (e, teamId, memberId) => dataStore.deleteMember(teamId, memberId));

ipcMain.handle('cci:getMatches', (e, teamId) => dataStore.getMatches(teamId));

ipcMain.handle('cci:getStrats', (e, teamId) => dataStore.getStrats(teamId));
ipcMain.handle('cci:getStrat', (e, teamId, stratId) => dataStore.getStrat(teamId, stratId));
ipcMain.handle('cci:saveStrat', (e, teamId, strat) => events.saveStratAndAnnounce(dataStore, teamId, strat));
ipcMain.handle('cci:deleteStrat', (e, teamId, stratId) => dataStore.deleteStrat(teamId, stratId));
ipcMain.handle('cci:duplicateStrat', (e, teamId, stratId) => dataStore.duplicateStrat(teamId, stratId));
ipcMain.handle('cci:restoreStratVersion', (e, teamId, stratId, version) => dataStore.restoreStratVersion(teamId, stratId, version));

ipcMain.handle('cci:getNotes', (e, teamId) => dataStore.getNotes(teamId));
ipcMain.handle('cci:saveNote', (e, teamId, note) => dataStore.saveNote(teamId, note));
ipcMain.handle('cci:deleteNote', (e, teamId, noteId) => dataStore.deleteNote(teamId, noteId));

ipcMain.handle('cci:getTasks', (e, teamId) => dataStore.getTasks(teamId));
ipcMain.handle('cci:saveTask', (e, teamId, task) => dataStore.saveTask(teamId, task));
ipcMain.handle('cci:deleteTask', (e, teamId, taskId) => dataStore.deleteTask(teamId, taskId));

// ---------- Planning & prep (Calendar, Scrim Hub, VOD Library, Veto Lab) ----------

ipcMain.handle('cci:getEvents', (e, teamId) => planningStore.getEvents(teamId));
ipcMain.handle('cci:saveEvent', (e, teamId, event) => planningStore.saveEvent(teamId, event));
ipcMain.handle('cci:deleteEvent', (e, teamId, eventId) => planningStore.deleteEvent(teamId, eventId));

ipcMain.handle('cci:getScrims', (e, teamId) => planningStore.getScrims(teamId));
ipcMain.handle('cci:saveScrim', (e, teamId, scrim) => planningStore.saveScrim(teamId, scrim));
ipcMain.handle('cci:deleteScrim', (e, teamId, scrimId) => planningStore.deleteScrim(teamId, scrimId));

ipcMain.handle('cci:getVods', (e, teamId) => planningStore.getVods(teamId));
ipcMain.handle('cci:saveVod', (e, teamId, vod) => planningStore.saveVod(teamId, vod));
ipcMain.handle('cci:deleteVod', (e, teamId, vodId) => planningStore.deleteVod(teamId, vodId));

ipcMain.handle('cci:getVetoes', (e, teamId) => planningStore.getVetoes(teamId));
ipcMain.handle('cci:saveVeto', (e, teamId, veto) => planningStore.saveVeto(teamId, veto));
ipcMain.handle('cci:deleteVeto', (e, teamId, vetoId) => planningStore.deleteVeto(teamId, vetoId));

// ---------- Scouting & Rankings (org-level) ----------

ipcMain.handle('cci:getOpponents', () => planningStore.getOpponents());
ipcMain.handle('cci:getOpponent', (e, opponentId) => planningStore.getOpponent(opponentId));
ipcMain.handle('cci:saveOpponent', (e, opponent) => planningStore.saveOpponent(opponent));
ipcMain.handle('cci:deleteOpponent', (e, opponentId) => planningStore.deleteOpponent(opponentId));

ipcMain.handle('cci:getRankings', () => planningStore.getRankings());
ipcMain.handle('cci:saveRankings', (e, rankings) => planningStore.saveRankings(rankings));

ipcMain.handle('cci:deleteAllData', () => dataStore.deleteAllData());
ipcMain.handle('cci:getAppVersion', () => app.getVersion());
ipcMain.handle('cci:setTrafficLights', (e, collapsed) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.setTrafficLightPosition(collapsed ? { x: 14, y: 16 } : { x: 16, y: 18 });
});

ipcMain.handle('cci:getNeedsReview', (e, teamId) => dataStore.getNeedsReview(teamId));
ipcMain.handle('cci:listScoreboards', (e, teamId) => screenshotStore.listPending(teamId));
ipcMain.handle('cci:importScoreboards', async (e, teamId, payload) => {
  const team = await dataStore.getTeam(teamId);
  if (!team) throw new Error('Team not found');
  return screenshotStore.importScoreboards(teamId, payload || {});
});
ipcMain.handle('cci:deleteScoreboard', (e, teamId, filename, bucket) =>
  screenshotStore.deleteScoreboard(teamId, filename, bucket || 'inbox')
);
async function defaultScoreboardDir() {
  try {
    await fs.access(screenshotStore.DEFAULT_SCRIM_SB_DIR);
    return screenshotStore.DEFAULT_SCRIM_SB_DIR;
  } catch {
    return undefined;
  }
}
ipcMain.handle('cci:pickScoreboards', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    defaultPath: await defaultScoreboardDir(),
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Scoreboard screenshots', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
  });
  if (result.canceled || !result.filePaths.length) return [];
  return result.filePaths;
});
ipcMain.handle('cci:pickScoreboardFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    defaultPath: await defaultScoreboardDir(),
    properties: ['openDirectory'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});
ipcMain.handle('cci:getMetaKnowledge', () => dataStore.getMetaKnowledge());
ipcMain.handle('cci:getCdlRuleset', () => dataStore.getCdlRuleset());
ipcMain.handle('cci:updateCdlRulesetMeta', (e, updates) => dataStore.updateCdlRulesetMeta(updates));
// Ruleset edits are the one piece of shared reference data a whole org depends on,
// so each change is announced through the domain event layer.
async function announceCdlChange(change, map, detail) {
  if (!map) return;
  const org = await dataStore.getOrg();
  await events.cdlRulesetChanged({
    change,
    mapId: map.map_id,
    mapName: map.name,
    detail,
    stamp: map.updated_at || map.deactivated_at || null,
    actor: org?.coachName || 'Coach',
  });
}

ipcMain.handle('cci:addCdlMap', async (e, map) => {
  const record = await dataStore.addCdlMap(map);
  await announceCdlChange('added', record, (record.modes || []).join(', ') || null);
  return record;
});

ipcMain.handle('cci:updateCdlMap', async (e, mapId, updates) => {
  const record = await dataStore.updateCdlMap(mapId, updates);
  await announceCdlChange('updated', record, Object.keys(updates || {}).join(', ') || null);
  return record;
});

ipcMain.handle('cci:deactivateCdlMap', async (e, mapId) => {
  const record = await dataStore.deactivateCdlMap(mapId);
  await announceCdlChange('deactivated', record, 'No longer in the competitive pool');
  return record;
});

ipcMain.handle('cci:restoreCdlMap', async (e, mapId) => {
  const record = await dataStore.restoreCdlMap(mapId);
  await announceCdlChange('restored', record, 'Back in the competitive pool');
  return record;
});

ipcMain.handle('cci:removeCdlMap', async (e, mapId, opts) => {
  const map = (await dataStore.getCdlRuleset())?.maps.find((m) => m.map_id === mapId) || null;
  const result = await dataStore.removeCdlMap(mapId, opts);
  if (!result.blocked) await announceCdlChange('removed', map, 'Deleted from the map pool');
  return result;
});

ipcMain.handle('cci:updateCdlMapModes', async (e, mapId, activeModes) => {
  const record = await dataStore.updateCdlMapModes(mapId, activeModes);
  await announceCdlChange('modes', record, `Active modes: ${(activeModes || []).join(', ') || 'none'}`);
  return record;
});

ipcMain.handle('cci:pickImage', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('cci:copyImage', (e, sourcePath, destRelative) =>
  dataStore.copyImage(sourcePath, destRelative)
);
ipcMain.handle('cci:saveMapArt', (e, sourcePath, mapName) =>
  dataStore.saveMapArt(sourcePath, mapName)
);

// ---------- Discord integration ----------
//
// Every handler goes through discord.safeCall, which returns
// { ok: true, data } or { ok: false, code, message } with all secrets redacted —
// so a bot token can never reach the renderer, not even inside an error.

const withDiscord = (fn) => (event, ...args) => discord.safeCall(() => fn(discord.get(), ...args));

ipcMain.handle('cci:discordGetState', withDiscord((svc) => svc.getState()));
ipcMain.handle('cci:discordBeginConnect', withDiscord((svc, payload) => svc.beginConnect(payload || {})));
ipcMain.handle('cci:discordCompleteConnect', withDiscord((svc, payload) => svc.completeConnect(payload || {})));
ipcMain.handle('cci:discordCancelConnect', withDiscord((svc) => svc.cancelConnect()));
ipcMain.handle('cci:discordListChannels', withDiscord((svc, payload) => svc.listChannels(payload || {})));
ipcMain.handle('cci:discordListRoles', withDiscord((svc) => svc.listRoles()));
ipcMain.handle('cci:discordSaveChannels', withDiscord((svc, payload) => svc.saveChannels(payload || {})));
ipcMain.handle('cci:discordSavePreferences', withDiscord((svc, payload) => svc.savePreferences(payload || {})));
ipcMain.handle('cci:discordTest', withDiscord((svc, payload) => svc.test(payload || {})));
ipcMain.handle('cci:discordShare', withDiscord((svc, payload) => svc.share(payload || {})));
ipcMain.handle('cci:discordPublish', withDiscord((svc, eventId, payload) => svc.publish(eventId, payload || {})));
ipcMain.handle('cci:discordVerify', withDiscord((svc, payload) => svc.verify(payload || {})));
ipcMain.handle('cci:discordDisconnect', withDiscord((svc, payload) => svc.disconnect(payload || {})));
ipcMain.handle('cci:discordAudit', withDiscord((svc, payload) => svc.auditRecent(payload || {})));

// ---------- Auth (Supabase, Discord sign-in) ----------

// Supabase/Postgres errors carry no secrets worth redacting (unlike the Discord
// bot token), so this just normalizes them into the same { ok, data|error }
// envelope the Discord IPC handlers use.
async function safeSupabaseCall(fn) {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    return { ok: false, error: err?.message || 'Something went wrong.' };
  }
}

ipcMain.handle('cci:authGetState', () => supabase.get().getState());
ipcMain.handle('cci:authSignInWithDiscord', () => supabase.get().signInWithDiscord());
ipcMain.handle('cci:authSignOut', () => supabase.get().signOut());
ipcMain.handle('cci:authListProfiles', () => safeSupabaseCall(() => supabase.get().listProfiles()));
ipcMain.handle('cci:authUpdateRole', (e, userId, role) => safeSupabaseCall(() => supabase.get().updateProfileRole(userId, role)));

// Only Discord's own domains may be opened from the integration screens.
const ALLOWED_EXTERNAL_HOSTS = new Set(['discord.com', 'discord.dev', 'support.discord.com']);

ipcMain.handle('cci:openExternal', async (e, url) => {
  try {
    const parsed = new URL(String(url));
    if (parsed.protocol !== 'https:') return false;
    if (!ALLOWED_EXTERNAL_HOSTS.has(parsed.hostname)) return false;
    await shell.openExternal(parsed.toString());
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('cci:dataUrlForPath', async (e, relative) => {
  const fullPath = dataStore.resolveDataPath(relative);
  if (!fullPath) return null;
  try {
    const buf = await fs.readFile(fullPath);
    const ext = path.extname(fullPath).slice(1).toLowerCase();
    const mime = ext === 'jpg' ? 'jpeg' : ext || 'png';
    return `data:image/${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
});
