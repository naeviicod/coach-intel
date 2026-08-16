import { el } from '../../utils.js';

export const TOOLS = [
  { key: 'select', label: 'Select', shortcut: 'S', icon: 'M3.2 2.4l9.2 6.2-4.2.4 2.2 4.6-2.2 1-2.2-4.6-2.8 3.2z' },
  { key: 'pen', label: 'Draw', shortcut: 'D', icon: 'M3 13l.8-3.2L10.6 3l2.4 2.4-6.8 6.8L3 13z' },
  { key: 'arrow', label: 'Arrow', shortcut: 'A', icon: 'M3 13L13 3M13 3H8.2M13 3v4.8' },
  { key: 'line', label: 'Line', shortcut: 'L', icon: 'M3 13L13 3' },
  { key: 'rect', label: 'Rectangle', shortcut: 'R', icon: 'M3 3.6h10v8.8H3z' },
  { key: 'zone', label: 'Circle', shortcut: 'C', icon: 'M8 2.8a5.2 5.2 0 110 10.4 5.2 5.2 0 010-10.4z' },
  { key: 'text', label: 'Text', shortcut: 'T', icon: 'M3.2 4.2h9.6M8 4.2V13' },
  { key: 'erase', label: 'Erase', shortcut: 'E', icon: 'M4.2 9.4l4.8-4.8 3.2 3.2-4.8 4.8H4.2z' },
];

const KEYS = Object.fromEntries(TOOLS.map((t) => [t.shortcut, t.key]));

function glyph(d) {
  return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
}

export function toolRail({ getTool, setTool, onUndo, onRedo }) {
  const rail = el('div', { class: 'board-rail', role: 'toolbar', 'aria-label': 'Board tools' });

  function paint() {
    rail.querySelectorAll('[data-tool]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tool === getTool());
    });
  }

  for (const tool of TOOLS) {
    rail.append(
      el('button', {
        type: 'button',
        class: `board-rail-btn${getTool() === tool.key ? ' active' : ''}`,
        'data-tool': tool.key,
        title: `${tool.label} (${tool.shortcut})`,
        'aria-label': tool.label,
        html: glyph(tool.icon),
        onclick: () => {
          setTool(tool.key);
          paint();
        },
      })
    );
  }

  rail.append(el('div', { class: 'board-rail-gap' }));
  rail.append(
    el('button', {
      type: 'button',
      class: 'board-rail-btn',
      title: 'Undo (⌘Z)',
      'aria-label': 'Undo',
      html: glyph('M4 7.2H12a2.4 2.4 0 010 4.8H9M6.4 4.6L3.6 7.2 6.4 9.8'),
      onclick: onUndo,
    }),
    el('button', {
      type: 'button',
      class: 'board-rail-btn',
      title: 'Redo (⌘Y)',
      'aria-label': 'Redo',
      html: glyph('M12 7.2H4a2.4 2.4 0 000 4.8H7M9.6 4.6L12.4 7.2 9.6 9.8'),
      onclick: onRedo,
    })
  );

  return { rail, paint };
}

export function bindShortcuts(root, { setTool, getTool, undo, redo, deleteSelected, deselect, isTyping }) {
  const onKey = (e) => {
    if (isTyping()) return;
    const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    if ((e.metaKey || e.ctrlKey) && key === 'Z') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && (key === 'Y' || key === 'Z')) {
      e.preventDefault();
      redo();
      return;
    }
    if (key === 'Escape') {
      deselect();
      setTool('select');
      return;
    }
    if (key === 'Delete' || key === 'Backspace') {
      e.preventDefault();
      deleteSelected();
      return;
    }
    if (KEYS[key] && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      setTool(KEYS[key]);
    }
  };

  const onAux = (e) => {
    if (e.button === 1) {
      e.preventDefault();
      setTool(getTool() === 'pen' ? 'select' : 'pen');
    }
  };

  root.addEventListener('keydown', onKey);
  root.addEventListener('auxclick', onAux);
  root.tabIndex = 0;
  return () => {
    root.removeEventListener('keydown', onKey);
    root.removeEventListener('auxclick', onAux);
  };
}
