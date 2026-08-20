import { el, icon } from '../../utils.js';
import { SETTINGS_SECTIONS, resolveSettingsSection } from '../../lib/settingsAccess.js';
import * as profile from './sections/profile.js';
import * as organization from './sections/organization.js';
import * as gameRules from './sections/gameRules.js';
import * as integrations from './sections/integrations.js';
import * as teamAccess from './sections/teamAccess.js';
import * as data from './sections/data.js';
import * as about from './sections/about.js';
import * as feedback from './sections/feedback.js';

// The catalog (and who may see each section) lives in lib/settingsAccess.js so
// the rule is testable without a DOM; this map is only the wiring.
const MODULES = {
  profile,
  organization,
  'game-rules': gameRules,
  integrations,
  'team-access': teamAccess,
  data,
  feedback,
  about,
};

export const SECTIONS = SETTINGS_SECTIONS.map((s) => s.key);
export const flush = true;

let live = null;

function resolveSection(ctx) {
  return resolveSettingsSection(ctx.access, ctx.param);
}

export async function render(container, ctx) {
  if (ctx.param === 'teams') {
    ctx.navigate('teams');
    return;
  }
  const { visible, sectionKey, def } = resolveSection(ctx);

  const subtitle = el('div', { class: 'page-subtitle' }, def.sub);
  const nav = el('nav', { class: 'settings-nav', 'aria-label': 'Settings sections' });
  const panel = el('div', { class: 'settings-panel' });
  const page = el('div', { class: 'settings-page' }, [
    el('div', { class: 'page-header' }, [
      el('div', {}, [
        el('div', { class: 'page-title' }, 'Settings'),
        subtitle,
      ]),
    ]),
    el('div', { class: 'settings-layout' }, [nav, panel]),
  ]);
  container.append(page);

  live = { container, nav, panel, subtitle, sectionKey, visibleKeys: visible.map((s) => s.key).join() };
  fillNav(nav, visible, sectionKey, ctx);
  await paintPanel(def, ctx, { animate: false });
}

// Same Settings shell, different section: keep the left nav so Organization →
// About does not fade or rebuild that panel.
export async function update(container, ctx) {
  if (ctx.param === 'teams') {
    ctx.navigate('teams');
    return;
  }
  if (!live?.panel?.isConnected || live.container !== container) {
    container.innerHTML = '';
    return render(container, ctx);
  }

  const { visible, sectionKey, def } = resolveSection(ctx);
  if (visible.map((s) => s.key).join() !== live.visibleKeys) {
    container.innerHTML = '';
    return render(container, ctx);
  }

  const same = sectionKey === live.sectionKey;
  live.sectionKey = sectionKey;
  live.subtitle.textContent = def.sub;
  markNav(live.nav, sectionKey);
  if (same) return;
  await paintPanel(def, ctx, { animate: true });
}

function fillNav(nav, visible, sectionKey, ctx) {
  nav.replaceChildren(
    ...visible.map((item) => {
      const active = item.key === sectionKey;
      return el(
        'button',
        {
          type: 'button',
          class: `rail-link${active ? ' active' : ''}`,
          'data-section': item.key,
          'aria-current': active ? 'page' : null,
          onclick: () => ctx.navigate('settings', item.key),
        },
        [el('span', { class: 'icon', html: icon(item.icon, 14) }), el('span', {}, item.label)]
      );
    })
  );
}

function markNav(nav, sectionKey) {
  for (const btn of nav.querySelectorAll('.rail-link')) {
    const active = btn.dataset.section === sectionKey;
    btn.classList.toggle('active', active);
    if (active) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  }
}

async function paintPanel(def, ctx, { animate = true } = {}) {
  if (!live?.panel) return;
  const panel = live.panel;
  const sectionCtx = { ...ctx, reload: () => paintPanel(def, ctx, { animate: false }) };
  const holder = el('div');
  try {
    await MODULES[def.key].render(holder, sectionCtx);
  } catch (err) {
    console.error(`[settings] section "${def.key}" failed`, err);
    panel.innerHTML = '';
    panel.append(
      el('div', { class: 'card inline-error' }, [
        el('div', { class: 'inline-error-title' }, 'This section failed to load'),
        el('div', {}, String(err?.message || err)),
      ])
    );
    return;
  }
  panel.replaceChildren(...holder.childNodes);
  panel.scrollTop = 0;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!animate || reduceMotion || !panel.animate) return;
  const anim = panel.animate(
    [{ opacity: 0 }, { opacity: 1 }],
    { duration: 160, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'forwards' }
  );
  anim.finished.then(() => {
    try { anim.commitStyles(); anim.cancel(); } catch { /* ignore */ }
    panel.style.opacity = '';
  }).catch(() => { panel.style.opacity = ''; });
}
