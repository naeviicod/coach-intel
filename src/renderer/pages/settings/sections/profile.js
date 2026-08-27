import { el, faceMark } from '../../../utils.js';
import { BACKGROUND_OPTIONS, DEFAULT_BACKGROUND, applyBackground, backgroundUrl, nextBackground } from '../../../lib/background.js';
import { chipIdentity, isNaevii, titleChoices } from '../../../lib/profile.js';
import { getPref, setPref } from '../../../prefs.js';
import { toast } from '../../../components/modal.js';

// Everything about the person at this Mac: who the chip says they are, what the
// app looks like for them, and the way out. Org-wide settings live next door in
// Organization, which most roles never see.
export async function render(panel, ctx) {
  const [org, session] = await Promise.all([window.cci.getOrg(), sessionCard()]);
  const chip = chipIdentity(org, ctx.access);

  panel.append(profileCard(org, chip, ctx));
  panel.append(backgroundCard());
  if (session) panel.append(session);
}

function profileCard(org, chip, ctx) {
  const local = Boolean(ctx.access?.local);
  const defaultTitle = chip.title
    || (isNaevii(chip.name) || isNaevii(ctx.access?.me?.discord_username) ? 'Super Admin' : '')
    || (local ? 'Local' : '');

  const nameInput = el('input', {
    type: 'text',
    id: 'org-profile-name',
    value: chip.name === 'Coach' ? '' : chip.name,
    placeholder: 'Your name',
  });
  const titleInput = el(
    'select',
    { id: 'org-profile-title', 'aria-label': 'Title' },
    [
      el('option', { value: '' }, 'Select title'),
      ...titleChoices(defaultTitle).map((title) => el('option', { value: title }, title)),
    ]
  );
  titleInput.value = defaultTitle || '';

  const save = async (extra = {}) => {
    const profileName = String(nameInput.value || '').trim();
    const profileTitle = String(titleInput.value || '').trim();
    try {
      if (local) {
        await window.cci.saveOrg({
          ...org,
          coachName: profileName || org.coachName || 'Coach',
          profileName,
          profileTitle,
          ...extra,
        });
      } else {
        await window.cci.updateMyProfile({ displayName: profileName, title: profileTitle });
      }
      await ctx.refreshShell();
      ctx.reload();
      toast('Saved.');
    } catch (err) {
      console.error('[settings] save profile failed', err);
      toast(err?.message || 'Could not save profile.', 'error');
    }
  };

  return el('div', { class: 'card section' }, [
    el('div', { class: 'section-title' }, 'Your Profile'),
    el('div', { class: 'field-hint', style: 'margin-bottom:14px;max-width:620px;line-height:1.5;' },
      local
        ? 'This is the person signed in on this Mac — name, title, and photo in the top-right chip.'
        : 'Your name, title, and photo. Teammates see this on Players, Team Hub, and the calendar — same as plans and meetings.'),
    el('div', { class: 'profile-photo-row' }, [
      faceMark({ photo: chip.photo, avatarUrl: chip.avatarUrl, name: chip.name, size: 52 }),
      el('div', { style: 'flex:1;' }, [
        el('div', { class: 'settings-row-title' }, 'Profile photo'),
        el('div', { class: 'field-hint' }, local
          ? 'Square PNG or JPG. Stays on this Mac until you sign in.'
          : 'Square PNG or JPG. The whole org sees it. Falls back to Discord if you skip this.'),
      ]),
      el('button', {
        class: 'btn',
        onclick: async () => {
          const src = await window.cci.pickImage();
          if (!src) return;
          try {
            if (local) {
              const ext = String(src.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
              const rel = await window.cci.copyImage(src, `org/profile-photo.${ext}`);
              if (!rel) return;
              await save({ profilePhoto: rel });
              return;
            }
            await window.cci.setMyPhoto(src);
            await ctx.refreshShell();
            ctx.reload();
            toast('Saved.');
          } catch (err) {
            console.error('[settings] photo upload failed', err);
            toast(err?.message || 'Could not save photo.', 'error');
          }
        },
      }, chip.photo ? 'Change Photo' : 'Upload Photo'),
    ]),
    el('div', { class: 'inline-fields' }, [
      el('div', { class: 'field' }, [el('label', { for: 'org-profile-name' }, 'Your Name'), nameInput]),
      el('div', { class: 'field' }, [el('label', { for: 'org-profile-title' }, 'Title'), titleInput]),
    ]),
    el('div', { class: 'settings-actions' }, [
      el('button', { type: 'button', class: 'btn primary', onclick: () => save() }, 'Save Profile'),
    ]),
  ]);
}

function backgroundCard() {
  const current = applyBackground(getPref('background', DEFAULT_BACKGROUND));

  const mark = (id) => {
    for (const btn of grid.querySelectorAll('.bg-option')) {
      const on = btn.dataset.id === id;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  };

  const pick = (id) => {
    const resolved = applyBackground(id);
    setPref('background', resolved);
    mark(resolved);
  };

  const grid = el(
    'div',
    { class: 'bg-picker', role: 'group', 'aria-label': 'Background' },
    BACKGROUND_OPTIONS.map((opt) => {
      // The tile is 16:9 like the art itself, so `cover` shows the whole
      // wallpaper rather than a crop of its (deliberately empty) middle.
      const art = opt.src
        ? el('span', {
          class: 'bg-option-art',
          style: `background-image:url("${backgroundUrl(opt.src)}")`,
        })
        : el('span', { class: 'bg-option-art bg-option-pit' });
      return el('button', {
        type: 'button',
        class: `bg-option${opt.id === current ? ' active' : ''}`,
        'data-id': opt.id,
        'aria-pressed': opt.id === current ? 'true' : 'false',
        onclick: () => pick(opt.id),
      }, [
        el('span', { class: 'bg-option-frame' }, [art]),
        el('span', { class: 'bg-option-meta' }, [
          el('div', { class: 'bg-option-name' }, opt.name),
          el('div', { class: 'bg-option-hint' }, opt.hint),
        ]),
      ]);
    })
  );

  return el('div', { class: 'card section' }, [
    el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:2px;' }, [
      el('div', { class: 'section-title', style: 'margin-bottom:0;' }, 'Background'),
      el('button', {
        type: 'button',
        class: 'btn subtle sm',
        onclick: () => pick(nextBackground(getPref('background', DEFAULT_BACKGROUND))),
      }, 'Next background'),
    ]),
    el('div', { class: 'field-hint', style: 'margin-bottom:12px;max-width:620px;line-height:1.5;' },
      'Stays on this Mac. Highlight color retints the art as you change it.'),
    grid,
  ]);
}

// Sign-out used to live in Team Access, which is now staff-only — everyone
// needs a door out of their own session.
async function sessionCard() {
  const authState = await window.cci.auth.getState().catch(() => null);
  if (!authState?.configured || !authState.session) return null;
  return el('div', { class: 'card section' }, [
    el('div', { class: 'section-title' }, 'Session'),
    el('div', { class: 'list-item-row' }, [
      el('div', {}, [
        el('div', { class: 'settings-row-title' }, 'Signed in with Discord'),
        el('div', { class: 'field-hint' }, 'Signing out returns this Mac to the sign-in screen.'),
      ]),
      el('button', {
        class: 'btn subtle danger',
        onclick: async () => {
          await window.cci.auth.signOut();
          window.location.reload();
        },
      }, 'Sign out'),
    ]),
  ]);
}
