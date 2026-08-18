import { el, faceMark, orgMark } from '../../../utils.js';
import { ACCENT_PRESETS, DEFAULT_ACCENT, applyAccent, normalizeHex } from '../../../lib/accent.js';
import { TITLE_SUGGESTIONS, chipIdentity, isNaevii } from '../../../lib/profile.js';
import { toast } from '../../../components/modal.js';

export async function render(panel, ctx) {
  const org = await window.cci.getOrg();
  const chip = chipIdentity(org, ctx.access);
  const defaultTitle = org.profileTitle
    || (isNaevii(chip.name) || isNaevii(ctx.access?.me?.discord_username) ? 'Developer' : '')
    || (ctx.access?.local ? 'Local' : '');

  const nameInput = el('input', { type: 'text', id: 'org-name-input', value: org.name || '' });
  const tagInput = el('input', { type: 'text', id: 'org-tag-input', value: org.tag || '' });
  const profileNameInput = el('input', {
    type: 'text',
    id: 'org-profile-name',
    value: org.profileName || ctx.access?.me?.discord_username || org.coachName || '',
    placeholder: 'Your name',
  });
  const profileTitleInput = el('input', {
    type: 'text',
    id: 'org-profile-title',
    value: defaultTitle,
    list: 'org-title-suggestions',
    placeholder: 'Head Coach',
  });
  const titleList = el(
    'datalist',
    { id: 'org-title-suggestions' },
    TITLE_SUGGESTIONS.map((title) => el('option', { value: title }))
  );

  const save = async (extra = {}) => {
    const profileName = String(profileNameInput.value || '').trim();
    const profileTitle = String(profileTitleInput.value || '').trim();
    try {
      await window.cci.saveOrg({
        name: nameInput.value.trim() || 'My Organization',
        tag: tagInput.value.trim() || null,
        coachName: profileName || org.coachName || 'Coach',
        profileName,
        profileTitle,
        profilePhoto: extra.profilePhoto !== undefined ? extra.profilePhoto : org.profilePhoto,
        logo: extra.logo !== undefined ? extra.logo : org.logo,
        accent: extra.accent !== undefined ? extra.accent : org.accent || DEFAULT_ACCENT,
        ...extra,
      });
      await ctx.refreshShell();
      ctx.reload();
      toast('Saved.');
    } catch (err) {
      console.error('[settings] save org failed', err);
      toast(err?.message || 'Could not save profile.', 'error');
    }
  };

  panel.append(
    el('div', { class: 'card section' }, [
      el('div', { class: 'section-title' }, 'Identity'),
      el('div', { class: 'inline-fields' }, [
        el('div', { class: 'field' }, [el('label', {}, 'Org Name'), nameInput]),
        el('div', { class: 'field' }, [el('label', {}, 'Tag / Abbreviation'), tagInput]),
      ]),
      el('div', { class: 'settings-actions' }, [
        el('button', { type: 'button', class: 'btn primary', onclick: () => save() }, 'Save Changes'),
      ]),
    ])
  );

  panel.append(
    el('div', { class: 'card section' }, [
      el('div', { class: 'section-title' }, 'Your Profile'),
      el('div', { class: 'field-hint', style: 'margin-bottom:14px;max-width:620px;line-height:1.5;' },
        'This is the person signed in on this Mac — name, title, and photo in the top-right chip.'),
      el('div', { class: 'profile-photo-row' }, [
        faceMark({ photo: org.profilePhoto, avatarUrl: ctx.access?.me?.avatar_url, name: chip.name, size: 52 }),
        el('div', { style: 'flex:1;' }, [
          el('div', { class: 'settings-row-title' }, 'Profile photo'),
          el('div', { class: 'field-hint' }, 'Square PNG or JPG. Falls back to your Discord avatar when signed in.'),
        ]),
        el('button', {
          class: 'btn',
          onclick: async () => {
            const src = await window.cci.pickImage();
            if (!src) return;
            const ext = String(src.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
            const rel = await window.cci.copyImage(src, `org/profile-photo.${ext}`);
            if (!rel) return;
            await save({ profilePhoto: rel });
          },
        }, org.profilePhoto ? 'Change Photo' : 'Upload Photo'),
      ]),
      el('div', { class: 'inline-fields' }, [
        el('div', { class: 'field' }, [
          el('label', { for: 'org-profile-name' }, 'Your Name'),
          profileNameInput,
        ]),
        el('div', { class: 'field' }, [
          el('label', { for: 'org-profile-title' }, 'Title'),
          profileTitleInput,
          titleList,
        ]),
      ]),
      el('div', { class: 'settings-actions' }, [
        el('button', { type: 'button', class: 'btn primary', onclick: () => save() }, 'Save Profile'),
      ]),
    ])
  );

  panel.append(
    el('div', { class: 'card section' }, [
      el('div', { class: 'section-title' }, 'Logo'),
      el('div', { class: 'list-item-row' }, [
        el('div', { style: 'display:flex;align-items:center;gap:12px;' }, [
          orgMark(org, { class: 'avatar', style: 'width:44px;height:44px;' }),
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
      'First launch is Intel Lime. Invited teammates pick up this color the next time they open Coach Intel.'),
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
