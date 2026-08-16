import { el, icon, teamMark } from '../../utils.js';
import { getPref, setPref } from '../../prefs.js';
import { MODES, inlineError, skeleton } from './parts.js';
import * as overview from './sections/overview.js';
import * as roster from './sections/roster.js';
import * as notes from './sections/notes.js';
import * as objectives from './sections/objectives.js';
import * as strats from './sections/strats.js';
import * as veto from './sections/veto.js';
import * as practice from './sections/practice.js';
import * as teamSettings from './sections/teamSettings.js';
import { renderContextPanel } from './context.js';

// The Team Hub owns the whole content area: rail, workspace and context panel
// scroll independently, so the page opts out of the standard content padding.
export const flush = true;

const SECTION_DEFS = [
  { key: 'overview', label: 'Overview', icon: 'dashboard', module: overview },
  { key: 'roster', label: 'Roster', icon: 'roster', module: roster, count: 'members' },
  { key: 'notes', label: 'Team Notes', icon: 'notes', module: notes, count: 'notes' },
  { key: 'objectives', label: 'Objectives', icon: 'objectives', module: objectives },
  { key: 'strats', label: 'Strats & Playbooks', icon: 'strats', module: strats, count: 'strats', expandable: true },
  { key: 'veto', label: 'Veto History', icon: 'veto', module: veto },
  { key: 'practice', label: 'Practice Planner', icon: 'practice', module: practice },
  { key: 'settings', label: 'Team Settings', icon: 'settings', module: teamSettings },
];

export const SECTIONS = SECTION_DEFS.map((s) => s.key);

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
  const remembered = getPref('lastTeamId');
  const team =
    teams.find((t) => t.id === requestedTeam) ||
    (!requestedTeam && teams.find((t) => t.id === remembered)) ||
    teams[0];

  // A hub URL without a valid team is normalised so back/forward and reloads
  // land on the same place the user is looking at.
  if (team.id !== requestedTeam) {
    const tail = requestedTeam && SECTIONS.includes(requestedTeam) ? `/${parts.join('/')}` : '';
    window.location.replace(`#/team-hub/${team.id}${tail}`);
    return;
  }
  setPref('lastTeamId', team.id);

  const sectionKey = SECTIONS.includes(parts[1]) ? parts[1] : 'overview';
  const def = SECTION_DEFS.find((s) => s.key === sectionKey);
  const sub = parts.slice(2);

  const rail = el('aside', { class: 'hub-rail' });
  const workspace = el('div', { class: 'hub-workspace' });
  const context = el('aside', { class: 'hub-context', 'aria-label': 'Context panel' });
  const hub = el('div', { class: 'hub' }, [rail, workspace, context]);
  container.append(hub);

  const hubCtx = {
    ...ctx,
    team,
    teams,
    section: sectionKey,
    sub,
    go: (section, ...rest) =>
      ctx.navigate('team-hub', [team.id, section, ...rest.filter(Boolean)].join('/')),
    goTeam: (teamId) => ctx.navigate('team-hub', `${teamId}/${sectionKey}`),
    ctxToggle: contextToggle(context),
    refreshRail: null,
  };

  workspace.append(skeleton('kpi'));
  renderRail(rail, hubCtx, { members: null, notes: null, strats: null });

  let counts = { members: 0, notes: 0, strats: 0 };
  try {
    const [members, noteList, stratList] = await Promise.all([
      window.cci.getMembers(team.id),
      window.cci.getNotes(team.id),
      window.cci.getStrats(team.id),
    ]);
    counts = { members: members.length, notes: noteList.length, strats: stratList.length };
  } catch (err) {
    console.error('[team-hub] rail counts failed', err);
  }
  renderRail(rail, hubCtx, counts);
  // Callers fire this without awaiting, so a failed count refresh must not
  // surface as an unhandled rejection; stale counts are the acceptable outcome.
  hubCtx.refreshRail = async () => {
    try {
      const [members, noteList, stratList] = await Promise.all([
        window.cci.getMembers(team.id),
        window.cci.getNotes(team.id),
        window.cci.getStrats(team.id),
      ]);
      renderRail(rail, hubCtx, { members: members.length, notes: noteList.length, strats: stratList.length });
    } catch (err) {
      console.error('[team-hub] rail refresh failed', err);
    }
  };

  workspace.innerHTML = '';
  try {
    await def.module.render(workspace, hubCtx);
  } catch (err) {
    console.error(`[team-hub] section "${sectionKey}" failed`, err);
    workspace.innerHTML = '';
    workspace.append(inlineError(String(err?.message || err), () => render(container, ctx)));
  }

  await renderContextPanel(context, hubCtx);
}

// ---------- Rail ----------

function renderRail(rail, hub, counts) {
  rail.innerHTML = '';
  rail.append(teamSelector(hub));

  const nav = el('nav', { class: 'hub-rail-nav', 'aria-label': `${hub.team.name} sections` });
  for (const def of SECTION_DEFS) {
    const active = def.key === hub.section;
    const count = def.count ? counts[def.count] : null;
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

    // Mode filters only exist while Strats is the open section, matching the
    // spec's "expand its mode filters when selected" behaviour.
    if (def.expandable && active) {
      const activeMode = hub.sub[0] === 'mode' ? hub.sub[1] : 'all';
      nav.append(subLink('All Strats', activeMode === 'all', () => hub.go('strats')));
      for (const mode of MODES) {
        nav.append(
          subLink(mode.label, activeMode === mode.key, () => hub.go('strats', 'mode', mode.key))
        );
      }
    }
  }
  rail.append(nav);
}

function subLink(label, active, onClick) {
  return el(
    'button',
    { type: 'button', class: `rail-sublink${active ? ' active' : ''}`, 'aria-current': active ? 'true' : null, onclick: onClick },
    label
  );
}

function teamSelector(hub) {
  const { team, teams } = hub;
  const wrap = el('div', { class: 'team-select' });

  const btn = el(
    'button',
    {
      type: 'button',
      class: 'team-select-btn',
      'aria-haspopup': 'listbox',
      'aria-expanded': 'false',
      disabled: teams.length < 2 ? '' : null,
      style: teams.length < 2 ? 'cursor:default;' : null,
    },
    [
      teamMark(team, { class: 'sb-org-logo', style: 'width:34px;height:34px;' }),
      el('div', { class: 'team-select-id' }, [
        el('div', { class: 'team-select-name' }, team.name),
        el('div', { class: 'team-select-sub' }, team.tag ? `${team.tag} · Call of Duty` : 'Call of Duty Team'),
      ]),
      teams.length > 1 ? el('span', { class: 'team-select-chev', html: icon('chevronDown', 14) }) : null,
    ]
  );
  wrap.append(btn);
  if (teams.length < 2) return wrap;

  let menu = null;
  const close = () => {
    if (!menu) return;
    menu.remove();
    menu = null;
    btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', onOutside, true);
    document.removeEventListener('keydown', onKey, true);
  };
  const onOutside = (e) => {
    if (!wrap.contains(e.target)) close();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') {
      close();
      btn.focus();
    }
  };

  btn.addEventListener('click', () => {
    if (menu) return close();
    menu = el(
      'div',
      { class: 'team-menu', role: 'listbox' },
      teams.map((t) =>
        el(
          'button',
          {
            type: 'button',
            role: 'option',
            'aria-selected': String(t.id === team.id),
            class: `team-menu-item${t.id === team.id ? ' active' : ''}`,
            onclick: () => {
              close();
              if (t.id !== team.id) hub.goTeam(t.id);
            },
          },
          [t.name, el('span', { class: 'check', html: icon('check', 12) })]
        )
      )
    );
    wrap.append(menu);
    btn.setAttribute('aria-expanded', 'true');
    document.addEventListener('mousedown', onOutside, true);
    document.addEventListener('keydown', onKey, true);
    menu.querySelector('.team-menu-item')?.focus();
  });

  return wrap;
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
