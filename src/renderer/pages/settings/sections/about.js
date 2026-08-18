import { el } from '../../../utils.js';
import { asset } from '../../../lib/assets.js';

export async function render(panel) {
  const version = await window.cci.getAppVersion();
  const ruleset = await window.cci.getCdlRuleset();

  panel.append(
    el('div', { class: 'card section' }, [
      el('div', { class: 'section-title' }, 'Coach Intel'),
      el('div', { class: 'about-lockup' }, [
        el('img', { class: 'brand-tint', src: asset('logo-mark.png'), alt: 'Coach Intel' }),
        el('div', { class: 'field-hint' }, 'Know More. Win More.'),
      ]),
      aboutRow('Version', `v${version || '0.6.1'}`),
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
