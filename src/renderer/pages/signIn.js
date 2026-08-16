import { el } from '../utils.js';
import { asset } from '../lib/assets.js';

// Full-chrome sign-in gate, shown by app.js in place of the app shell whenever
// Supabase is configured but there is no session yet. Mirrors onboarding.js's
// screen layout so the two full-screen states feel like one system.
export function render(container, { onComplete } = {}) {
  const state = { status: 'idle', error: null };
  draw(container, state);

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

function draw(container, state) {
  container.innerHTML = '';

  const card = el('div', { class: 'onboarding-card' }, [
    el('div', { class: 'onboarding-step-label' }, 'SIGN IN'),
    el('div', { class: 'onboarding-title' }, 'Sign in to Coach Intel'),
    el('div', { class: 'onboarding-sub' }, 'Use the Discord account you use in the team server.'),
    state.error
      ? el('div', { class: 'card inline-error', style: 'margin:16px 0;' }, [
          el('div', { class: 'inline-error-title' }, 'Sign-in failed'),
          el('div', {}, state.error),
        ])
      : null,
    el(
      'button',
      {
        class: 'btn primary onboarding-continue',
        disabled: state.status === 'working' ? 'disabled' : null,
        onclick: async () => {
          state.status = 'working';
          state.error = null;
          draw(container, state);
          try {
            await window.cci.auth.signInWithDiscord();
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

  container.append(
    el('div', { class: 'onboarding-screen' }, [
      el('div', { class: 'onboarding-brand-wrap' }, [
        el('img', { class: 'onboarding-brand brand-tint', src: asset('full-logo.png'), alt: 'Coach Intel' }),
      ]),
      card,
    ])
  );
}
