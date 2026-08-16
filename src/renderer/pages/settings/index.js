import { el, icon } from '../../utils.js';
import * as organization from './sections/organization.js';
import * as gameRules from './sections/gameRules.js';
import * as integrations from './sections/integrations.js';
import * as teamAccess from './sections/teamAccess.js';
import * as data from './sections/data.js';
import * as about from './sections/about.js';

const SECTION_DEFS = [
  { key: 'organization', label: 'Organization', icon: 'teams', sub: 'Identity, logo and coach profile', module: organization },
  { key: 'game-rules', label: 'Game Rules', icon: 'mapsModes', sub: 'CDL ruleset and the active map pool', module: gameRules },
  { key: 'integrations', label: 'Integrations', icon: 'integrations', sub: 'Discord and outside data sources', module: integrations },
  { key: 'team-access', label: 'Team Access', icon: 'players', sub: 'Who can sign in, and their role', module: teamAccess },
  { key: 'data', label: 'Data & Storage', icon: 'database', sub: 'Where your data lives, and how to erase it', module: data },
  { key: 'about', label: 'About', icon: 'help', sub: 'Version and build information', module: about },
];

export const SECTIONS = SECTION_DEFS.map((s) => s.key);

export async function render(container, ctx) {
  if (ctx.param === 'teams') {
    ctx.navigate('teams');
    return;
  }
  const sectionKey = SECTIONS.includes(ctx.param) ? ctx.param : SECTIONS[0];
  const def = SECTION_DEFS.find((s) => s.key === sectionKey);

  container.append(
    el('div', { class: 'page-header' }, [
      el('div', {}, [
        el('div', { class: 'page-title' }, 'Settings'),
        el('div', { class: 'page-subtitle' }, def.sub),
      ]),
    ])
  );

  const nav = el('nav', { class: 'settings-nav', 'aria-label': 'Settings sections' });
  for (const item of SECTION_DEFS) {
    const active = item.key === sectionKey;
    nav.append(
      el(
        'button',
        {
          type: 'button',
          class: `rail-link${active ? ' active' : ''}`,
          'aria-current': active ? 'page' : null,
          onclick: () => ctx.navigate('settings', item.key),
        },
        [el('span', { class: 'icon', html: icon(item.icon, 14) }), el('span', {}, item.label)]
      )
    );
  }

  const panel = el('div', { class: 'settings-panel' });
  container.append(el('div', { class: 'settings-layout' }, [nav, panel]));

  // Sections reload themselves in place so saving a team or a map never throws
  // the coach back to the top of the settings page.
  const sectionCtx = { ...ctx, reload: () => renderSection(panel, def, sectionCtx) };
  await renderSection(panel, def, sectionCtx);
}

async function renderSection(panel, def, sectionCtx) {
  panel.innerHTML = '';
  try {
    await def.module.render(panel, sectionCtx);
  } catch (err) {
    console.error(`[settings] section "${def.key}" failed`, err);
    panel.innerHTML = '';
    panel.append(
      el('div', { class: 'card inline-error' }, [
        el('div', { class: 'inline-error-title' }, 'This section failed to load'),
        el('div', {}, String(err?.message || err)),
      ])
    );
  }
}
