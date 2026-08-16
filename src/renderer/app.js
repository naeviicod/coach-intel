import { el, initials, icon } from './utils.js';
import { asset } from './lib/assets.js';
import { applyAccent } from './lib/accent.js';
import { getPref, setPref } from './prefs.js';
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
import * as reports from './pages/reports.js';
import * as rankings from './pages/rankings.js';
import * as teachCCIntel from './pages/teachCCIntel.js';
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

  'maps-modes': mapsModes,
  'veto-lab': vetoLab,
  scouting,
  reports,
  rankings,

  integrations: integrationsPage,
  settings: settingsPage,

  member: memberProfile,
  teach: teachCCIntel,
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
      { page: 'players', label: 'Players', icon: 'players', aliases: ['member'] },
      { page: 'matches', label: 'Matches', icon: 'matches' },
      { page: 'statistics', label: 'Statistics', icon: 'performance' },
      { page: 'database', label: 'Database', icon: 'database' },
      { page: 'reports', label: 'Reports', icon: 'reports' },
      { page: 'rankings', label: 'Rankings', icon: 'rankings' },
    ],
  },
  {
    label: 'Team',
    items: [
      { page: 'team-hub', label: 'Team Hub', icon: 'teamHub' },
      { page: 'scrim-hub', label: 'Scrim Hub', icon: 'scrim' },
      { page: 'vod-library', label: 'VOD Library', icon: 'vod' },
      { page: 'needs-review', label: 'Needs Review', icon: 'review' },
      { page: 'veto-lab', label: 'Veto Lab', icon: 'veto' },
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
  teach: () => '#/teach',
};

const SPLASH_MIN_MS = 5000;
const NAV_AUTO_COLLAPSE_PX = 1024;
const bootStart = performance.now();

let state = { org: null, teams: [], searchIndex: [], ruleset: null, alerts: 0, route: parseHash() };
let navCollapsed = false;
let navForced = false;
let collapseBtn = null;
let tooltipEl = null;

function parseHash() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const [page, ...rest] = hash.split('/');
  return { page: page || 'dashboard', param: rest.join('/') || null };
}

function legacyRedirect({ page, param }) {
  if (page !== 'command-center') return null;
  const [teamId, tab] = (param || '').split('/');
  if (!teamId) return '#/team-hub';
  const toGlobal = LEGACY_TAB_ROUTES[tab];
  if (toGlobal) return toGlobal(teamId);
  const section = tab && teamHub.SECTIONS.includes(tab) ? `/${tab}` : '';
  return `#/team-hub/${teamId}${section}`;
}

function navigate(page, param) {
  window.location.hash = param ? `#/${page}/${param}` : `#/${page}`;
}
window.cciNavigate = navigate;

// A coachintel:// link — the one Discord notifications carry — arrives from the
// main process as a bare route. Unknown pages are ignored so a stale or hand-edited
// link cannot navigate the app somewhere that does not exist.
window.cci.onDeepLink?.((route) => {
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

window.addEventListener('hashchange', () => {
  const next = parseHash();
  const redirect = legacyRedirect(next);
  if (redirect) {
    window.location.replace(redirect);
    return;
  }
  state.route = next;
  renderContent();
  syncNavActive();
});

// ---------- Boot ----------

async function loadShellData() {
  state.org = await window.cci.getOrg();
  state.teams = await window.cci.getTeams();
  state.ruleset = await window.cci.getCdlRuleset();
  applyAccent(state.org?.accent);
  state.appVersion = await window.cci.getAppVersion();
  await buildSearchIndex();
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
    // Strats stay canonically inside the Team Hub; search only points at them.
    for (const s of strats) {
      index.push({
        type: 'Strat',
        label: `${s.strategy_name} — ${s.map} ${s.mode}`,
        action: () => navigate('team-hub', `${team.id}/strats/edit/${s.strategy_id}`),
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

function revealAfterSplash(showFn) {
  const elapsed = performance.now() - bootStart;
  setTimeout(() => {
    document.getElementById('splash').classList.add('hide');
    showFn();
    document.getElementById('app').classList.add('ready');
  }, Math.max(0, SPLASH_MIN_MS - elapsed));
}

async function boot() {
  const authState = await window.cci.auth?.getState().catch(() => ({ configured: false, session: null }));
  if (authState?.configured && !authState.session) {
    revealAfterSplash(renderSignIn);
    return;
  }

  await loadShellData();

  if (!state.teams.length) {
    revealAfterSplash(renderOnboarding);
    return;
  }

  await loadAlerts();

  const redirect = legacyRedirect(parseHash());
  if (redirect) window.location.replace(redirect);
  else if (!window.location.hash || !routes[parseHash().page]) window.location.hash = '#/dashboard';
  state.route = parseHash();

  // Narrow screens start collapsed unless the user has already chosen.
  navCollapsed = getPref('navCollapsed', window.innerWidth < 1280);

  revealAfterSplash(() => {
    document.getElementById('sidebar').style.display = '';
    document.getElementById('topbar').style.display = '';
    document.getElementById('statusbar').style.display = '';
    renderSidebar();
    renderTopbar();
    renderStatusBar();
    renderContent();
    applyResponsiveNav();
  });

  window.addEventListener('resize', applyResponsiveNav);
}

function renderOnboarding() {
  for (const id of ['sidebar', 'topbar', 'statusbar']) document.getElementById(id).style.display = 'none';
  const content = document.getElementById('content');
  content.className = '';
  content.style.padding = '0';
  content.innerHTML = '';
  onboarding.render(content, { onComplete: () => window.location.reload() });
}

function renderSignIn() {
  for (const id of ['sidebar', 'topbar', 'statusbar']) document.getElementById(id).style.display = 'none';
  const content = document.getElementById('content');
  content.className = '';
  content.style.padding = '0';
  content.innerHTML = '';
  signIn.render(content, { onComplete: () => window.location.reload() });
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
      onclick: () => navigate(item.page),
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

function orgMark(org) {
  const mark = el('div', { class: 'sb-org-logo' }, initials(org.name || 'CI'));
  if (!org.logo || !window.cci?.dataUrlForPath) return mark;
  window.cci.dataUrlForPath(org.logo).then((url) => {
    if (!url || !mark.isConnected) return;
    const img = el('img', { src: url, alt: org.name || '' });
    img.onerror = () => img.remove();
    mark.prepend(img);
  });
  return mark;
}

function renderSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.innerHTML = '';
  sidebar.classList.toggle('collapsed', navCollapsed);

  sidebar.append(
    el('div', { class: 'sb-brand' }, [
      el('img', {
        class: 'sb-wordmark brand-tint',
        src: asset('wordmark.png'),
        alt: '',
        onerror: (e) => {
          e.target.hidden = true;
          e.target.nextElementSibling?.classList.add('show');
        },
      }),
      el('div', { class: 'sb-wordmark-text', 'aria-label': 'Coach Intel' }, [
        el('span', {}, 'COACH'),
        el('span', { class: 'sb-wordmark-intel' }, 'INTEL'),
      ]),
      el('img', { class: 'sb-brand-icon brand-tint', src: asset('ci-mark.png'), alt: '' }),
    ])
  );

  const org = state.org || {};
  sidebar.append(
    el('div', { class: 'sb-org' }, [
      orgMark(org),
      el('div', { class: 'sb-org-text' }, [
        el('div', { class: 'sb-org-name' }, org.name || 'My Organization'),
        el('div', { class: 'sb-org-sub' }, 'Call of Duty'),
      ]),
    ])
  );

  const nav = el('div', { class: 'sb-nav' });
  for (const group of NAV_GROUPS) {
    nav.append(el('div', { class: 'sb-section-label' }, group.label));
    for (const item of group.items) nav.append(navLink(item));
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
      el('span', {}, 'Collapse'),
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
function setNavCollapsed(collapsed, { persist = true } = {}) {
  navCollapsed = collapsed;
  document.getElementById('sidebar').classList.toggle('collapsed', collapsed);
  if (tooltipEl) tooltipEl.classList.remove('show');
  if (collapseBtn) {
    collapseBtn.setAttribute('aria-expanded', String(!collapsed));
    collapseBtn.setAttribute('aria-label', collapsed ? 'Expand navigation' : 'Collapse navigation');
    collapseBtn.querySelector('.chev').innerHTML = icon(collapsed ? 'chevronRight' : 'chevronLeft', 14);
  }
  if (persist) setPref('navCollapsed', collapsed);
  window.cci?.setTrafficLights?.(collapsed);
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
  topbar.append(el('div', { class: 'status-pill' }, 'Offline · On-device'));

  const alertLabel = state.alerts ? `Notifications, ${state.alerts} items need review` : 'Notifications, nothing pending';
  topbar.append(
    el(
      'button',
      {
        type: 'button',
        class: 'topbar-icon-btn',
        'aria-label': alertLabel,
        title: alertLabel,
        html: icon('bell', 16),
        onclick: () => navigate('needs-review'),
      },
      []
    )
  );
  topbar.append(
    el('button', {
      type: 'button',
      class: 'topbar-icon-btn',
      'aria-label': 'Help',
      title: 'Help',
      html: icon('help', 16),
      onclick: () => navigate('teach'),
    })
  );
  topbar.append(el('div', { class: 'topbar-divider' }));

  const coachName = state.org?.coachName || 'Coach';
  topbar.append(
    el('div', { class: 'topbar-profile', role: 'button', tabindex: '0', onclick: () => navigate('settings') }, [
      el('div', {}, [
        el('div', { class: 'topbar-profile-name' }, coachName),
        el('div', { class: 'topbar-profile-role' }, 'Head Coach · Local'),
      ]),
      el('div', { class: 'avatar', style: 'width:28px;height:28px;' }, initials(coachName)),
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

async function renderContent() {
  const content = document.getElementById('content');
  const page = routes[state.route.page] || routes.dashboard;
  const token = ++renderSeq;
  content.className = page.flush ? 'flush' : '';
  content.style.padding = '';
  content.innerHTML = '';
  content.scrollTop = 0;
  const root = el('div', { class: 'page-root' });
  content.append(root);

  const ctx = {
    navigate,
    param: state.route.param,
    org: state.org,
    refreshShell: async () => {
      await loadShellData();
      renderSidebar();
      renderStatusBar();
    },
  };

  try {
    await page.render(root, ctx);
  } catch (err) {
    console.error('[renderer] page render failed', err);
    if (token !== renderSeq) return;
    content.className = '';
    content.innerHTML = '';
    content.append(
      el('div', { class: 'card inline-error' }, [
        el('div', { class: 'inline-error-title' }, 'This page failed to load'),
        el('div', {}, String(err && err.message ? err.message : err)),
      ])
    );
  }
}

boot();
