import { el } from '../utils.js';
import { asset } from '../lib/assets.js';
import { welcomeCopy } from '../lib/desktopSetup.js';

export function render(container, { memberName = null, onComplete } = {}) {
  const state = { memberName, authorizing: false, fallbackReady: false, unsubscribe: null };

  const closeSubscription = () => {
    state.unsubscribe?.();
    state.unsubscribe = null;
  };

  const finish = () => {
    closeSubscription();
    onComplete?.();
  };

  const draw = () => {
    const copy = welcomeCopy(state.memberName);
    const personalized = Boolean(state.memberName);
    const primaryLabel = personalized || state.fallbackReady ? 'Continue' : state.authorizing ? 'Waiting for secure sign-in…' : 'Continue';
    const detail = state.authorizing
      ? 'Continue secure sign-in in your default browser. Coach Intel will return here automatically.'
      : state.fallbackReady
      ? 'Personalization is unavailable right now. You can still continue with Coach Intel setup.'
      : null;

    container.innerHTML = '';
    container.append(
      el('div', { class: 'onboarding-screen desktop-setup-screen' }, [
        el('div', { class: 'desktop-setup-brief' }, [
          el('div', { class: 'signin-kicker' }, 'Coach Intel setup'),
          el('img', { class: 'desktop-setup-lockup', src: asset('full-logo.webp'), alt: 'Coach Intel' }),
          el('div', { class: 'desktop-setup-title', role: 'heading', 'aria-level': '1' }, copy.title),
          el('div', { class: 'desktop-setup-copy' }, [
            el('p', {}, copy.lineOne),
            el('p', {}, copy.lineTwo),
          ]),
          detail ? el('div', { class: 'desktop-setup-status', role: 'status', 'aria-live': 'polite' }, detail) : null,
          el('button', {
            class: 'btn primary desktop-setup-continue',
            type: 'button',
            disabled: state.authorizing ? 'disabled' : null,
            onclick: async () => {
              if (personalized || state.fallbackReady) return finish();
              state.authorizing = true;
              draw();
              try {
                const result = await window.cci.desktopSetup.start();
                if (!result?.ok) {
                  state.authorizing = false;
                  state.fallbackReady = true;
                  draw();
                }
              } catch {
                state.authorizing = false;
                state.fallbackReady = true;
                draw();
              }
            },
          }, primaryLabel),
        ]),
      ])
    );
  };

  state.unsubscribe = window.cci.desktopSetup.onStatus((result) => {
    state.authorizing = false;
    state.memberName = result?.ok ? result.displayName || null : null;
    state.fallbackReady = !result?.ok || !state.memberName;
    draw();
  });
  draw();
}
