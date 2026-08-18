import { el } from '../utils.js';

export async function render(container) {
  container.append(
    el('div', { class: 'page-header' }, [
      el('div', {}, [
        el('div', { class: 'page-title' }, ['Teach Coach Intel', el('span', { class: 'badge-soon' }, 'Phase 2')]),
        el('div', { class: 'page-subtitle' }, 'Calibrate stat-region templates for your scoreboard screenshots'),
      ]),
    ])
  );

  container.append(
    el('div', { class: 'card empty-state' }, [
      el('div', { class: 'icon' }, '✎'),
      el('div', { class: 'title' }, 'Template calibration comes next'),
      el(
        'div',
        { style: 'max-width:440px;margin:0 auto;line-height:1.6;' },
        'Drop everyday scoreboards on the Scoreboard Inbox — that is the inbox. This page is for teaching the reader: import one sample, draw boxes over each stat field, and Coach Intel reuses that template for the same board type.'
      ),
    ])
  );
}
