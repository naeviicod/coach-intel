import { el } from '../utils.js';

// Close only when the press started and ended on the dimmed backdrop.
// A click event fires on mouseup's target, so selecting text in the modal
// and releasing outside used to dismiss without saving.
export function bindBackdropDismiss(overlay) {
  let pressedOnBackdrop = false;
  overlay.addEventListener('pointerdown', (e) => {
    pressedOnBackdrop = e.target === overlay;
  });
  overlay.addEventListener('pointerup', (e) => {
    const close = pressedOnBackdrop && e.target === overlay;
    pressedOnBackdrop = false;
    if (close) overlay.remove();
  });
}

export function openModal(bodyEl, { width } = {}) {
  const overlay = el('div', { class: 'modal-overlay' });
  bindBackdropDismiss(overlay);
  const modal = el('div', { class: 'modal', style: width ? `width:${width};` : null });
  modal.append(bodyEl);
  overlay.append(modal);
  document.body.append(overlay);

  const onKey = (e) => {
    if (e.key !== 'Escape') return;
    overlay.remove();
  };
  window.addEventListener('keydown', onKey);
  const remove = overlay.remove.bind(overlay);
  overlay.remove = () => {
    window.removeEventListener('keydown', onKey);
    remove();
  };

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
