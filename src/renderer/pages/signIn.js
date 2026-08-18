import { el } from '../utils.js';
import { asset } from '../lib/assets.js';
import { applyAccent, resolveAccent } from '../lib/accent.js';
import { accessRoleLabel } from '../lib/invite.js';

function paintInviteAccent(invite) {
  applyAccent(resolveAccent({
    invite: invite?.accent,
    firstLaunch: !invite?.accent,
  }));
}

// Full-chrome sign-in gate, shown by app.js in place of the app shell whenever
// Supabase is configured but there is no session yet. Mirrors onboarding.js's
// screen layout so the two full-screen states feel like one system.
export function render(container, { onComplete } = {}) {
  const state = { status: 'idle', error: null, invite: null };
  paintInviteAccent(null);
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
}

function splashDismissed() {
  const splash = document.getElementById('splash');
  return !splash || splash.classList.contains('hide') || splash.classList.contains('landed') || splash.style.display === 'none';
}

function draw(container, state) {
  container.innerHTML = '';

  const screen = el('div', { class: 'onboarding-screen signin-screen' }, [
    el('img', { class: 'signin-mark', src: asset('ci-mark.png'), alt: 'Coach Intel' }),
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
  ]);
  if (splashDismissed()) screen.classList.add('gate-in');
  container.append(screen);
}
