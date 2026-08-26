const { app, BrowserWindow, ipcMain, dialog, nativeImage, shell, screen, clipboard, Menu } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const { registerAssetScheme, handleAssetProtocol } = require('./assetProtocol');

registerAssetScheme();

const dataStore = require('./dataStore');
const screenshotStore = require('./screenshotStore');
const planningStore = require('./planningStore');
const events = require('./events');
const discord = require('./discord');
const notificationStore = require('./notificationStore');
const supabase = require('./supabase');
const { syncLocalRosterToRemote, sharedWriteHint, mergeMemberLists } = require('./rosterSync');
const cloudSync = require('./cloudSync');
const { assertCanEdit, assertCanEditTeam, assertCanTransfer, assertCanManageOrg, assertNotProtectedPerson, scopeTeams, resolveAccessRole } = require('./access');
const { DEEP_LINK_SCHEME } = require('./discord/constants');
const { shouldClaimProtocol } = require('./packagedApp');
const { CODES } = require('./discord/redact');
const { buildFeedbackMailto } = require('./feedbackMailto');
const { autoUpdater } = require('electron-updater');

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
    backgroundColor: '#070908',
    title: 'Coach Intel',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 12 },
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

  mainWindow.webContents.on('context-menu', (event, params) => {
    if (params.mediaType === 'image' || params.hasImageContents) event.preventDefault();
  });

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

function inviteTokenFromUrl(url) {
  if (typeof url !== 'string') return null;
  const prefix = `${DEEP_LINK_SCHEME}://invite/`;
  if (!url.startsWith(prefix)) return null;
  const token = url.slice(prefix.length).split(/[?#]/)[0].trim();
  return /^[A-Za-z0-9_-]{16,64}$/.test(token) ? token : null;
}

function sendInviteEvent(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

async function teamsForSession(teams) {
  try {
    const state = await supabase.get().getState();
    if (!state?.session) return teams;
    const listed = await supabase.get().listProfiles();
    const me = listed?.me;
    const ids = listed?.teamIds || (await supabase.get().teamIdsForUser(me?.id));
    const role = resolveAccessRole(me, { names: listed?.linkedNames });
    return scopeTeams(teams, { role, teamIds: ids });
  } catch (err) {
    console.warn('[main] team scope failed', err.message);
    return teams;
  }
}

async function redeemPendingInvite() {
  const token = await supabase.get().getPendingToken();
  if (!token) return null;
  try {
    const result = await supabase.get().redeem(token);
    sendInviteEvent('cci:inviteResult', {
      ok: true,
      message: 'Discord is linked to this player. You will see their team and role.',
      ...result,
    });
    return result;
  } catch (err) {
    sendInviteEvent('cci:inviteResult', { ok: false, error: err.message });
    return null;
  }
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
      await redeemPendingInvite();
      sendAuthState({ session, error: null });
      syncLocalRosterToRemote({ supabase, dataStore }).catch((err) => {
        console.error('[main] roster sync after sign-in failed', err);
      });
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
  const inviteToken = inviteTokenFromUrl(url);
  if (inviteToken) {
    handleInviteLink(inviteToken);
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

async function handleInviteLink(token) {
  try {
    await supabase.get().setPending(token);
  } catch (err) {
    sendInviteEvent('cci:inviteResult', { ok: false, error: err.message });
    focusWindow();
    return;
  }
  try {
    const state = await supabase.get().getState();
    if (state?.session) {
      await redeemPendingInvite();
      focusWindow();
      return;
    }
    const preview = await supabase.get().preview(token).catch((err) => ({ ok: false, error: err.message }));
    sendInviteEvent('cci:invitePending', preview);
  } catch (err) {
    sendInviteEvent('cci:inviteResult', { ok: false, error: err.message });
  }
  focusWindow();
}

function appEntryPath() {
  const arg = process.argv.slice(1).find(
    (a) => a && !a.startsWith('-') && !String(a).startsWith(`${DEEP_LINK_SCHEME}://`)
  );
  return path.resolve(arg || process.cwd());
}

function launchUrlFromArgv(argv = process.argv) {
  return argv.find((a) => typeof a === 'string' && a.startsWith(`${DEEP_LINK_SCHEME}://`)) || null;
}

// Unpackaged `electron .` must pass this app's path, or macOS hands
// coachintel:// to some other Electron.app on the machine.
function registerDeepLinkProtocol() {
  if (!shouldClaimProtocol(app.isPackaged)) return;
  if (app.isPackaged) {
    app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME);
    return;
  }
  app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME, process.execPath, [appEntryPath()]);
}

// ---------- Auto-update (Windows) ----------
//
// Mac builds aren't code-signed, and Squirrel.Mac refuses to apply an unsigned
// update, so this only runs on win32 for now. `npm run release:win` publishes
// the installer + latest.yml to a GitHub Release; this is what checks that feed.
function initAutoUpdater() {
  if (process.platform !== 'win32' || !app.isPackaged) return;

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[main] update downloaded', info.version);
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update ready',
      message: `Coach Intel ${info.version} has been downloaded.`,
      detail: 'Restart now to install it, or keep working — it will install the next time you quit.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('[main] auto-update check failed', err.message);
  });

  autoUpdater.checkForUpdates().catch((err) => {
    console.error('[main] initial update check failed', err.message);
  });

  // Practice sessions can leave the app open for days — recheck periodically,
  // not just on launch.
  setInterval(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[main] periodic update check failed', err.message);
    });
  }, 4 * 60 * 60 * 1000);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  // Without this return, app.quit() only *requests* a shutdown — the rest of
  // this script (including app.whenReady().then(createWindow)) still runs in
  // the same tick, so a redundant launch could briefly spin up its own window
  // and even race the real instance for the OAuth code in the deep link.
  console.log('[main] another Coach Intel is already open');
  app.quit();
  return;
} else {
  app.on('second-instance', (event, argv) => {
    const link = launchUrlFromArgv(argv);
    if (link) handleDeepLink(link);
    else if (mainWindow && !mainWindow.isDestroyed()) mainWindow.focus();
  });
}

// open-url can fire before whenReady. Queue it so the auth callback is not
// dropped, and so a second Electron binary never has to start to receive it.
let pendingLaunchUrl = null;
app.on('open-url', (event, url) => {
  event.preventDefault();
  if (!app.isReady()) {
    pendingLaunchUrl = url;
    return;
  }
  handleDeepLink(url);
});

async function seedPackagedData() {
  const dest = path.join(app.getPath('userData'), 'data');
  const src = app.isPackaged
    ? path.join(process.resourcesPath, 'data')
    : path.join(__dirname, '..', '..', 'data');
  if (app.isPackaged) {
    const marker = path.join(dest, 'knowledge', 'cdl-ruleset.json');
    try {
      await fs.access(marker);
    } catch {
      try {
        await fs.cp(src, dest, { recursive: true });
      } catch (err) {
        console.error('[main] seed data copy failed', err);
      }
    }
  }
  try {
    await fs.cp(path.join(src, 'maps'), path.join(dest, 'maps'), { recursive: true, force: false });
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('[main] map art seed failed', err);
  }
}

app.whenReady().then(async () => {
  handleAssetProtocol();
  console.log('[main] ready', { packaged: app.isPackaged, userData: app.getPath('userData') });
  if (process.platform === 'darwin') {
    const icon = nativeImage.createFromPath(ICON_PATH);
    if (!icon.isEmpty()) app.dock.setIcon(icon);
  } else {
    // titleBarStyle: 'hiddenInset' and trafficLightPosition (in createWindow)
    // are macOS-only — on Windows the window falls back to Electron's default
    // frame, which without this would carry a generic File/Edit/View/Window/Help
    // menu bar that has nothing to do with the app.
    Menu.setApplicationMenu(null);
  }
  await seedPackagedData();
  await dataStore.ensureDirectories();

  registerDeepLinkProtocol();
  discord.init({
    dataRoot: dataStore.DATA_ROOT,
    getOrgName: async () => (await dataStore.getOrg())?.name || null,
  });
  try {
    supabase.init({ dataRoot: dataStore.DATA_ROOT });
    // Live roster sync: any teammate's change to teams/members pushes a refresh
    // to every open window, so the app updates without anyone reloading it.
    supabase.get().subscribeRealtime((table) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('cci:dataChanged', { table });
    });
    syncLocalRosterToRemote({ supabase, dataStore }).catch((err) => {
      console.error('[main] roster sync on launch failed', err);
    });
  } catch (err) {
    console.error('[main] supabase init failed', err);
  }

  // Domain events reach Discord only through this subscription, so the data layer
  // stays unaware of it. Delivery is filtered by the coach's notification
  // preferences, so an unconfigured or disconnected integration simply skips.
  events.subscribe((eventId, payload) => discord.get().publish(eventId, payload));

  createWindow();
  initAutoUpdater();

  const launchUrl = pendingLaunchUrl || launchUrlFromArgv();
  pendingLaunchUrl = null;
  if (launchUrl) handleDeepLink(launchUrl);

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

ipcMain.handle('cci:getOrg', () => cloudSync.hydrate('org'));
ipcMain.handle('cci:saveOrg', requireEdit(async (e, org) => {
  const saved = await dataStore.saveOrg(org);
  if (org?.accent) {
    supabase.get().syncAccent(org.accent).catch((err) => {
      console.warn('[main] accent sync failed', err.message);
    });
  }
  await cloudSave('org', '', saved);
  return saved;
}));

// Teams, members, matches, strats, notes, tasks, and planning all hydrate from
// Supabase when signed in. Local JSON is the working copy on this machine.
function ipcErrorMessage(err) {
  if (!err) return 'Something went wrong.';
  if (typeof err === 'string') return err;
  return err.message || err.details || err.hint || 'Something went wrong.';
}

async function withTimeout(promise, ms, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function requireEdit(handler) {
  return async (...args) => {
    await assertCanEdit(supabase);
    return handler(...args);
  };
}

function requireEditTeam(handler) {
  return async (e, teamId, ...rest) => {
    await assertCanEditTeam(supabase, teamId);
    return handler(e, teamId, ...rest);
  };
}

function requireOrgAdmin(handler) {
  return async (...args) => {
    await assertCanManageOrg(supabase);
    return handler(...args);
  };
}

function requireTransfer(handler) {
  return async (...args) => {
    await assertCanTransfer(supabase);
    return handler(...args);
  };
}

async function cloudSave(kind, teamId, saved) {
  const { session } = await supabase.get().getState();
  try {
    if (session) await cloudSync.push(kind, teamId, saved);
    return saved;
  } catch (err) {
    console.error('[main] cloud save failed', ipcErrorMessage(err));
    if (session) throw new Error(sharedWriteHint(err));
    return saved;
  }
}

async function cloudDelete(kind, teamId, id) {
  const { session } = await supabase.get().getState();
  try {
    if (session) await cloudSync.remove(kind, teamId, id);
  } catch (err) {
    console.error('[main] cloud delete failed', ipcErrorMessage(err));
    if (session) throw new Error(sharedWriteHint(err));
  }
}

ipcMain.handle('cci:getTeams', async () => {
  let remote = [];
  try {
    remote = await withTimeout(supabase.get().getTeams(), 2500, 'Loading teams');
  } catch (err) {
    console.error('[main] getTeams failed', ipcErrorMessage(err));
  }
  return dataStore.applyLocalLogos(await teamsForSession(await teamsWithLocal(remote)));
});
ipcMain.handle('cci:getTeam', async (e, teamId) => {
  const local = await dataStore.getTeam(teamId);
  let remote = null;
  try {
    remote = await supabase.get().getTeam(teamId);
  } catch (err) {
    console.error('[main] getTeam failed', ipcErrorMessage(err));
  }
  const merged = mergeTeam(remote, local);
  const allowed = await teamsForSession(merged ? [merged] : []);
  return dataStore.applyLocalLogo(allowed[0] || null);
});
ipcMain.handle('cci:saveTeam', requireEdit(async (e, team) => {
  if (team?.id && team.logo) await dataStore.patchTeamLogo(team.id, team.logo);
  const savedLocal = await dataStore.saveTeam(team);
  const payload = { ...team, ...savedLocal, id: savedLocal.id };
  const { session } = await supabase.get().getState();
  try {
    if (session) {
      await supabase.get().ensureProfile().catch(() => null);
      await supabase.get().saveTeam(payload);
    }
  } catch (err) {
    console.error('[main] saveTeam sync failed', sharedWriteHint(err));
    if (session) throw new Error(sharedWriteHint(err));
  }
  return dataStore.applyLocalLogo(savedLocal);
}));
ipcMain.handle('cci:deleteTeam', requireEdit(async (e, teamId) => {
  const { session } = await supabase.get().getState();
  try {
    await supabase.get().deleteTeam(teamId);
  } catch (err) {
    console.error('[main] deleteTeam failed', ipcErrorMessage(err));
    if (session) throw new Error(ipcErrorMessage(err));
  }
  // Teams moved to Supabase, but everything else this team owns (matches,
  // strats, notes, tasks, screenshots) is still local-only — without this, it
  // silently survives on disk forever after the team itself is gone.
  await dataStore.deleteTeam(teamId);
}));

function mergeTeam(remote, local) {
  if (!remote && !local) return null;
  if (!remote) return local; // created while offline/signed out, never synced yet
  if (!local) return remote;
  // Supabase is the shared source of truth once a team is synced — remote
  // wins on every field except logo, which is resolved from a local asset
  // path rather than stored as data in Supabase (see applyLocalLogo).
  return { ...local, ...remote, logo: local.logo || remote.logo };
}

async function teamsWithLocal(remote) {
  const local = await dataStore.getTeams();
  const localById = new Map((local || []).filter((t) => t?.id).map((t) => [t.id, t]));
  const seen = new Set();
  const out = [];
  for (const team of remote || []) {
    if (!team?.id) continue;
    seen.add(team.id);
    out.push(mergeTeam(team, localById.get(team.id)));
  }
  for (const team of local || []) {
    if (team?.id && !seen.has(team.id)) out.push(team);
  }
  return out;
}

async function membersWithLocal(teamId, remote) {
  const local = await dataStore.getMembers(teamId);
  return mergeMemberLists(local, remote);
}

ipcMain.handle('cci:getMembers', async (e, teamId) => {
  let remote = [];
  try {
    remote = await withTimeout(supabase.get().getMembers(teamId), 2500, 'Loading roster');
  } catch (err) {
    console.error('[main] getMembers failed', ipcErrorMessage(err));
  }
  return membersWithLocal(teamId, remote);
});
ipcMain.handle('cci:getMember', async (e, teamId, memberId) => {
  const local = await dataStore.getMember(teamId, memberId);
  try {
    const remote = await supabase.get().getMember(teamId, memberId);
    if (!remote) return local;
    return {
      ...local,
      ...remote,
      user_id: remote.user_id || local?.user_id || null,
      linked: remote.linked || local?.linked || null,
    };
  } catch (err) {
    console.error('[main] getMember failed', ipcErrorMessage(err));
    return local;
  }
});
ipcMain.handle('cci:saveMember', requireEditTeam(async (e, teamId, member) => {
  const { linked, ...safe } = member || {};
  const savedLocal = await dataStore.saveMember(teamId, {
    ...safe,
    updated_at: new Date().toISOString(),
  });
  const { session } = await supabase.get().getState();
  try {
    if (session) await supabase.get().ensureProfile().catch(() => null);
    const remote = await supabase.get().saveMember(teamId, { ...safe, ...savedLocal, id: savedLocal.id });
    return { ...savedLocal, ...remote };
  } catch (err) {
    console.error('[main] saveMember failed', ipcErrorMessage(err));
    if (session) throw new Error(sharedWriteHint(err));
    return savedLocal;
  }
}));
ipcMain.handle('cci:deleteMember', requireEditTeam(async (e, teamId, memberId) => {
  const { session } = await supabase.get().getState();
  const existing = await dataStore.getMember(teamId, memberId).catch(() => null)
    || (session ? await supabase.get().getMember(teamId, memberId).catch(() => null) : null);
  assertNotProtectedPerson(existing, 'Super Admin cannot be removed from the roster.');
  try {
    await supabase.get().deleteMember(teamId, memberId);
  } catch (err) {
    console.error('[main] deleteMember failed', ipcErrorMessage(err));
    if (session) throw new Error(ipcErrorMessage(err));
  }
  await dataStore.deleteMember(teamId, memberId);
  return true;
}));
async function transferAndSync(fromTeamId, toTeamId, memberId, opts) {
  const savedLocal = await dataStore.transferMember(fromTeamId, toTeamId, memberId, opts || {});
  const { session } = await supabase.get().getState();
  try {
    const remote = await supabase.get().transferMember(fromTeamId, toTeamId, memberId, opts || {});
    return { ...savedLocal, ...remote };
  } catch (err) {
    console.error('[main] transferMember failed', ipcErrorMessage(err));
    if (session) throw new Error(ipcErrorMessage(err));
    return savedLocal;
  }
}

ipcMain.handle('cci:transferMember', requireTransfer((e, fromTeamId, toTeamId, memberId, opts) =>
  transferAndSync(fromTeamId, toTeamId, memberId, opts)
));
ipcMain.handle('cci:transferMembers', requireTransfer(async (e, fromTeamId, toTeamId, memberIds, opts) => {
  const moved = [];
  for (const id of memberIds || []) {
    moved.push(await transferAndSync(fromTeamId, toTeamId, id, opts));
  }
  return moved;
}));

ipcMain.handle('cci:getMatches', (e, teamId) => cloudSync.hydrate('match', teamId));
ipcMain.handle('cci:saveMatch', requireEdit(async (e, teamId, match) => {
  const saved = await dataStore.saveMatch(teamId, match);
  return cloudSave('match', teamId, saved);
}));
ipcMain.handle('cci:deleteMatch', requireEdit(async (e, teamId, matchId) => {
  await dataStore.deleteMatch(teamId, matchId);
  await cloudDelete('match', teamId, matchId);
  return true;
}));

ipcMain.handle('cci:getStrats', (e, teamId) => cloudSync.hydrate('strat', teamId));
ipcMain.handle('cci:getStrat', async (e, teamId, stratId) => {
  await cloudSync.hydrate('strat', teamId);
  return dataStore.getStrat(teamId, stratId);
});
const stratAnnounceStore = { ...dataStore, getTeam: (teamId) => supabase.get().getTeam(teamId) };
ipcMain.handle('cci:saveStrat', requireEdit(async (e, teamId, strat) => {
  const saved = await events.saveStratAndAnnounce(stratAnnounceStore, teamId, strat);
  return cloudSave('strat', teamId, saved);
}));

const planningAnnounceStore = {
  ...planningStore,
  getTeam: (teamId) => supabase.get().getTeam(teamId),
  getMembers: (teamId) => supabase.get().getMembers(teamId),
};
ipcMain.handle('cci:deleteStrat', requireEdit(async (e, teamId, stratId) => {
  await dataStore.deleteStrat(teamId, stratId);
  await cloudDelete('strat', teamId, stratId);
  return true;
}));
ipcMain.handle('cci:duplicateStrat', requireEdit(async (e, teamId, stratId) => {
  const saved = await dataStore.duplicateStrat(teamId, stratId);
  return cloudSave('strat', teamId, saved);
}));
ipcMain.handle('cci:restoreStratVersion', requireEdit(async (e, teamId, stratId, version) => {
  const saved = await dataStore.restoreStratVersion(teamId, stratId, version);
  return cloudSave('strat', teamId, saved);
}));

ipcMain.handle('cci:getNotes', (e, teamId) => cloudSync.hydrate('note', teamId));
ipcMain.handle('cci:saveNote', requireEdit(async (e, teamId, note) => {
  const saved = await dataStore.saveNote(teamId, note);
  return cloudSave('note', teamId, saved);
}));
ipcMain.handle('cci:deleteNote', requireEdit(async (e, teamId, noteId) => {
  await dataStore.deleteNote(teamId, noteId);
  await cloudDelete('note', teamId, noteId);
  return true;
}));

ipcMain.handle('cci:getTasks', (e, teamId) => cloudSync.hydrate('task', teamId));
ipcMain.handle('cci:saveTask', requireEdit(async (e, teamId, task) => {
  const saved = await dataStore.saveTask(teamId, task);
  return cloudSave('task', teamId, saved);
}));
ipcMain.handle('cci:deleteTask', requireEdit(async (e, teamId, taskId) => {
  await dataStore.deleteTask(teamId, taskId);
  await cloudDelete('task', teamId, taskId);
  return true;
}));

ipcMain.handle('cci:getEvents', (e, teamId) => cloudSync.hydrate('event', teamId));
ipcMain.handle('cci:saveEvent', requireEdit(async (e, teamId, event) => {
  const saved = await events.saveEventAndAnnounce(planningAnnounceStore, teamId, event);
  return cloudSave('event', teamId, saved);
}));
ipcMain.handle('cci:deleteEvent', requireEdit(async (e, teamId, eventId) => {
  await planningStore.deleteEvent(teamId, eventId);
  await cloudDelete('event', teamId, eventId);
  return true;
}));

ipcMain.handle('cci:getNotifications', (e, teamId) => cloudSync.hydrate('notification', teamId));
ipcMain.handle('cci:deleteNotification', async (e, teamId, id) => {
  await notificationStore.deleteNotification(teamId, id);
  await cloudDelete('notification', teamId, id);
  return true;
});

ipcMain.handle('cci:getScrims', (e, teamId) => cloudSync.hydrate('scrim', teamId));
ipcMain.handle('cci:saveScrim', requireEdit(async (e, teamId, scrim) => {
  const saved = await events.saveScrimAndAnnounce(planningAnnounceStore, teamId, scrim);
  return cloudSave('scrim', teamId, saved);
}));
ipcMain.handle('cci:deleteScrim', requireEdit(async (e, teamId, scrimId) => {
  await planningStore.deleteScrim(teamId, scrimId);
  await cloudDelete('scrim', teamId, scrimId);
  return true;
}));

ipcMain.handle('cci:getVods', (e, teamId) => cloudSync.hydrate('vod', teamId));
ipcMain.handle('cci:saveVod', requireEdit(async (e, teamId, vod) => {
  const saved = await planningStore.saveVod(teamId, vod);
  return cloudSave('vod', teamId, saved);
}));
ipcMain.handle('cci:deleteVod', requireEdit(async (e, teamId, vodId) => {
  await planningStore.deleteVod(teamId, vodId);
  await cloudDelete('vod', teamId, vodId);
  return true;
}));

ipcMain.handle('cci:getVetoes', (e, teamId) => cloudSync.hydrate('veto', teamId));
ipcMain.handle('cci:saveVeto', requireEdit(async (e, teamId, veto) => {
  const saved = await planningStore.saveVeto(teamId, veto);
  return cloudSave('veto', teamId, saved);
}));
ipcMain.handle('cci:deleteVeto', requireEdit(async (e, teamId, vetoId) => {
  await planningStore.deleteVeto(teamId, vetoId);
  await cloudDelete('veto', teamId, vetoId);
  return true;
}));

ipcMain.handle('cci:getOpponents', () => cloudSync.hydrate('opponent'));
ipcMain.handle('cci:getOpponent', async (e, opponentId) => {
  await cloudSync.hydrate('opponent');
  return planningStore.getOpponent(opponentId);
});
ipcMain.handle('cci:saveOpponent', requireEdit(async (e, opponent) => {
  const saved = await planningStore.saveOpponent(opponent);
  return cloudSave('opponent', '', saved);
}));
ipcMain.handle('cci:deleteOpponent', requireEdit(async (e, opponentId) => {
  await planningStore.deleteOpponent(opponentId);
  await cloudDelete('opponent', '', opponentId);
  return true;
}));

ipcMain.handle('cci:getRankings', () => cloudSync.hydrate('rankings'));
ipcMain.handle('cci:saveRankings', requireEdit(async (e, rankings) => {
  const saved = await planningStore.saveRankings(rankings);
  return cloudSave('rankings', '', saved);
}));

ipcMain.handle('cci:deleteAllData', requireOrgAdmin(() => dataStore.deleteAllData()));
ipcMain.handle('cci:getAppVersion', () => app.getVersion());
ipcMain.handle('cci:setTrafficLights', (e, collapsed) => {
  if (process.platform !== 'darwin') return;
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.setTrafficLightPosition({ x: 14, y: 12 });
});

ipcMain.handle('cci:getNeedsReview', (e, teamId) => dataStore.getNeedsReview(teamId));
ipcMain.handle('cci:listScoreboards', (e, teamId) => screenshotStore.listPending(teamId));
ipcMain.handle('cci:importScoreboards', requireEdit(async (e, teamId, payload) => {
  const team = await supabase.get().getTeam(teamId);
  if (!team) throw new Error('Team not found');
  return screenshotStore.importScoreboards(teamId, payload || {});
}));
ipcMain.handle('cci:deleteScoreboard', requireEdit((e, teamId, filename, bucket) =>
  screenshotStore.deleteScoreboard(teamId, filename, bucket || 'inbox')
));
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
ipcMain.handle('cci:getCdlRuleset', () => cloudSync.hydrate('ruleset'));
ipcMain.handle('cci:updateCdlRulesetMeta', requireEdit(async (e, updates) => {
  const saved = await dataStore.updateCdlRulesetMeta(updates);
  await cloudSave('ruleset', '', saved);
  return saved;
}));
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

async function saveRulesetChange(record) {
  await cloudSave('ruleset', '', await dataStore.getCdlRuleset());
  return record;
}

ipcMain.handle('cci:addCdlMap', requireEdit(async (e, map) => {
  const record = await dataStore.addCdlMap(map);
  await announceCdlChange('added', record, (record.modes || []).join(', ') || null);
  return saveRulesetChange(record);
}));

ipcMain.handle('cci:updateCdlMap', requireEdit(async (e, mapId, updates) => {
  const record = await dataStore.updateCdlMap(mapId, updates);
  await announceCdlChange('updated', record, Object.keys(updates || {}).join(', ') || null);
  return saveRulesetChange(record);
}));

ipcMain.handle('cci:deactivateCdlMap', requireEdit(async (e, mapId) => {
  const record = await dataStore.deactivateCdlMap(mapId);
  await announceCdlChange('deactivated', record, 'No longer in the competitive pool');
  return saveRulesetChange(record);
}));

ipcMain.handle('cci:restoreCdlMap', requireEdit(async (e, mapId) => {
  const record = await dataStore.restoreCdlMap(mapId);
  await announceCdlChange('restored', record, 'Back in the competitive pool');
  return saveRulesetChange(record);
}));

ipcMain.handle('cci:removeCdlMap', requireEdit(async (e, mapId, opts) => {
  const map = (await dataStore.getCdlRuleset())?.maps.find((m) => m.map_id === mapId) || null;
  const result = await dataStore.removeCdlMap(mapId, opts);
  if (!result.blocked) await announceCdlChange('removed', map, 'Deleted from the map pool');
  if (!result.blocked) await cloudSave('ruleset', '', await dataStore.getCdlRuleset());
  return result;
}));

ipcMain.handle('cci:updateCdlMapModes', requireEdit(async (e, mapId, activeModes) => {
  const record = await dataStore.updateCdlMapModes(mapId, activeModes);
  await announceCdlChange('modes', record, `Active modes: ${(activeModes || []).join(', ') || 'none'}`);
  return saveRulesetChange(record);
}));

ipcMain.handle('cci:getMapObjectives', async (e, mapSlug, mapName, mode) => {
  await cloudSync.hydrate('map_obj');
  return dataStore.getMapObjectives(mapSlug, mapName, mode);
});
ipcMain.handle('cci:saveMapObjectives', requireEdit(async (e, mapSlug, mapName, mode, data) => {
  const saved = await dataStore.saveMapObjectives(mapSlug, mapName, mode, data);
  await cloudSave('map_obj', '', { ...saved, map_slug: mapSlug });
  return saved;
}));

ipcMain.handle('cci:pickImage', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});
ipcMain.handle('cci:pickImageFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});
ipcMain.handle('cci:listFolderImages', (e, folderPath) => dataStore.listFolderImages(folderPath));

// Local write is what the UI waits on; the cloud copy is best-effort and never
// blocks the upload — same "local succeeds regardless" shape as cloudSave. This
// is what makes an uploaded photo/logo visible from a second machine at all,
// not just the relative-path string that already synced through teams/members.
async function syncAssetToCloud(relative) {
  try {
    const fullPath = dataStore.resolveDataPath(relative);
    if (!fullPath) return;
    const buffer = await fs.readFile(fullPath);
    const ext = path.extname(fullPath).slice(1).toLowerCase();
    const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext || 'png'}`;
    await supabase.get().uploadAsset(relative, buffer, mime);
  } catch (err) {
    console.warn('[main] asset cloud sync failed (non-fatal):', err.message);
  }
}

const NOTE_IMAGE_MIMES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

function safeAttachmentSegment(value, label) {
  const segment = String(value || '');
  if (!segment || segment === '.' || segment === '..' || /[/\\]/.test(segment) || segment.startsWith('.')) {
    throw new Error(`Invalid ${label}.`);
  }
  return segment;
}

ipcMain.handle('cci:attachNoteImage', requireEdit(async (e, teamId, noteId, sourcePath) => {
  const safeTeamId = safeAttachmentSegment(teamId, 'team');
  const safeNoteId = safeAttachmentSegment(noteId, 'note');
  const ext = path.extname(String(sourcePath || '')).toLowerCase();
  const mime = NOTE_IMAGE_MIMES[ext];
  if (!mime) throw new Error('Choose a PNG, JPG, JPEG, or WebP image.');
  const relative = `org/teams/${safeTeamId}/data/note-images/${safeNoteId}/${crypto.randomUUID()}${ext}`;
  const saved = await dataStore.copyImage(sourcePath, relative);
  syncAssetToCloud(saved).catch(() => {});
  return {
    id: path.basename(saved, ext),
    path: saved,
    name: path.basename(String(sourcePath || '')).slice(0, 160),
    mime,
  };
}));

ipcMain.handle('cci:copyImage', requireEdit(async (e, sourcePath, destRelative) => {
  const rel = await dataStore.copyImage(sourcePath, destRelative);
  syncAssetToCloud(rel).catch(() => {});
  return rel;
}));

const PROFILE_PHOTO_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp']);

ipcMain.handle('cci:updateMyProfile', async (e, payload) => {
  const { session } = await supabase.get().getState();
  if (!session?.user?.id) throw new Error('Sign in first.');
  return supabase.get().updateMyProfile(payload || {});
});

ipcMain.handle('cci:setMyPhoto', async (e, sourcePath) => {
  const { session } = await supabase.get().getState();
  if (!session?.user?.id) throw new Error('Sign in to set a photo the rest of the org can see.');
  const ext = path.extname(String(sourcePath || '')).slice(1).toLowerCase();
  if (!PROFILE_PHOTO_EXTS.has(ext)) throw new Error('Choose a PNG, JPG, or WebP image.');
  const userId = String(session.user.id);
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error('Invalid account.');
  const relative = `org/profiles/${userId}.${ext === 'jpeg' ? 'jpg' : ext}`;
  const saved = await dataStore.copyImage(sourcePath, relative);
  syncAssetToCloud(saved).catch(() => {});
  await supabase.get().updateMyPhoto(saved);
  return saved;
});
ipcMain.handle('cci:saveMapArt', requireEdit(async (e, sourcePath, mapName, layoutKey) => {
  const rel = await dataStore.saveMapArt(sourcePath, mapName, layoutKey);
  syncAssetToCloud(rel).catch(() => {});
  return rel;
}));

// ---------- Discord integration ----------
//
// Every handler goes through discord.safeCall, which returns
// { ok: true, data } or { ok: false, code, message } with all secrets redacted —
// so a bot token can never reach the renderer, not even inside an error.

const withDiscord = (fn) => (event, ...args) => discord.safeCall(() => fn(discord.get(), ...args));

ipcMain.handle('cci:discordGetState', withDiscord((svc) => svc.getState()));
ipcMain.handle('cci:discordBeginConnect', requireEdit(withDiscord((svc, payload) => svc.beginConnect(payload || {}))));
ipcMain.handle('cci:discordCompleteConnect', requireEdit(withDiscord((svc, payload) => svc.completeConnect(payload || {}))));
ipcMain.handle('cci:discordCancelConnect', requireEdit(withDiscord((svc) => svc.cancelConnect())));
ipcMain.handle('cci:discordListChannels', withDiscord((svc, payload) => svc.listChannels(payload || {})));
ipcMain.handle('cci:discordListRoles', withDiscord((svc) => svc.listRoles()));
ipcMain.handle('cci:discordSaveChannels', requireEdit(withDiscord((svc, payload) => svc.saveChannels(payload || {}))));
ipcMain.handle('cci:discordSavePreferences', requireEdit(withDiscord((svc, payload) => svc.savePreferences(payload || {}))));
ipcMain.handle('cci:discordTest', requireEdit(withDiscord((svc, payload) => svc.test(payload || {}))));
ipcMain.handle('cci:discordShare', requireEdit(withDiscord((svc, payload) => svc.share(payload || {}))));
ipcMain.handle('cci:discordPublish', requireEdit(withDiscord((svc, eventId, payload) => svc.publish(eventId, payload || {}))));
ipcMain.handle('cci:discordVerify', withDiscord((svc, payload) => svc.verify(payload || {})));
ipcMain.handle('cci:discordDisconnect', requireEdit(withDiscord((svc, payload) => svc.disconnect(payload || {}))));
ipcMain.handle('cci:discordAudit', withDiscord((svc, payload) => svc.auditRecent(payload || {})));
ipcMain.handle('cci:discordListMessages', withDiscord((svc) => svc.listRecentMessages()));
ipcMain.handle('cci:discordSendChatMessage', requireEdit(withDiscord((svc, payload) => svc.sendChatMessage(payload || {}))));

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

ipcMain.handle('cci:syncRoster', requireEdit(() => syncLocalRosterToRemote({ supabase, dataStore })));
ipcMain.handle('cci:syncNow', () => syncLocalRosterToRemote({ supabase, dataStore }));

ipcMain.handle('cci:authGetState', () => supabase.get().getState());
ipcMain.handle('cci:authSignInWithDiscord', () => safeSupabaseCall(() => supabase.get().signInWithDiscord()));
ipcMain.handle('cci:authSignOut', async () => {
  await supabase.get().signOut();
  sendAuthState({ session: null, error: null });
});
ipcMain.handle('cci:authListProfiles', () => safeSupabaseCall(() => supabase.get().listProfiles()));
ipcMain.handle('cci:authUpdateRole', requireEdit((e, userId, role) => safeSupabaseCall(() => supabase.get().updateProfileRole(userId, role))));

ipcMain.handle('cci:inviteCreate', async (e, payload) => {
  await assertCanEditTeam(supabase, payload?.teamId);
  return safeSupabaseCall(() => supabase.get().create(payload || {}));
});
ipcMain.handle('cci:inviteStatus', (e, teamId, memberId) =>
  safeSupabaseCall(() => supabase.get().status(teamId, memberId))
);
ipcMain.handle('cci:inviteRevoke', requireEditTeam((e, teamId, memberId) =>
  safeSupabaseCall(() => supabase.get().revoke(teamId, memberId))
));
ipcMain.handle('cci:invitePending', () => safeSupabaseCall(() => supabase.get().pending()));
ipcMain.handle('cci:inviteRedeem', (e, token) => safeSupabaseCall(() => supabase.get().redeem(token)));

// ---------- Feedback ----------
//
// Primary path is a Supabase row (durable, RLS-scoped to the sender). The
// mailto fallback is used when there is no signed-in session to write with,
// or the renderer chooses "Open in email instead" — the recipient is fixed in
// feedbackMailto.js, never taken from this call's payload.
ipcMain.handle('cci:submitFeedback', (e, entry) => safeSupabaseCall(() => supabase.get().submitFeedback(entry || {})));
ipcMain.handle('cci:sendFeedbackEmail', async (e, entry) => {
  try {
    await shell.openExternal(buildFeedbackMailto(entry || {}));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('cci:copyText', (e, text) => {
  clipboard.writeText(String(text || ''));
  return true;
});

// Discord's own domains, plus the Coach Intel site.
const ALLOWED_EXTERNAL_HOSTS = new Set([
  'discord.com',
  'discord.dev',
  'support.discord.com',
  'coach.championshipseries.eu',
]);

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

const MEDIA_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'twitch.tv',
  'www.twitch.tv',
  'm.twitch.tv',
  'clips.twitch.tv',
  'player.twitch.tv',
]);

ipcMain.handle('cci:openMedia', async (e, url) => {
  try {
    const parsed = new URL(String(url));
    if (parsed.protocol !== 'https:') return false;
    if (!MEDIA_HOSTS.has(parsed.hostname.toLowerCase())) return false;
    await shell.openExternal(parsed.toString());
    return true;
  } catch {
    return false;
  }
});

function toDataUrl(fullPath, buf) {
  const ext = path.extname(fullPath).slice(1).toLowerCase();
  const mime = ext === 'jpg' ? 'jpeg' : ext || 'png';
  return `data:image/${mime};base64,${buf.toString('base64')}`;
}

// Falls back to the org-assets Storage bucket only when the file doesn't exist
// on this machine — e.g. a fresh install, or a machine that never uploaded this
// particular photo itself. A hit is cached to disk so it's a normal fast local
// read from then on, same as everything else this app treats as local-cache-of-
// cloud-truth. Any failure here (offline, not signed in, never uploaded) just
// falls through to null, exactly like today's "no image" case.
async function downloadAssetFallback(relative, fullPath) {
  try {
    const buf = await supabase.get().downloadAsset(relative);
    if (!buf) return null;
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buf);
    return toDataUrl(fullPath, buf);
  } catch (err) {
    console.warn('[main] asset cloud download failed:', err.message);
    return null;
  }
}

function packagedDataFile(relative) {
  const rel = String(relative || '').replace(/^[/\\]+/, '');
  if (!rel || rel.includes('..') || path.isAbsolute(rel)) return null;
  const root = app.isPackaged
    ? path.join(process.resourcesPath, 'data')
    : path.join(__dirname, '..', '..', 'data');
  const dest = path.resolve(root, rel);
  if (dest !== root && !dest.startsWith(root + path.sep)) return null;
  return dest;
}

ipcMain.handle('cci:dataUrlForPath', async (e, relative) => {
  const fullPath = dataStore.resolveDataPath(relative);
  if (fullPath) {
    try {
      const buf = await fs.readFile(fullPath);
      return toDataUrl(fullPath, buf);
    } catch {
      /* try the packaged map-art library next */
    }
  }
  const bundled = packagedDataFile(relative);
  if (bundled) {
    try {
      const buf = await fs.readFile(bundled);
      return toDataUrl(bundled, buf);
    } catch {
      /* cloud last */
    }
  }
  return fullPath ? downloadAssetFallback(relative, fullPath) : null;
});
