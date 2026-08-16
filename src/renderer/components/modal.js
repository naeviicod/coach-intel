import { el } from '../utils.js';

// Shared overlay used by the Discord integration screens. Matches the existing
// .modal-overlay / .modal styling already in the app.
export function openModal(bodyEl, { width } = {}) {
  const overlay = el('div', {
    class: 'modal-overlay',
    onclick: (e) => {
      if (e.target === overlay) overlay.remove();
    },
  });
  const modal = el('div', { class: 'modal', style: width ? `width:${width};` : null });
  modal.append(bodyEl);
  overlay.append(modal);
  document.body.append(overlay);

  const onKey = (e) => {
    if (e.key !== 'Escape') return;
    overlay.remove();
    window.removeEventListener('keydown', onKey);
  };
  window.addEventListener('keydown', onKey);

  return overlay;
}

export function modalActions(children) {
  return el('div', { class: 'modal-actions' }, children);
}

let toastHost = null;

export function toast(message, tone = 'info') {
  if (!toastHost) {
    toastHost = el('div', { class: 'toast-host' });
    document.body.append(toastHost);
  }
  const node = el('div', { class: `toast ${tone}` }, message);
  toastHost.append(node);
  setTimeout(() => node.classList.add('out'), 3200);
  setTimeout(() => node.remove(), 3600);
  return node;
}

// Unwraps the { ok, data, message } envelope returned by every Discord IPC call,
// surfacing the user-facing message on failure.
export async function call(promise, { silent = false } = {}) {
  const result = await promise;
  if (result && result.ok) return result.data;
  const message = result?.message || 'Something went wrong.';
  if (!silent) toast(message, 'error');
  return null;
}
