import { el } from '../../../utils.js';
import { cdlRulesetCard } from '../../cdlRulesetSettings.js';

export async function render(panel, ctx) {
  const ruleset = await window.cci.getCdlRuleset();

  if (!ruleset) {
    panel.append(
      el('div', { class: 'card section' }, [
        el('div', { class: 'section-title' }, 'Ruleset'),
        el('div', { class: 'field-hint' }, 'No ruleset file found. Reinstall or restore data/knowledge/cdl-ruleset.json.'),
      ])
    );
    return;
  }

  const reload = async () => {
    await ctx.refreshShell();
    ctx.reload();
  };

  panel.append(rulesetIdentityCard(ruleset, reload));
  panel.append(cdlRulesetCard(ruleset, reload));

  panel.append(
    el('div', { class: 'card section' }, [
      el('div', { class: 'section-title' }, 'How the pool is used'),
      el(
        'div',
        { class: 'field-hint', style: 'max-width:620px;line-height:1.6;' },
        'Active maps drive the map pool on Team Hub, the map picker on strats, and the veto board. Deactivating a map keeps every match and strat that already references it — it only leaves the current pool.'
      ),
    ])
  );
}

function rulesetIdentityCard(ruleset, onChange) {
  const label = el('input', { type: 'text', value: ruleset.label || 'CDL Ruleset' });
  const game = el('input', { type: 'text', value: ruleset.game || '' });
  const season = el('input', { type: 'text', value: ruleset.season || '' });
  const version = el('input', { type: 'text', value: ruleset.version || '' });
  const show = el('input', {
    type: 'checkbox',
    checked: ruleset.show_in_status === false ? null : 'checked',
  });

  const persist = async (extra = {}) => {
    await window.cci.updateCdlRulesetMeta({
      label: label.value.trim(),
      game: game.value.trim(),
      season: season.value.trim(),
      version: version.value.trim(),
      show_in_status: show.checked,
      ...extra,
    });
    await onChange();
  };

  return el('div', { class: 'card section' }, [
    el('div', { class: 'section-title' }, 'Game & Season'),
    el('div', { class: 'field-hint', style: 'margin-bottom:12px;max-width:620px;line-height:1.5;' },
      'This is what the status bar shows. Change it when the title or season changes, or hide it.'),
    el('div', { class: 'field' }, [el('label', {}, 'Status Bar Label'), label]),
    el('div', { class: 'inline-fields' }, [
      el('div', { class: 'field' }, [el('label', {}, 'Game'), game]),
      el('div', { class: 'field' }, [el('label', {}, 'Season'), season]),
      el('div', { class: 'field' }, [el('label', {}, 'Version'), version]),
    ]),
    el('label', {
      style: 'display:flex;align-items:center;gap:8px;font-size:12.5px;margin:4px 0 12px;color:var(--text);',
    }, [
      show,
      'Show game and season in the status bar',
    ]),
    el('div', { class: 'settings-actions' }, [
      el('button', {
        class: 'btn subtle',
        onclick: async () => {
          label.value = '';
          game.value = '';
          season.value = '';
          version.value = '';
          show.checked = false;
          await persist({ label: '', game: '', season: '', version: '', show_in_status: false });
        },
      }, 'Hide from Status Bar'),
      el('button', { class: 'btn primary', onclick: () => persist() }, 'Save Ruleset'),
    ]),
  ]);
}
