import { el } from '../utils.js';

// Navigation lists the full planned product so the information architecture is
// stable, but a route with no data model behind it must say so rather than
// invent numbers. Every such route lands here.
export function comingSoon(title, blurb) {
  return {
    async render(container) {
      container.append(
        el('div', { class: 'page-header' }, [
          el('div', {}, [
            el('div', { class: 'page-title' }, title),
            el('div', { class: 'page-subtitle' }, 'Planned'),
          ]),
        ])
      );
      container.append(
        el('div', { class: 'card empty-state' }, [
          el('div', { class: 'title' }, `${title} is not built yet`),
          el('div', {}, blurb),
          el('div', { class: 'field-hint', style: 'margin-top:10px;' }, 'Nothing here is tracked yet, so no data is shown.'),
        ])
      );
    },
  };
}
