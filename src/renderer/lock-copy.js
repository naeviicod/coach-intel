// Runs before the splash is interactive. CSS user-select is not enough in
// Electron — Chromium still lets you drag an <img> out as a copyable file.
(function lockCopy() {
  const editable = (node) =>
    node && node.closest && node.closest('input, textarea, select, [contenteditable="true"]');

  document.addEventListener(
    'dragstart',
    (e) => {
      if (e.target && e.target.closest && e.target.closest('[draggable="true"]')) return;
      e.preventDefault();
    },
    true
  );

  document.addEventListener(
    'copy',
    (e) => {
      if (editable(e.target)) return;
      e.preventDefault();
    },
    true
  );

  document.addEventListener(
    'cut',
    (e) => {
      if (editable(e.target)) return;
      e.preventDefault();
    },
    true
  );

  document.addEventListener(
    'contextmenu',
    (e) => {
      if (editable(e.target)) return;
      if (e.target && (e.target.tagName === 'IMG' || (e.target.closest && e.target.closest('#splash')))) {
        e.preventDefault();
      }
    },
    true
  );
})();
