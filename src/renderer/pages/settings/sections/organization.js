import { el, initials } from '../../../utils.js';
import { ACCENT_PRESETS, DEFAULT_ACCENT, applyAccent, normalizeHex } from '../../../lib/accent.js';

export async function render(panel, ctx) {
  const org = await window.cci.getOrg();

  const nameInput = el('input', { type: 'text', id: 'org-name-input', value: org.name || '' });
  const tagInput = el('input', { type: 'text', id: 'org-tag-input', value: org.tag || '' });
  const coachInput = el('input', { type: 'text', id: 'org-coach-input', value: org.coachName || 'Coach' });

  const save = async (extra = {}) => {
    await window.cci.saveOrg({
      name: nameInput.value.trim() || 'My Organization',
      tag: tagInput.value.trim() || null,
      coachName: coachInput.value.trim() || 'Coach',
      logo: org.logo,
      accent: org.accent || DEFAULT_ACCENT,
      ...extra,
    });
    await ctx.refreshShell();
    ctx.reload();
  };

  panel.append(
    el('div', { class: 'card section' }, [
      el('div', { class: 'section-title' }, 'Identity'),
      el('div', { class: 'inline-fields' }, [
        el('div', { class: 'field' }, [el('label', {}, 'Org Name'), nameInput]),
        el('div', { class: 'field' }, [el('label', {}, 'Tag / Abbreviation'), tagInput]),
      ]),
      el('div', { class: 'field' }, [
        el('label', {}, 'Coach Display Name'),
        coachInput,
        el('div', { class: 'field-hint' }, 'Shown in the top bar profile chip.'),
      ]),
      el('div', { class: 'settings-actions' }, [
        el('button', { class: 'btn primary', onclick: () => save() }, 'Save Changes'),
      ]),
    ])
  );

  panel.append(
    el('div', { class: 'card section' }, [
      el('div', { class: 'section-title' }, 'Logo'),
      el('div', { class: 'list-item-row' }, [
        el('div', { style: 'display:flex;align-items:center;gap:12px;' }, [
          el('div', { class: 'avatar', style: 'width:44px;height:44px;' }, initials(org.name || 'CI')),
          el('div', {}, [
            el('div', { class: 'settings-row-title' }, 'Organization logo'),
            el('div', { class: 'field-hint' }, 'Square PNG or JPG works best. Used in the sidebar and on reports.'),
          ]),
        ]),
        el('button', {
          class: 'btn',
          onclick: async () => {
            const src = await window.cci.pickImage();
            if (!src) return;
            const ext = src.split('.').pop();
            await window.cci.copyImage(src, `org/logos/org-logo.${ext}`);
            await save({ logo: `org/logos/org-logo.${ext}` });
          },
        }, 'Upload Logo'),
      ]),
    ])
  );

  panel.append(accentCard(org, save));
}

function accentCard(org, save) {
  const current = normalizeHex(org.accent) || DEFAULT_ACCENT;
  const hexInput = el('input', { type: 'text', value: current, spellcheck: 'false', maxlength: 7 });
  const picker = el('input', { type: 'color', value: current, class: 'accent-picker' });

  const paint = (hex) => {
    const color = applyAccent(hex);
    hexInput.value = color;
    picker.value = color;
    for (const btn of swatches.querySelectorAll('.accent-swatch')) {
      btn.classList.toggle('active', btn.dataset.hex === color);
    }
  };

  const swatches = el(
    'div',
    { class: 'accent-swatches' },
    ACCENT_PRESETS.map((preset) =>
      el('button', {
        type: 'button',
        class: `accent-swatch${preset.hex === current ? ' active' : ''}`,
        title: preset.name,
        'data-hex': preset.hex,
        style: `background:${preset.hex}`,
        onclick: () => paint(preset.hex),
      })
    )
  );

  hexInput.addEventListener('input', () => {
    const hex = normalizeHex(hexInput.value);
    if (hex) paint(hex);
  });
  picker.addEventListener('input', () => paint(picker.value));

  return el('div', { class: 'card section' }, [
    el('div', { class: 'section-title' }, 'Highlight Color'),
    el('div', { class: 'field-hint', style: 'margin-bottom:12px;max-width:620px;line-height:1.5;' },
      'Used on Continue, Save, and other primary buttons, plus the active sidebar mark.'),
    swatches,
    el('div', { class: 'inline-fields', style: 'margin-top:12px;align-items:end;' }, [
      el('div', { class: 'field' }, [el('label', {}, 'Color Picker'), picker]),
      el('div', { class: 'field' }, [el('label', {}, 'Hex Code'), hexInput]),
    ]),
    el('div', { class: 'settings-actions' }, [
      el('button', {
        class: 'btn subtle',
        onclick: () => paint(DEFAULT_ACCENT),
      }, 'Reset to Lime'),
      el('button', {
        class: 'btn primary',
        onclick: async () => {
          const hex = normalizeHex(hexInput.value) || DEFAULT_ACCENT;
          applyAccent(hex);
          await save({ accent: hex });
        },
      }, 'Save Color'),
    ]),
  ]);
}
