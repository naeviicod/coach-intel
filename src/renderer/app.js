import { el, icon, faceMark, verifiedMark } from './utils.js';
import { asset } from './lib/assets.js';
import { applyAccent, resolveAccent, DEFAULT_ACCENT } from './lib/accent.js';
import { applyBackground, preloadBackground, DEFAULT_BACKGROUND } from './lib/background.js';
import { getPref, setPref } from './prefs.js';
import {
  canAccessPage,
  canEditTeam,
  canTransferMembers,
  defaultLanding,
  localStaffAccess,
  accessFromProfile,
  roleLabel as accessRoleLabel,
} from './lib/access.js';
import { chipIdentity } from './lib/profile.js';
import { orgRefreshBtn } from './lib/orgRefresh.js';
import { orgIsProvisioned, shouldRunOnboarding, shouldRunUnlinked } from './lib/orgLock.js';
import { toast } from './components/modal.js';
import { openFeedbackModal, stashFeedback } from './components/feedback.js';
import * as onboarding from './pages/onboarding.js';
import * as signIn from './pages/signIn.js';
import * as dashboard from './pages/dashboard.js';
import * as intelFeed from './pages/intelFeed.js';
import * as tasksPage from './pages/tasksPage.js';
import * as teamsPage from './pages/teamsPage.js';
import * as playersPage from './pages/playersPage.js';
import * as memberProfile from './pages/memberProfile.js';
import * as matchLog from './pages/matchLog.js';
import * as insights from './pages/insights.js';
import * as databasePage from './pages/databasePage.js';
import * as needsReview from './pages/needsReview.js';
import * as teamHub from './pages/teamHub/index.js';
import * as mapsModes from './pages/mapsModes.js';
import * as scouting from './pages/scouting.js';
import * as calendar from './pages/calendar.js';
import * as vodLibrary from './pages/vodLibrary.js';
import * as scrimHub from './pages/scrimHub.js';
import * as vetoLab from './pages/vetoLab.js';
import * as warRoom from './pages/warRoom.js';
import * as playbooks from './pages/playbooks.js';
import * as reports from './pages/reports.js';
import * as rankings from './pages/rankings.js';
import * as integrationsPage from './pages/integrations.js';
import * as settingsPage from './pages/settings/index.js';

const routes = {
  dashboard,
  'intel-feed': intelFeed,
  calendar,
  tasks: tasksPage,

  teams: teamsPage,
  players: playersPage,
  matches: matchLog,
  statistics: insights,
  'vod-library': vodLibrary,
  database: databasePage,
  'needs-review': needsReview,

  'team-hub': teamHub,
  'scrim-hub': scrimHub,
  playbooks,

  'maps-modes': mapsModes,
  'veto-lab': vetoLab,
  'war-room': warRoom,
  scouting,
  reports,
  rankings,

  integrations: integrationsPage,
  settings: settingsPage,

  member: memberProfile,
};

const NAV_GROUPS = [
  {
    label: 'Main',
    items: [
      { page: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
      { page: 'intel-feed', label: 'Intel Feed', icon: 'intel' },
      { page: 'calendar', label: 'Calendar', icon: 'calendar' },
      { page: 'tasks', label: 'Tasks', icon: 'tasks' },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { page: 'teams', label: 'Teams', icon: 'teams' },
      { page: 'players', label: 'Members', icon: 'players', aliases: ['member'] },
      { page: 'matches', label: 'Matches', icon: 'matches' },
      { page: 'statistics', label: 'Statistics', icon: 'performance' },
      { page: 'database', label: 'Member Database', icon: 'database' },
      { page: 'reports', label: 'Reports', icon: 'reports' },
      { page: 'rankings', label: 'Rankings', icon: 'rankings' },
    ],
  },
  {
    label: 'Team',
    items: [
      { page: 'team-hub', label: 'Team Hub', icon: 'teamHub' },
      { page: 'playbooks', label: 'Strats & Playbooks', icon: 'strats' },
      { page: 'scrim-hub', label: 'Scrim Hub', icon: 'scrim' },
      { page: 'vod-library', label: 'VOD Library', icon: 'vod' },
      { page: 'needs-review', label: 'Scoreboard Inbox', icon: 'review' },
      { page: 'veto-lab', label: 'Veto Lab', icon: 'veto' },
      { page: 'war-room', label: 'War Room', icon: 'objectives' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { page: 'maps-modes', label: 'Maps & Modes', icon: 'mapsModes' },
      { page: 'scouting', label: 'Scouting', icon: 'scouting' },
    ],
  },
  {
    label: 'Integrations',
    items: [{ page: 'integrations', label: 'Integrations', icon: 'integrations' }],
  },
];

const NAV_BOTTOM = { page: 'settings', label: 'Settings', icon: 'settings' };

// Command Center used to be the team workspace with everything as tabs. Those
// deep links still need to resolve: team-scoped tabs move into the Team Hub,
// org-wide tabs graduate to their own global routes.
const LEGACY_TAB_ROUTES = {
  matches: (teamId) => `#/matches/${teamId}`,
  performance: (teamId) => `#/statistics/${teamId}`,
  'maps-modes': (teamId) => `#/maps-modes/${teamId}`,
  intel: (teamId) => `#/intel-feed/${teamId}`,
  strats: (teamId) => `#/playbooks/${teamId}`,
};

const SPLASH_MIN_MS = 7000;
const SPLASH_VEIL_MS = 1000;
const SPLASH_BAR_MS = 280;
// Keep in step with --dur-splash in styles.css.
const SPLASH_DISSOLVE_MS = 420;
const ART_PRELOAD_MS = 1500;
const BOOT_TIMEOUT_MS = 10000;
const NAV_AUTO_COLLAPSE_PX = 1024;
const TEAM_NAV_PAGES = new Set([
  'team-hub',
  'playbooks',
  'scrim-hub',
  'vod-library',
  'needs-review',
  'veto-lab',
  'war-room',
]);
const bootStart = performance.now();
window.__cciBootStart = bootStart;

let state = { org: null, teams: [], searchIndex: [], ruleset: null, alerts: 0, notifications: [], route: parseHash(), access: localStaffAccess(), online: false, syncing: false, refreshing: false };
let navCollapsed = false;
let navForced = false;
let studioForced = false;
let collapseBtn = null;
let tooltipEl = null;
let booted = false;

function parseHash() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const [page, ...rest] = hash.split('/');
  return { page: page || 'dashboard', param: rest.join('/') || null };
}

function legacyRedirect({ page, param }) {
  if (page === 'team-hub') {
    const parts = (param || '').split('/').filter(Boolean);
    if (parts[1] === 'strats') {
      const rest = parts.slice(2).join('/');
      return rest ? `#/playbooks/${parts[0]}/${rest}` : `#/playbooks/${parts[0]}`;
    }
    return null;
  }
  if (page !== 'command-center') return null;
  const [teamId, tab] = (param || '').split('/');
  if (!teamId) return '#/team-hub';
  const toGlobal = LEGACY_TAB_ROUTES[tab];
  if (toGlobal) return toGlobal(teamId);
  const section = tab && teamHub.SECTIONS.includes(tab) ? `/${tab}` : '';
  return `#/team-hub/${teamId}${section}`;
}

function rememberedTeamId() {
  return getPref('lastTeamId') || state.teams[0]?.id || null;
}

function navigate(page, param) {
  if (!canAccessPage(state.access?.role, page)) {
    page = defaultLanding(state.access?.role);
    param = page === 'team-hub' ? rememberedTeamId() : null;
  }
  const hash = param ? `#/${page}/${param}` : `#/${page}`;
  if (window.location.hash === hash) {
    state.route = parseHash();
    renderTopbar();
    renderContent();
    syncNavActive();
    return;
  }
  window.location.hash = hash;
}
window.cciNavigate = navigate;

// A coachintel:// link — the one Discord notifications carry — arrives from the
// main process as a bare route. Unknown pages are ignored so a stale or hand-edited
// link cannot navigate the app somewhere that does not exist.
window.cci?.onDeepLink?.((route) => {
  const clean = String(route || '').replace(/^#?\/?/, '');
  if (!clean) return;
  const [page, ...rest] = clean.split('/');
  const target = { page, param: rest.join('/') || null };
  const redirect = legacyRedirect(target);
  if (redirect) {
    window.location.hash = redirect;
    return;
  }
  if (!routes[page]) return;
  navigate(page, target.param || undefined);
});

// Another signed-in teammate wrote to the org. Debounce so a burst of
// roster + photo + plan rows does not rebuild the shell ten times; then
// re-read from Supabase (each get* hydrates) so this window matches theirs.
let liveRefreshTimer = 0;
let liveDeferContent = false;
window.cci?.onDataChanged?.((payload) => {
  if (!booted) return;
  const event = new CustomEvent('cci:remote-data-change', { cancelable: true, detail: payload || {} });
  document.dispatchEvent(event);
  liveDeferContent = event.defaultPrevented;
  window.clearTimeout(liveRefreshTimer);
  liveRefreshTimer = window.setTimeout(() => {
    const deferContent = liveDeferContent;
    loadShellData()
      .then(() => {
        renderSidebar();
        renderTopbar();
        renderStatusBar();
        if (!deferContent) renderContent();
      })
      .catch((err) => console.error('[renderer] data refresh failed', err));
    loadNotifications()
      .then(() => paintBell())
      .catch((err) => console.error('[renderer] notifications refresh failed', err));
  }, 400);
});

// Sign-in/out flips the topbar between "Offline · On-device" (local cache
// only) and "Online · Synced" (signed in, Supabase is the source of truth)
// without needing a restart.
window.cci?.auth?.onAuthStateChanged?.(({ session } = {}) => {
  if (!booted) {
    if (session && document.querySelector('.signin-screen')) enterApp();
    return;
  }
  loadAccess()
    .then(() => {
      renderSidebar();
      renderTopbar();
    })
    .catch((err) => console.error('[renderer] auth state refresh failed', err));
});

window.cci?.invites?.onResult?.((result) => {
  if (result?.ok) toast(result.message || 'Invite accepted.');
  else if (result?.error) toast(result.error, 'error');
  if (!booted) return;
  loadShellData()
    .then(() => {
      renderSidebar();
      renderTopbar();
      renderStatusBar();
      renderContent();
    })
    .catch((err) => console.error('[renderer] invite refresh failed', err));
});

document.addEventListener('click', (e) => {
  const wrap = document.querySelector('.topbar-notif-wrap');
  if (!wrap || wrap.contains(e.target)) return;
  const panel = wrap.querySelector('.topbar-notif-panel');
  if (panel) panel.style.display = 'none';
});

window.addEventListener('hashchange', () => {
  if (!booted) {
    state.route = parseHash();
    return;
  }
  const next = parseHash();
  const redirect = legacyRedirect(next);
  if (redirect) {
    window.location.replace(redirect);
    return;
  }
  if (!allowedRoute(next.page)) {
    const land = defaultLanding(state.access?.role);
    const teamId = land === 'team-hub' ? rememberedTeamId() : null;
    window.location.replace(teamId ? `#/${land}/${teamId}` : `#/${land}`);
    return;
  }
  state.route = next;
  renderTopbar();
  renderContent();
  syncNavActive();
});

// ---------- Boot ----------

async function loadShellData(onProgress, { search = true } = {}) {
  state.syncing = true;
  paintStatusPill();
  try {
    await loadShellDataBody(onProgress, { search });
  } finally {
    state.syncing = false;
    paintStatusPill();
  }
}

async function refreshOrg({ silent = false } = {}) {
  if (state.refreshing) return;
  state.refreshing = true;
  state.syncing = true;
  document.body.classList.add('is-refreshing');
  paintStatusPill();
  try {
    let failed = false;
    if (state.online && window.cci.syncNow) {
      const result = await window.cci.syncNow();
      if (result?.ok === false && result.errors?.length) {
        failed = true;
        if (!silent) toast(result.errors[0], 'error');
      }
    }
    await loadShellData();
    renderSidebar();
    renderTopbar();
    renderStatusBar();
    await renderContent();
    if (!silent && !failed) toast('Org is up to date.');
  } catch (err) {
    console.error('[renderer] org refresh failed', err);
    if (!silent) toast(err?.message || 'Could not refresh.', 'error');
  } finally {
    state.refreshing = false;
    state.syncing = false;
    document.body.classList.remove('is-refreshing');
    paintStatusPill();
  }
}

document.addEventListener('cci:org-refresh', () => {
  refreshOrg().catch((err) => console.error('[renderer] org refresh failed', err));
});

async function loadShellDataBody(onProgress, { search = true } = {}) {
  state.org = await window.cci.getOrg();
  onProgress?.(0.48);
  state.teams = await window.cci.getTeams();
  onProgress?.(0.58);
  state.ruleset = await window.cci.getCdlRuleset();
  let inviteAccent = null;
  if (!state.teams.length && window.cci.invites?.pending) {
    const pending = await Promise.race([
      window.cci.invites.pending().catch(() => null),
      new Promise((resolve) => setTimeout(() => resolve(null), 1500)),
    ]);
    inviteAccent = pending?.ok ? pending.data?.accent : null;
  }
  const accent = resolveAccent({
    invite: inviteAccent,
    org: state.org?.accent,
    shared: state.teams.find((team) => team?.accent)?.accent,
    firstLaunch: !orgIsProvisioned(state.org) && !state.teams.length,
  });
  if (state.org) state.org = { ...state.org, accent };
  // Splash stays Intel Lime. Accent and wallpaper wait until the splash hides.
  state.appVersion = await window.cci.getAppVersion();
  await loadAccess();
  onProgress?.(0.68);
  if (search) await buildSearchIndex();
  else {
    state.searchIndex = [];
    buildSearchIndex().catch((err) => console.error('[renderer] search index failed', err));
  }
  onProgress?.(0.8);
}

async function loadAccess() {
  try {
    const auth = await window.cci.auth.getState();
    state.online = Boolean(auth?.configured && auth.session);
    if (!auth?.configured || !auth.session) {
      state.access = localStaffAccess();
      applyAccessChrome();
      return;
    }
    const listed = await window.cci.auth.listProfiles();
    const me = listed?.ok ? listed.data?.me : null;
    const teamIds = listed?.ok ? listed.data?.teamIds : [];
    const linkedNames = listed?.ok ? listed.data?.linkedNames : [];
    state.access = accessFromProfile(me, { local: !me, teamIds, linkedNames });
  } catch (err) {
    console.warn('[renderer] access load failed', err);
    state.access = localStaffAccess();
    state.online = false;
  }
  applyAccessChrome();
}

function applyAccessChrome() {
  document.body.classList.toggle('access-readonly', !state.access?.canEdit);
}

function allowedRoute(page) {
  return canAccessPage(state.access?.role, page);
}

async function buildSearchIndex() {
  const index = [];
  for (const map of state.ruleset?.maps || []) {
    if (!map.active) continue;
    index.push({ type: 'Map', label: map.name, action: () => navigate('maps-modes') });
  }
  for (const team of state.teams) {
    index.push({ type: 'Team', label: team.name, action: () => navigate('team-hub', team.id) });

    const [members, strats, notes] = await Promise.all([
      window.cci.getMembers(team.id),
      window.cci.getStrats(team.id),
      window.cci.getNotes(team.id),
    ]);
    for (const m of members) {
      index.push({ type: 'Player', label: `${m.gamertag} — ${team.name}`, action: () => navigate('member', `${team.id}/${m.id}`) });
    }
    for (const s of strats) {
      index.push({
        type: 'Strat',
        label: `${s.strategy_name} — ${s.map} ${s.mode}`,
        action: () => navigate('playbooks', `${team.id}/edit/${s.strategy_id}`),
      });
    }
    for (const n of notes) {
      index.push({ type: 'Note', label: n.title, action: () => navigate('team-hub', `${team.id}/notes`) });
    }
  }
  state.searchIndex = index;
}

async function loadAlerts() {
  let count = 0;
  for (const team of state.teams) {
    const queue = await window.cci.getNeedsReview(team.id).catch(() => []);
    count += (queue || []).length;
  }
  state.alerts = count;
}

function seenNotificationIds() {
  return new Set(getPref('seenNotifications') || []);
}

function markNotificationSeen(id) {
  const seen = getPref('seenNotifications') || [];
  if (seen.includes(id)) return;
  setPref('seenNotifications', [...seen, id].slice(-300));
}

async function loadNotifications() {
  const rows = [];
  for (const team of state.teams) {
    const items = await window.cci.getNotifications(team.id).catch(() => []);
    for (const n of items) rows.push({ ...n, teamName: team.name });
  }
  rows.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
  state.notifications = rows;
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Accent and wallpaper land while the splash is still fully opaque. The app
// therefore appears on its finished backdrop, rather than changing surfaces
// as the splash clears.
let lookApplied = false;
let splashSignalled = false;
let entering = false;

function applySavedLook() {
  lookApplied = true;
  applyAccent(state.org?.accent || DEFAULT_ACCENT);
  applyBackground(getPref('background', DEFAULT_BACKGROUND));
}

function signalSplashDone() {
  if (splashSignalled) return;
  splashSignalled = true;
  document.dispatchEvent(new CustomEvent('cci:splash-done'));
}

function settleAtmosphere() {
  document.getElementById('atmosphere')?.classList.add('settled');
}

// Destination sits behind the splash during boot. Reveal starts with the
// fade so the finished screen is already there under an opacity dissolve.
function revealApp() {
  const app = document.getElementById('app');
  if (!app || app.dataset.splashRevealed === '1') return;
  app.dataset.splashRevealed = '1';
  requestAnimationFrame(() => app.classList.remove('booting'));
}

function finishSplash(splash) {
  if (!splash) {
    applySavedLook();
    signalSplashDone();
    settleAtmosphere();
    revealApp();
    return;
  }
  if (splash.dataset.done === '1') return;
  splash.dataset.done = '1';
  splash.setAttribute('aria-hidden', 'true');
  const hide = () => {
    splash.classList.add('hide');
    splash.style.display = 'none';
    signalSplashDone();
    settleAtmosphere();
  };
  applySavedLook();
  if (prefersReducedMotion()) {
    hide();
    revealApp();
    return;
  }
  splash.classList.add('dissolving');
  revealApp();
  let finished = false;
  const settle = () => {
    if (finished) return;
    finished = true;
    splash.removeEventListener('transitionend', onEnd);
    hide();
  };
  const onEnd = (event) => {
    if (event && event.target !== splash) return;
    if (event && event.propertyName && event.propertyName !== 'opacity') return;
    settle();
  };
  splash.addEventListener('transitionend', onEnd);
  window.setTimeout(settle, SPLASH_DISSOLVE_MS + 80);
}

function restAtmosphere() {
  const atmosphere = document.getElementById('atmosphere');
  if (!atmosphere) return;
  atmosphere.classList.add('arena');
  const splash = document.getElementById('splash');
  if (!splash || splash.dataset.done === '1' || splash.style.display === 'none') {
    applySavedLook();
    signalSplashDone();
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function splashBarFill() {
  return document.querySelector('#splash .splash-bar-fill');
}

function runSplashBar() {
  const bar = splashBarFill();
  if (!bar) return Promise.resolve(null);
  bar.style.transform = 'scaleX(0)';
  if (!bar.animate) return Promise.resolve(null);
  return wait(SPLASH_VEIL_MS).then(() => {
    const current = splashBarFill();
    if (!current?.animate) return null;
    return current.animate(
      [{ transform: 'scaleX(0)' }, { transform: 'scaleX(0.92)' }],
      {
        duration: Math.max(1, SPLASH_MIN_MS - SPLASH_VEIL_MS - SPLASH_BAR_MS),
        easing: 'cubic-bezier(0.15, 0.82, 0.22, 1)',
        fill: 'forwards',
      }
    );
  });
}

async function completeSplashBar(animOrPromise) {
  const anim = animOrPromise && typeof animOrPromise.then === 'function'
    ? await animOrPromise
    : animOrPromise;
  const bar = splashBarFill();
  document.getElementById('splash')?.classList.add('loaded');
  try { anim?.commitStyles(); anim?.cancel(); } catch { /* ignore */ }
  if (!bar) return;
  if (bar.animate) {
    const fin = bar.animate(
      [{ transform: 'scaleX(0.92)' }, { transform: 'scaleX(1)' }],
      { duration: SPLASH_BAR_MS, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'forwards' }
    );
    await fin.finished.catch(() => {});
    try { fin.commitStyles(); fin.cancel(); } catch { /* ignore */ }
  }
  bar.style.transform = 'scaleX(1)';
}

const PAGE_EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';

function stopFades(node) {
  if (!node) return;
  try { node.getAnimations?.().forEach((anim) => anim.cancel()); } catch { /* ignore */ }
  node.style.opacity = '';
}

function fadeEl(node, from, to, ms) {
  if (!node) return Promise.resolve();
  if (!node.animate || ms <= 0) {
    node.style.opacity = String(to);
    return Promise.resolve();
  }
  const anim = node.animate(
    [{ opacity: from }, { opacity: to }],
    { duration: ms, easing: PAGE_EASE, fill: 'forwards' }
  );
  return anim.finished.then(() => {
    try { anim.commitStyles(); anim.cancel(); } catch { /* ignore */ }
  }).catch(() => {});
}

async function raceTimeout(promise, ms, fallback) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((resolve) => { timer = setTimeout(() => resolve(fallback), ms); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function revealFromSplash(showFn) {
  const splash = document.getElementById('splash');
  const app = document.getElementById('app');
  try {
    showFn();
  } catch (err) {
    console.error('[renderer] reveal failed', err);
  }
  app.classList.add('ready');

  let started = false;
  const play = () => {
    if (started) return;
    started = true;
    if (!splash) {
      finishSplash(null);
      return;
    }
    const signin = document.querySelector('.signin-screen');
    const onboarding = document.querySelector('.onboarding-screen');
    if (signin || onboarding) {
      (signin || onboarding).classList.add('gate-in');
    } else {
      app.classList.add('shell');
    }
    restAtmosphere();
    finishSplash(splash);
  };

  window.setTimeout(play, 32);
}

async function prepareApp({ fast = false } = {}) {
  const authState = await window.cci.auth.getState().catch(() => ({ configured: false, session: null }));

  if (authState?.configured && !authState.session) return renderSignIn;

  await loadShellData(undefined, { search: !fast });
  if (authState?.session) {
    window.cci.syncRoster().catch((err) => console.warn('[renderer] roster sync failed', err));
  }

  if (shouldRunOnboarding({
    org: state.org,
    teams: state.teams,
    signedIn: Boolean(authState?.session),
  })) {
    return renderOnboarding;
  }
  if (shouldRunUnlinked({
    org: state.org,
    teams: state.teams,
    signedIn: Boolean(authState?.session),
  })) {
    return renderUnlinked;
  }

  if (!fast) {
    await loadAlerts();
    await loadNotifications();
  } else {
    loadAlerts().catch((err) => console.error('[renderer] alerts failed', err));
    loadNotifications().catch((err) => console.error('[renderer] notifications failed', err));
  }

  const redirect = legacyRedirect(parseHash());
  if (redirect) window.location.replace(redirect);
  else {
    const current = parseHash();
    if (!window.location.hash || !routes[current.page] || !allowedRoute(current.page)) {
      const land = defaultLanding(state.access?.role);
      const teamId = land === 'team-hub' ? rememberedTeamId() : null;
      window.location.hash = teamId ? `#/${land}/${teamId}` : `#/${land}`;
    }
  }
  state.route = parseHash();

  navCollapsed = getPref('navCollapsed', window.innerWidth < 1280);

  return () => {
    booted = true;
    const app = document.getElementById('app');
    const content = document.getElementById('content');
    app.classList.add('shell');
    content?.querySelectorAll('.signin-screen, .onboarding-screen').forEach((node) => node.remove());
    content.className = '';
    content.style.padding = '';
    restAtmosphere();
    applySavedLook();
    document.getElementById('sidebar').style.display = '';
    document.getElementById('topbar').style.display = '';
    document.getElementById('statusbar').style.display = '';
    renderSidebar();
    renderTopbar();
    renderStatusBar();
    renderContent();
    applyResponsiveNav();
  };
}

function paintSplashVersion() {
  const node = document.getElementById('splash-version');
  if (!node || !window.cci?.getAppVersion) return;
  window.cci.getAppVersion().then((version) => {
    if (!version) return;
    node.textContent = `Version ${String(version).replace(/^v/i, '')}`;
  }).catch(() => {});
}

async function boot() {
  if (/Mac/i.test(navigator.platform || '')) document.documentElement.classList.add('is-mac');
  applyAccent(DEFAULT_ACCENT);
  applyBackground(DEFAULT_BACKGROUND);
  // Starts decoding now; the splash has seconds of runway to spend on it.
  const artReady = preloadBackground(getPref('background', DEFAULT_BACKGROUND));
  paintSplashVersion();
  wait(SPLASH_VEIL_MS).then(() => document.getElementById('splash')?.classList.add('risen'));
  const barAnim = runSplashBar();
  const minTime = wait(SPLASH_MIN_MS - SPLASH_BAR_MS);
  let showFn = renderSignIn;
  const prepared = prepareApp();
  try {
    const first = await Promise.race([
      prepared.then((fn) => ({ kind: 'ready', fn })),
      wait(BOOT_TIMEOUT_MS).then(() => ({ kind: 'timeout' })),
    ]);
    if (first.kind === 'ready') {
      showFn = first.fn;
    } else {
      console.warn('[renderer] boot timed out — showing sign-in');
      showFn = renderSignIn;
      prepared.then((fn) => {
        if (typeof fn === 'function' && fn !== renderSignIn) enterApp();
      }).catch((err) => console.error('[renderer] late boot failed', err));
    }
  } catch (err) {
    console.error('[renderer] boot failed', err);
    showFn = renderSignIn;
  }
  await minTime;
  await raceTimeout(artReady, ART_PRELOAD_MS, null).catch(() => {});
  applySavedLook();
  await completeSplashBar(barAnim);
  revealFromSplash(showFn);
  window.addEventListener('resize', applyResponsiveNav);
}

async function enterApp() {
  if (entering) return;
  entering = true;
  try {
    const content = document.getElementById('content');
    content?.querySelectorAll('.signin-screen, .onboarding-screen').forEach((node) => node.remove());
    const showFn = await prepareApp({ fast: true });
    applySavedLook();
    showFn();
    const app = document.getElementById('app');
    const gated = document.querySelector('.signin-screen, .onboarding-screen');
    if (!gated) {
      app.classList.add('shell');
      app.classList.add('ready');
    }
  } finally {
    entering = false;
  }
}

function renderOnboarding() {
  for (const id of ['sidebar', 'topbar', 'statusbar']) document.getElementById(id).style.display = 'none';
  const content = document.getElementById('content');
  content.className = '';
  content.style.padding = '0';
  content.innerHTML = '';
  onboarding.render(content, {
    onComplete: () => enterApp(),
  });
}

function renderUnlinked() {
  for (const id of ['sidebar', 'topbar', 'statusbar']) document.getElementById(id).style.display = 'none';
  const content = document.getElementById('content');
  content.className = '';
  content.style.padding = '0';
  content.innerHTML = '';
  onboarding.renderUnlinked(content);
}

function renderSignIn() {
  for (const id of ['sidebar', 'topbar', 'statusbar']) document.getElementById(id).style.display = 'none';
  const content = document.getElementById('content');
  content.className = 'flush';
  content.style.padding = '0';
  content.innerHTML = '';
  signIn.render(content, { onComplete: () => enterApp() });
}

// ---------- Global navigation ----------

function isActive(item) {
  return item.page === state.route.page || (item.aliases || []).includes(state.route.page);
}

function navTooltip() {
  if (!tooltipEl) {
    tooltipEl = el('div', { class: 'nav-tooltip' });
    document.body.append(tooltipEl);
  }
  return tooltipEl;
}

// Collapsed navigation is icon-only, so hovering or focusing an item has to
// name it. The tooltip lives on <body> so the nav's scroll box cannot clip it.
function attachTooltip(node, label) {
  const show = () => {
    if (!navCollapsed) return;
    const tip = navTooltip();
    tip.textContent = label;
    const rect = node.getBoundingClientRect();
    tip.style.top = `${Math.round(rect.top + rect.height / 2)}px`;
    tip.style.left = `${Math.round(rect.right + 10)}px`;
    tip.classList.add('show');
  };
  const hide = () => tooltipEl && tooltipEl.classList.remove('show');
  node.addEventListener('mouseenter', show);
  node.addEventListener('mouseleave', hide);
  node.addEventListener('focus', show);
  node.addEventListener('blur', hide);
}

function navLink(item) {
  const active = isActive(item);
  const node = el(
    'button',
    {
      type: 'button',
      class: `sb-link${active ? ' active' : ''}`,
      'aria-label': item.label,
      'aria-current': active ? 'page' : null,
      'data-page': item.page,
      onclick: () => {
        const needsTeam = TEAM_NAV_PAGES.has(item.page);
        navigate(item.page, needsTeam ? rememberedTeamId() || undefined : undefined);
      },
    },
    [
      el('span', { class: 'icon', html: icon(item.icon) }),
      el('span', { class: 'sb-link-label' }, item.label),
      item.soon ? el('span', { class: 'badge-soon' }, 'Soon') : null,
    ]
  );
  attachTooltip(node, item.label);
  return node;
}

function openFeedback(prefill) {
  const teamId = rememberedTeamId();
  const payload = {
    org: state.org,
    access: state.access,
    page: state.route.page,
    teamId,
    teamName: state.teams.find((t) => t.id === teamId)?.name || '',
    prefill,
  };
  // Settings itself crashing has nowhere else to go — keep the modal as a last door.
  if (state.route.page === 'settings') {
    openFeedbackModal(payload);
    return;
  }
  stashFeedback({
    ...prefill,
    page: payload.page,
    teamId,
    teamName: payload.teamName,
  });
  navigate('settings', 'feedback');
}

function renderSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.innerHTML = '';
  sidebar.classList.toggle('collapsed', navCollapsed);

  sidebar.append(
    el('div', { class: 'sb-brand' }, [
      el('div', { class: 'sb-wordmark', 'aria-label': 'Coach Intel' }, [
        el('img', { class: 'sb-wordmark-coach', src: asset('wordmark-coach.png'), alt: '' }),
        el('span', { class: 'sb-wordmark-intel' }),
      ]),
    ])
  );

  const nav = el('div', { class: 'sb-nav' });
  const role = state.access?.role;
  const foldedPref = getPref('navGroupsFolded', {}) || {};
  for (const group of NAV_GROUPS) {
    const items = group.items.filter((item) => canAccessPage(role, item.page));
    if (!items.length) continue;
    const key = group.label.toLowerCase();
    const hasActive = items.some((item) => isActive(item));
    const folded = Boolean(foldedPref[key]) && !navCollapsed && !hasActive;
    const heading = el(
      'button',
      {
        type: 'button',
        class: 'sb-section-label',
        'aria-expanded': String(!folded),
        'aria-label': `${folded ? 'Show' : 'Hide'} ${group.label}`,
        onclick: () => toggleNavGroup(group.label),
      },
      [
        el('span', {}, group.label),
        el('span', { class: 'chev', html: icon(folded ? 'chevronRight' : 'chevronDown', 15) }),
      ]
    );
    nav.append(
      el('div', { class: `sb-group${folded ? ' folded' : ''}` }, [
        heading,
        el('div', { class: 'sb-group-items' }, items.map((item) => navLink(item))),
      ])
    );
  }
  sidebar.append(nav);

  // Settings is pinned to the bottom by flex, never by fixed positioning, so it
  // survives any number of items above it and short viewports.
  collapseBtn = el(
    'button',
    {
      type: 'button',
      class: 'sb-collapse',
      'aria-expanded': String(!navCollapsed),
      'aria-controls': 'sidebar',
      'aria-label': navCollapsed ? 'Expand navigation' : 'Collapse navigation',
      onclick: () => setNavCollapsed(!navCollapsed),
    },
    [
      el('span', { class: 'chev', html: icon(navCollapsed ? 'chevronRight' : 'chevronLeft', 14) }),
      el('span', { class: 'sb-collapse-label' }, navCollapsed ? 'Expand' : 'Collapse'),
    ]
  );
  attachTooltip(collapseBtn, 'Expand navigation');

  sidebar.append(el('div', { class: 'sb-bottom' }, [navLink(NAV_BOTTOM), collapseBtn]));
  window.cci?.setTrafficLights?.(navCollapsed);
}

function syncNavActive() {
  const sidebar = document.getElementById('sidebar');
  for (const node of sidebar.querySelectorAll('.sb-link')) {
    const item =
      [...NAV_GROUPS.flatMap((g) => g.items), NAV_BOTTOM].find((i) => i.page === node.dataset.page) || {};
    const active = isActive(item);
    node.classList.toggle('active', active);
    if (active) node.setAttribute('aria-current', 'page');
    else node.removeAttribute('aria-current');
  }
}

// Toggling only changes chrome: no route change, no reload, and the page keeps
// its own state because content is never re-rendered here.
function toggleNavGroup(label) {
  const key = String(label || '').toLowerCase();
  const folded = { ...(getPref('navGroupsFolded', {}) || {}) };
  folded[key] = !folded[key];
  setPref('navGroupsFolded', folded);
  renderSidebar();
  syncNavActive();
}

function setNavCollapsed(collapsed, { persist = true } = {}) {
  navCollapsed = collapsed;
  document.getElementById('sidebar').classList.toggle('collapsed', collapsed);
  if (tooltipEl) tooltipEl.classList.remove('show');
  if (collapseBtn) {
    collapseBtn.setAttribute('aria-expanded', String(!collapsed));
    collapseBtn.setAttribute('aria-label', collapsed ? 'Expand navigation' : 'Collapse navigation');
    collapseBtn.querySelector('.chev').innerHTML = icon(collapsed ? 'chevronRight' : 'chevronLeft', 14);
    const label = collapseBtn.querySelector('.sb-collapse-label');
    if (label) label.textContent = collapsed ? 'Expand' : 'Collapse';
  }
  if (persist) setPref('navCollapsed', collapsed);
  window.cci?.setTrafficLights?.(collapsed);
}

function applyStudioChrome(on) {
  if (on) {
    if (!studioForced) {
      studioForced = true;
      setNavCollapsed(true, { persist: false });
    }
    return;
  }
  if (!studioForced) return;
  studioForced = false;
  if (!navForced) setNavCollapsed(getPref('navCollapsed', false), { persist: false });
}

function applyResponsiveNav() {
  const tooNarrow = window.innerWidth < NAV_AUTO_COLLAPSE_PX;
  if (tooNarrow && !navForced) {
    navForced = true;
    setNavCollapsed(true, { persist: false });
  } else if (!tooNarrow && navForced) {
    navForced = false;
    setNavCollapsed(getPref('navCollapsed', false), { persist: false });
  }
}

// ---------- Header ----------

function connectionStatus() {
  if (state.syncing && state.online) return { cls: 'syncing', label: 'Online · Syncing' };
  if (state.online) return { cls: 'online', label: 'Online · Synced' };
  return { cls: 'offline', label: 'Offline · On-device' };
}

function statusPill() {
  const { cls, label } = connectionStatus();
  return el('div', { class: `status-pill ${cls}` }, [
    el('span', { class: 'status-dot' }),
    label,
  ]);
}

function paintStatusPill() {
  const host = document.querySelector('#topbar .status-pill');
  if (!host) return;
  host.replaceWith(statusPill());
}

function fmtTimeAgo(iso) {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const min = Math.floor((Date.now() - then) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(then).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function notificationBell() {
  const panel = el('div', { class: 'topbar-notif-panel' });
  panel.style.display = 'none';

  function paintPanel() {
    panel.innerHTML = '';
    if (!state.notifications.length) {
      panel.append(el('div', { class: 'topbar-notif-empty' }, 'Nothing yet — you’ll see it here when a VOD review, meeting or match needs attention.'));
      return;
    }
    for (const n of state.notifications.slice(0, 30)) {
      const isUnread = !seenNotificationIds().has(n.id);
      panel.append(
        el('div', { class: `topbar-notif-row${isUnread ? ' unread' : ''}` }, [
          el(
            'div',
            {
              class: 'topbar-notif-main',
              role: 'button',
              tabindex: '0',
              onclick: () => {
                markNotificationSeen(n.id);
                panel.style.display = 'none';
                if (n.route) {
                  const [page, ...rest] = String(n.route).split('/');
                  if (routes[page]) navigate(page, rest.join('/') || undefined);
                }
                paintBell();
              },
            },
            [
              el('div', { class: 'topbar-notif-title' }, n.title),
              [n.teamName, n.subtitle].filter(Boolean).length
                ? el('div', { class: 'topbar-notif-sub' }, [n.teamName, n.subtitle].filter(Boolean).join(' · '))
                : null,
              el('div', { class: 'topbar-notif-time' }, fmtTimeAgo(n.created_at)),
            ]
          ),
          el('button', {
            type: 'button',
            class: 'topbar-notif-dismiss',
            'aria-label': `Dismiss ${n.title}`,
            title: 'Dismiss',
            html: icon('trash', 12),
            onclick: async (e) => {
              e.stopPropagation();
              try {
                await window.cci.deleteNotification(n.team_id, n.id);
              } catch (err) {
                console.error('[renderer] dismiss notification failed', err);
              }
              state.notifications = state.notifications.filter((x) => x.id !== n.id);
              paintPanel();
              paintBell();
            },
          }),
        ])
      );
    }
  }
  paintPanel();

  const unread = state.notifications.filter((n) => !seenNotificationIds().has(n.id)).length;
  const label = unread ? `Notifications, ${unread} new` : 'Notifications, nothing new';

  const btn = el('button', {
    type: 'button',
    class: 'topbar-icon-btn',
    'aria-label': label,
    title: label,
    html: icon('bell', 16),
    onclick: (e) => {
      e.stopPropagation();
      const isOpen = panel.style.display !== 'none';
      document.querySelectorAll('.topbar-notif-panel').forEach((p) => (p.style.display = 'none'));
      if (isOpen) return;
      panel.style.display = 'block';
      loadNotifications()
        .then(() => paintBell(true))
        .catch((err) => console.error('[renderer] notifications refresh failed', err));
    },
  });

  const wrap = el('div', { class: 'topbar-notif-wrap' }, [
    btn,
    unread ? el('span', { class: 'topbar-notif-badge' }, unread > 9 ? '9+' : String(unread)) : null,
    panel,
  ]);
  return wrap;
}

function paintBell(keepOpen = false) {
  const host = document.querySelector('.topbar-notif-wrap');
  if (!host) return;
  const wasOpen = keepOpen || host.querySelector('.topbar-notif-panel')?.style.display === 'block';
  const fresh = notificationBell();
  if (wasOpen) fresh.querySelector('.topbar-notif-panel').style.display = 'block';
  host.replaceWith(fresh);
}

function renderTopbar() {
  const topbar = document.getElementById('topbar');
  topbar.innerHTML = '';

  const searchInput = el('input', {
    type: 'text',
    placeholder: 'Search players, teams, maps, matches, intel…',
    'aria-label': 'Global search',
  });
  const resultsBox = el('div', { class: 'topbar-search-results' });
  resultsBox.style.display = 'none';

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    resultsBox.innerHTML = '';
    if (!q) {
      resultsBox.style.display = 'none';
      return;
    }
    const matches = state.searchIndex.filter((r) => r.label.toLowerCase().includes(q)).slice(0, 8);
    if (!matches.length) {
      resultsBox.append(el('div', { class: 'topbar-search-row' }, 'No matches'));
    } else {
      for (const m of matches) {
        resultsBox.append(
          el(
            'div',
            {
              class: 'topbar-search-row',
              onclick: () => {
                m.action();
                searchInput.value = '';
                resultsBox.style.display = 'none';
              },
            },
            [m.label, el('span', { class: 'type' }, m.type)]
          )
        );
      }
    }
    resultsBox.style.display = 'block';
  });
  searchInput.addEventListener('blur', () => setTimeout(() => (resultsBox.style.display = 'none'), 150));
  // The index is a snapshot, and notes/strats/members change while the app is
  // open. Refreshing on focus keeps results honest without re-reading every
  // team's files on each navigation.
  searchInput.addEventListener('focus', () => {
    buildSearchIndex().catch((err) => console.error('[renderer] search index refresh failed', err));
  });

  topbar.append(
    el('div', { class: 'topbar-search' }, [el('span', { class: 'topbar-search-icon' }, '⌕'), searchInput, resultsBox])
  );
  topbar.append(el('div', { class: 'topbar-spacer' }));
  topbar.append(orgRefreshBtn());
  topbar.append(statusPill());

  topbar.append(notificationBell());
  topbar.append(el('div', { class: 'topbar-divider' }));

  const chip = chipIdentity(state.org, state.access);
  const titleLine = chip.title || (!state.access?.local && accessRoleLabel(state.access?.role)) || '';
  const roleBits = [titleLine, !state.access?.canEdit ? 'View only' : ''].filter(Boolean);
  topbar.append(
    el('div', {
      class: 'topbar-profile',
      role: 'button',
      tabindex: '0',
      title: 'Edit your profile',
      onclick: () => navigate('settings', 'profile'),
      onkeydown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate('settings', 'profile');
        }
      },
    }, [
      el('div', {}, [
        el('div', { class: 'topbar-profile-name' }, [
          chip.name,
          chip.verified ? verifiedMark() : null,
        ]),
        el('div', { class: 'topbar-profile-role' }, roleBits.join(' · ') || 'Signed in'),
      ]),
      faceMark({ photo: chip.photo, avatarUrl: chip.avatarUrl, name: chip.name, size: 28 }),
    ])
  );
}

// ---------- Status bar ----------

function renderStatusBar() {
  const bar = document.getElementById('statusbar');
  bar.innerHTML = '';
  const rs = state.ruleset;
  const showRuleset = rs && rs.show_in_status !== false;
  const rulesetParts = [];
  if (rs?.game) rulesetParts.push(rs.game);
  if (rs?.season) rulesetParts.push(`Season ${rs.season}`);
  if (rs?.version) rulesetParts.push(`v${rs.version}`);

  if (showRuleset && (rs.label || rulesetParts.length)) {
    bar.append(
      el('div', { class: 'sbar-group' }, [
        el('span', { class: 'sbar-label' }, rs.label || 'Ruleset'),
        rulesetParts.length ? el('span', { class: 'sbar-sep' }, '│') : null,
        rulesetParts.length ? el('span', {}, rulesetParts.join(' · ')) : null,
      ])
    );
  }

  bar.append(
    el('div', { class: 'sbar-group center' }, [
      el('span', { class: 'sbar-dot' }),
      el('span', {}, 'All systems operational'),
      el('span', { class: 'sbar-sep' }, '│'),
      el('span', {}, showRuleset && rs?.last_checked ? `Ruleset checked ${rs.last_checked}` : 'On-device data'),
    ])
  );

  const sources = [];
  if (showRuleset) sources.push(rs.label || 'Ruleset');
  sources.push('On-device Match Log');
  bar.append(
    el('div', { class: 'sbar-group sources' }, [
      el('span', { class: 'sbar-label' }, state.appVersion ? `v${state.appVersion}` : 'Data sources'),
      ...sources.map((s) => el('span', { class: 'sbar-src' }, s)),
    ])
  );
}

// ---------- Content ----------

// Pages render in stages (skeleton, then data), so a second navigation can land
// while the first is still awaiting. Each render gets its own mount point and a
// sequence number: a superseded render keeps writing into a detached node and
// cannot repaint or blank the page the user is now on.
let renderSeq = 0;
let swapGen = 0;
let lastPage = null;

function pageCtx() {
  return {
    navigate,
    param: state.route.param,
    org: state.org,
    access: state.access,
    canEdit: Boolean(state.access?.canEdit),
    canEditTeam: (teamId) => canEditTeam(state.access?.role, teamId, state.access),
    canTransfer: canTransferMembers(state.access?.role, state.access),
    refreshShell: async () => {
      await loadShellData();
      renderSidebar();
      renderTopbar();
      renderStatusBar();
    },
  };
}

function mountPage(content, incoming, { flush, studio }) {
  stopFades(content);
  [...content.children].forEach((child) => {
    if (child !== incoming && !child.classList.contains('page-root')) child.remove();
  });
  const sidebar = document.getElementById('sidebar');
  sidebar?.classList.add('swap-lock');
  applyStudioChrome(studio);
  content.className = flush ? 'flush' : '';
  content.style.padding = '';
  content.scrollTop = 0;
  incoming.style.opacity = '';
  incoming.classList.add('page-shown');
  if (!incoming.isConnected) content.append(incoming);
  void sidebar?.offsetWidth;
  sidebar?.classList.remove('swap-lock');
  content.classList.remove('is-swapping');
}

function swapPages(content, outgoing, incoming, { flush, studio, animate }) {
  if (!incoming.childNodes.length) {
    stopFades(content);
    return;
  }

  const gen = ++swapGen;
  stopFades(content);

  if (!outgoing || !animate) {
    if (outgoing) outgoing.remove();
    mountPage(content, incoming, { flush, studio });
    return;
  }

  content.classList.add('is-swapping');
  const run = async () => {
    try {
      await fadeEl(content, 1, 0, 150);
      if (gen !== swapGen) return;
      outgoing.remove();
      stopFades(content);
      content.style.opacity = '0';
      mountPage(content, incoming, { flush, studio });
      await fadeEl(content, 0, 1, 180);
    } finally {
      if (gen === swapGen) stopFades(content);
    }
  };

  run().catch((err) => {
    console.error('[renderer] page swap failed', err);
    if (gen !== swapGen) return;
    if (outgoing?.isConnected) outgoing.remove();
    mountPage(content, incoming, { flush, studio });
  });
}

async function renderContent() {
  const content = document.getElementById('content');
  const page = routes[state.route.page] || routes.dashboard;
  const token = ++renderSeq;
  const ctx = pageCtx();

  const liveRoot = content.querySelector('.page-root');
  if (typeof page.update === 'function' && lastPage === page && liveRoot?.childNodes.length) {
    try {
      await page.update(liveRoot, ctx);
      if (token === renderSeq) lastPage = page;
      return;
    } catch (err) {
      console.error('[renderer] page update failed', err);
      liveRoot.remove();
    }
  }

  const incoming = el('div', { class: 'page-root' });

  try {
    await page.render(incoming, ctx);
  } catch (err) {
    console.error('[renderer] page render failed', err);
    if (token !== renderSeq) return;
    lastPage = null;
    content.className = '';
    const message = String(err && err.message ? err.message : err);
    content.replaceChildren(
      el('div', { class: 'card inline-error' }, [
        el('div', { class: 'inline-error-title' }, 'This page failed to load'),
        el('div', {}, message),
        el('div', { style: 'margin-top:10px;' }, [
          el('button', {
            class: 'btn subtle sm',
            onclick: () =>
              openFeedback({
                category: 'bug',
                subject: `Page failed to load: ${state.route.page}`,
                description: `Error: ${message}\n\nPage: ${state.route.page}${state.route.param ? '/' + state.route.param : ''}`,
              }),
          }, 'Report this issue'),
        ]),
      ])
    );
    return;
  }

  if (token !== renderSeq) return;
  if (!incoming.childNodes.length) return;

  lastPage = page;
  const outgoing = content.querySelector('.page-root');
  swapPages(content, outgoing, incoming, {
    flush: !!page.flush,
    studio: !!page.studio,
    animate: Boolean(outgoing && booted && !prefersReducedMotion()),
  });
}

boot();
