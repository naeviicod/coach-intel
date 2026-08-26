import { el, icon, teamMark } from '../../utils.js';
import { resolveActiveTeam } from '../../prefs.js';
import { inlineError, skeleton } from './parts.js';
import * as overview from './sections/overview.js';
import * as roster from './sections/roster.js';
import * as notes from './sections/notes.js';
import * as objectives from './sections/objectives.js';
import * as veto from './sections/veto.js';
import * as practice from './sections/practice.js';
import * as statistics from './sections/statistics.js';
import * as hubReports from './sections/reports.js';
import * as teamSettings from './sections/teamSettings.js';
import { renderContextPanel } from './context.js';

// The Team Hub owns the whole content area: a compact top bar, then workspace
// and context panel scroll independently, so the page opts out of standard padding.
export const flush = true;

const SECTION_DEFS = [
  { key: 'overview', label: 'Overview', icon: 'dashboard', module: overview },
  { key: 'roster', label: 'Roster', icon: 'roster', module: roster, count: 'members' },
  { key: 'notes', label: 'Team Notes', icon: 'notes', module: notes, count: 'notes' },
  { key: 'objectives', label: 'Objectives', icon: 'objectives', module: objectives },
  { key: 'veto', label: 'Veto History', icon: 'veto', module: veto },
  { key: 'statistics', label: 'Statistics', icon: 'performance', module: statistics },
  { key: 'reports', label: 'Reports', icon: 'reports', module: hubReports },
  { key: 'practice', label: 'Planner', icon: 'calendar', module: practice },
  { key: 'settings', label: 'Team Settings', icon: 'settings', module: teamSettings },
];

export const SECTIONS = SECTION_DEFS.map((s) => s.key);

let live = null;

export async function render(container, ctx) {
  const teams = await window.cci.getTeams();
  if (!teams.length) {
    container.append(
      el('div', { style: 'padding:26px;' }, [
        el('div', { class: 'card empty-state' }, [
          el('div', { class: 'title' }, 'No teams yet'),
          el('div', {}, 'Create a team to open the Team Hub.'),
          el('button', { class: 'btn primary', style: 'margin-top:14px;', onclick: () => ctx.navigate('teams') }, 'Go to Teams'),
        ]),
      ])
    );
    return;
  }

  const parts = (ctx.param || '').split('/').filter(Boolean);
  const requestedTeam = parts[0];
  const team = resolveActiveTeam(teams, SECTIONS.includes(requestedTeam) ? null : requestedTeam);

  // A hub URL without a valid team is normalised so back/forward and reloads
  // land on the same place the user is looking at.
  if (!team) {
    container.append(
      el('div', { style: 'padding:26px;' }, [
        el('div', { class: 'card empty-state' }, [
          el('div', { class: 'title' }, 'No teams yet'),
          el('div', {}, 'Create a team to open the Team Hub.'),
        ]),
      ])
    );
    return;
  }
  if (team.id !== requestedTeam) {
    const tail = requestedTeam && SECTIONS.includes(requestedTeam) ? `/${parts.join('/')}` : '';
    ctx.navigate('team-hub', `${team.id}${tail}`);
    return;
  }

  const sectionKey = SECTIONS.includes(parts[1]) ? parts[1] : 'overview';
  const def = SECTION_DEFS.find((s) => s.key === sectionKey);
  const sub = parts.slice(2);

  const rail = el('header', { class: 'hub-rail' });
  const workspace = el('div', { class: 'hub-workspace' });
  const context = el('aside', { class: 'hub-context', 'aria-label': 'Context panel' });
  const body = el('div', { class: 'hub-body' }, [workspace, context]);
  const hub = el('div', { class: 'hub' }, [rail, body]);
  container.append(hub);

  const hubCtx = {
    ...ctx,
    team,
    teams,
    section: sectionKey,
    sub,
    go: (section, ...rest) =>
      ctx.navigate('team-hub', [team.id, section, ...rest.filter(Boolean)].join('/')),
    goTeam: (teamId) => ctx.navigate('team-hub', `${teamId}/${hubCtx.section}`),
    openPlaybooks: (...rest) =>
      ctx.navigate('playbooks', [team.id, ...rest.filter(Boolean)].join('/')),
    canEdit: Boolean(ctx.canEditTeam ? ctx.canEditTeam(team.id) : ctx.canEdit),
    ctxToggle: contextToggle(context),
    refreshRail: null,
  };

  workspace.append(skeleton('kpi'));
  renderRail(rail, hubCtx, { members: null, notes: null });

  let counts = { members: 0, notes: 0 };
  try {
    const [members, noteList] = await Promise.all([
      window.cci.getMembers(team.id),
      window.cci.getNotes(team.id),
    ]);
    counts = { members: members.length, notes: noteList.length };
  } catch (err) {
    console.error('[team-hub] rail counts failed', err);
  }
  renderRail(rail, hubCtx, counts);
  // Callers fire this without awaiting, so a failed count refresh must not
  // surface as an unhandled rejection; stale counts are the acceptable outcome.
  hubCtx.refreshRail = async () => {
    try {
      const [members, noteList] = await Promise.all([
        window.cci.getMembers(team.id),
        window.cci.getNotes(team.id),
      ]);
      renderRail(rail, hubCtx, { members: members.length, notes: noteList.length });
      if (live?.hubCtx === hubCtx) live.counts = { members: members.length, notes: noteList.length };
    } catch (err) {
      console.error('[team-hub] rail refresh failed', err);
    }
  };

  live = { container, teamId: team.id, rail, workspace, context, hubCtx, counts };
  container.classList.toggle('team-readonly', !hubCtx.canEdit);
  await paintSection(workspace, def, hubCtx, () => render(container, ctx), { animate: false });
  await renderContextPanel(context, hubCtx);
}

// Same Team Hub shell, different section: keep the bar and context frame so
// Overview → Roster does not flash the whole page.
export async function update(container, ctx) {
  if (!live?.workspace?.isConnected || live.container !== container) {
    container.innerHTML = '';
    return render(container, ctx);
  }

  const teams = await window.cci.getTeams().catch(() => live.hubCtx.teams);
  live.hubCtx.teams = teams;
  const parts = (ctx.param || '').split('/').filter(Boolean);
  const requestedTeam = parts[0];
  const team =
    teams.find((t) => t.id === requestedTeam) ||
    teams.find((t) => t.id === live.teamId) ||
    teams[0];
  if (team) live.hubCtx.team = team;

  if (!team || team.id !== live.teamId) {
    container.innerHTML = '';
    return render(container, ctx);
  }
  if (team.id !== requestedTeam) {
    const tail = requestedTeam && SECTIONS.includes(requestedTeam) ? `/${parts.join('/')}` : '';
    ctx.navigate('team-hub', `${team.id}${tail}`);
    return;
  }

  const sectionKey = SECTIONS.includes(parts[1]) ? parts[1] : 'overview';
  const def = SECTION_DEFS.find((s) => s.key === sectionKey);
  const sub = parts.slice(2);
  const same =
    sectionKey === live.hubCtx.section &&
    sub.join('/') === (live.hubCtx.sub || []).join('/');
  live.hubCtx.section = sectionKey;
  live.hubCtx.sub = sub;
  live.hubCtx.param = ctx.param;
  renderRail(live.rail, live.hubCtx, live.counts);
  await paintSection(live.workspace, def, live.hubCtx, () => render(container, ctx), { animate: !same });
  await renderContextPanel(live.context, live.hubCtx);
}

async function paintSection(workspace, def, hubCtx, retry, { animate = true } = {}) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const holder = el('div');
  try {
    await def.module.render(holder, hubCtx);
  } catch (err) {
    console.error(`[team-hub] section "${hubCtx.section}" failed`, err);
    workspace.innerHTML = '';
    workspace.append(inlineError(String(err?.message || err), retry));
    return;
  }
  workspace.replaceChildren(...holder.childNodes);
  workspace.style.opacity = '';
  if (!animate || reduceMotion || !workspace.animate) return;
  const anim = workspace.animate(
    [{ opacity: 0 }, { opacity: 1 }],
    { duration: 180, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'forwards' }
  );
  anim.finished.then(() => {
    try { anim.commitStyles(); anim.cancel(); } catch { /* ignore */ }
    workspace.style.opacity = '';
  }).catch(() => { workspace.style.opacity = ''; });
}

// ---------- Rail ----------

function renderRail(rail, hub, counts) {
  rail.innerHTML = '';
  rail.append(teamIdentity(hub));

  const nav = el('nav', { class: 'hub-rail-nav', 'aria-label': `${hub.team.name} sections` });
  for (const def of SECTION_DEFS) {
    const count = def.count ? counts[def.count] : null;
    const active = def.key === hub.section;
    nav.append(
      el(
        'button',
        {
          type: 'button',
          class: `rail-link${active ? ' active' : ''}`,
          'aria-current': active ? 'page' : null,
          onclick: () => hub.go(def.key),
        },
        [
          el('span', { class: 'icon', html: icon(def.icon, 14) }),
          el('span', {}, def.label),
          count === null || count === undefined ? null : el('span', { class: 'count' }, String(count)),
        ]
      )
    );
  }
  nav.append(
    el(
      'button',
      {
        type: 'button',
        class: 'rail-link',
        onclick: () => hub.openPlaybooks(),
      },
      [
        el('span', { class: 'icon', html: icon('strats', 14) }),
        el('span', {}, 'Strats & Playbooks'),
      ]
    )
  );
  rail.append(nav);
}

function teamIdentity(hub) {
  const { team } = hub;
  return el('div', { class: 'team-select' }, [
    el('div', { class: 'team-select-static', 'aria-label': team.name }, [
      teamMark(team, { class: 'sb-org-logo', style: 'width:28px;height:28px;' }),
      el('span', { class: 'team-select-name' }, team.name),
    ]),
  ]);
}

// ---------- Context panel toggle ----------

function contextToggle(panel) {
  const btn = el('button', {
    type: 'button',
    class: 'icon-btn ctx-toggle',
    'aria-label': 'Toggle context panel',
    'aria-expanded': 'false',
    title: 'Context panel',
    html: icon('panel', 14),
    onclick: () => {
      const open = panel.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
    },
  });
  return btn;
}
