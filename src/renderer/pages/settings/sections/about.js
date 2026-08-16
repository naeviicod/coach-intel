import { el } from '../../../utils.js';
import { asset } from '../../../lib/assets.js';
import { VERSION_RULES } from '../../../lib/version.js';

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
      aboutRow('Version', `v${version || '0.2.0'}`),
      aboutRow('Mode', 'Offline · On-device only'),
      ruleset ? aboutRow('Ruleset', `${ruleset.game} · Season ${ruleset.season} · v${ruleset.version}`) : null,
      ruleset ? aboutRow('Ruleset checked', ruleset.last_checked) : null,
    ])
  );

  panel.append(
    el('div', { class: 'card section' }, [
      el('div', { class: 'section-title' }, 'Version Rule'),
      el('div', { class: 'field-hint', style: 'margin-bottom:10px;' },
        'App version is MAJOR.MINOR.MINI. Pick the smallest step that matches the change.'),
      ...VERSION_RULES.map((rule) =>
        el('div', { class: 'list-item-row' }, [
          el('div', {}, [
            el('div', { class: 'settings-row-title' }, rule.name),
            el('div', { class: 'field-hint' }, rule.example),
          ]),
          el('div', { class: 'about-value version-step' }, rule.step),
        ])
      ),
    ])
  );
}

function aboutRow(label, value) {
  return el('div', { class: 'list-item-row' }, [
    el('div', { class: 'settings-row-title' }, label),
    el('div', { class: 'about-value' }, value),
  ]);
}
