import { el } from '../utils.js';
import { asset } from '../lib/assets.js';
import { applyAccent, resolveAccent } from '../lib/accent.js';
import { accessRoleLabel } from '../lib/invite.js';

function paintInviteAccent(invite) {
  if (!splashDismissed()) return;
  const fromInvite = invite?.accent;
  if (!fromInvite) return;
  applyAccent(resolveAccent({ invite: fromInvite }));
}

// Full-chrome sign-in gate, shown by app.js in place of the app shell whenever
// Supabase is configured but there is no session yet. Mirrors onboarding.js's
// screen layout so the two full-screen states feel like one system.
export function render(container, { onComplete } = {}) {
  const state = { status: 'idle', error: null, invite: null };
  paintInviteAccent(null);
  document.addEventListener('cci:splash-done', () => paintInviteAccent(state.invite), { once: true });
  draw(container, state);

  window.cci.invites?.pending?.().then((result) => {
    if (result?.ok && result.data?.gamertag) {
      state.invite = result.data;
      paintInviteAccent(state.invite);
      draw(container, state);
    }
  });
  window.cci.invites?.onPending?.((preview) => {
    if (preview?.gamertag) {
      state.invite = preview;
      state.error = preview.error || null;
      paintInviteAccent(state.invite);
      draw(container, state);
    }
  });

  // Registered once here, not inside draw(), so re-rendering on every keypress
  // of state never stacks up duplicate listeners.
  window.cci.auth.onAuthStateChanged(({ session, error } = {}) => {
    if (session) {
      onComplete?.();
      return;
    }
    state.status = 'idle';
    state.error = error || 'Sign-in did not complete. Try again.';
    draw(container, state);
  });

  window.cci.auth.getState().then(({ session } = {}) => {
    if (session) onComplete?.();
  }).catch(() => {});
}

function splashDismissed() {
  const splash = document.getElementById('splash');
  return !splash || splash.dataset.done === '1' || splash.classList.contains('hide') || splash.classList.contains('landed') || splash.style.display === 'none';
}

function draw(container, state) {
  container.innerHTML = '';

  const screen = el('div', { class: 'onboarding-screen signin-screen' }, [
    el('div', { class: 'signin-brief' }, [
    el('div', { class: 'signin-kicker' }, 'Secure channel'),
    el('div', { class: 'signin-identity' }, [
      el('div', { class: 'signin-lockup' }, [
        el('img', { class: 'signin-mark', src: asset('splash-logo.png'), alt: 'Coach Intel' }),
        el('img', { class: 'signin-wordmark', src: asset('splash-wordmark.png'), alt: '', 'aria-hidden': 'true' }),
      ]),
      el('div', { class: 'signin-slogan-frame', 'aria-hidden': 'true' }, [
        el('img', { class: 'signin-slogan', src: asset('splash-slogan.png'), alt: '' }),
      ]),
    ]),
    state.error
      ? el('div', { class: 'card inline-error', style: 'max-width:360px;' }, [
          el('div', { class: 'inline-error-title' }, 'Sign-in failed'),
          el('div', {}, state.error),
        ])
      : null,
    state.invite?.gamertag
      ? el('div', { class: 'card', style: 'max-width:360px;padding:14px 16px;' }, [
          el('div', { class: 'settings-row-title' }, `Join as ${state.invite.gamertag}`),
          el('div', { class: 'field-hint', style: 'margin-top:6px;line-height:1.45;' },
            `${state.invite.team_name || 'Your team'} · ${accessRoleLabel(state.invite.access_role)}. Sign in with Discord to link this roster slot.`),
        ])
      : null,
    el(
      'button',
      {
        class: 'btn primary signin-discord',
        disabled: state.status === 'working' ? 'disabled' : null,
        onclick: async () => {
          state.status = 'working';
          state.error = null;
          draw(container, state);
          try {
            const result = await window.cci.auth.signInWithDiscord();
            if (result && result.ok === false) throw new Error(result.error || 'Could not start Discord sign-in.');
          } catch (err) {
            state.status = 'idle';
            state.error = err?.message || 'Could not start Discord sign-in.';
            draw(container, state);
          }
        },
      },
      state.status === 'working' ? 'Waiting on Discord…' : 'Sign in with Discord'
    ),
    el('div', { class: 'signin-foot' }, 'Opens Discord. You land in the app.'),
    ]),
  ]);
  if (splashDismissed()) screen.classList.add('gate-in');
  container.append(screen);
}
