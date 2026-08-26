import { el } from '../../../utils.js';
import { asset } from '../../../lib/assets.js';

export async function render(panel) {
  const version = await window.cci.getAppVersion();
  const ruleset = await window.cci.getCdlRuleset();

  panel.append(
    el('div', { class: 'card section' }, [
      el('div', { class: 'section-title' }, 'Coach Intel'),
      el('div', { class: 'about-lockup' }, [
        el('span', { class: 'ci-lockup', role: 'img', 'aria-label': 'Coach Intel' }, [
          el('img', { class: 'ci-lockup-base', src: asset('logo-mark-base.png'), alt: '' }),
          el('span', { class: 'ci-lockup-accent', 'aria-hidden': 'true' }),
        ]),
        el('div', { class: 'field-hint' }, 'Know More. Win More.'),
      ]),
      aboutRow('Version', `v${version || '2.1.0'}`),
      aboutLinkRow('Website', 'coach.championshipseries.eu', 'https://coach.championshipseries.eu/'),
      aboutRow('Mode', 'Offline · On-device only'),
      ruleset ? aboutRow('Ruleset', `${ruleset.game} · Season ${ruleset.season} · v${ruleset.version}`) : null,
      ruleset ? aboutRow('Ruleset checked', ruleset.last_checked) : null,
    ])
  );
}

function aboutRow(label, value) {
  return el('div', { class: 'list-item-row' }, [
    el('div', { class: 'settings-row-title' }, label),
    el('div', { class: 'about-value' }, value),
  ]);
}

function aboutLinkRow(label, text, href) {
  return el('div', { class: 'list-item-row' }, [
    el('div', { class: 'settings-row-title' }, label),
    el('button', {
      type: 'button',
      class: 'about-link',
      onclick: () => window.cci.openExternal(href),
    }, text),
  ]);
}
