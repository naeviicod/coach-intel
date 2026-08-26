import { el, icon } from '../utils.js';

export function orgRefreshBtn() {
  return el(
    'button',
    {
      type: 'button',
      class: 'btn refresh-btn',
      title: 'Pull the latest photos, roster, plans, and calendar from the org',
      'aria-label': 'Refresh org data',
      onclick: () => document.dispatchEvent(new CustomEvent('cci:org-refresh')),
    },
    [
      el('span', { class: 'icon refresh-icon', html: icon('refresh', 11) }),
      el('span', { class: 'refresh-label' }, 'Refresh'),
    ]
  );
}
