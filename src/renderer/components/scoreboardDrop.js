import { el, icon } from '../utils.js';

export function scoreboardDrop({ teamId, compact = false, onImported }) {
  const zone = el('div', {
    class: `sb-drop${compact ? ' compact' : ''}`,
    tabindex: '0',
    role: 'button',
    'aria-label': 'Drop scoreboard screenshots here',
  });

  const status = el('div', { class: 'sb-drop-status' });

  zone.append(
    el('div', { class: 'sb-drop-icon', html: icon('scoreboard', compact ? 22 : 28) }),
    el('div', { class: 'sb-drop-title' }, compact ? 'Drop scoreboards here' : 'Drop scoreboard screenshots here'),
    el(
      'div',
      { class: 'sb-drop-sub' },
      compact
        ? 'PNG or JPG. Drop a date folder or pick Scrim SBs — Coach Intel files them by date.'
        : 'PNG, JPG or WebP. Drop files, a date folder (14-08-2026), or the whole Scrim SBs folder. Coach Intel files them under the selected team by date. Nothing is uploaded.'
    ),
    el('div', { class: 'sb-drop-actions' }, [
      el('button', { type: 'button', class: 'btn primary', onclick: (e) => { e.stopPropagation(); browse(); } }, 'Choose images'),
      el('button', { type: 'button', class: 'btn subtle', onclick: (e) => { e.stopPropagation(); browseFolder(); } }, 'Import folder'),
    ]),
    status
  );

  async function ingest(payload) {
    if (!teamId) {
      status.textContent = 'Select a team first.';
      return;
    }
    const hasWork =
      (payload.paths && payload.paths.length) ||
      (payload.files && payload.files.length) ||
      (payload.folders && payload.folders.length);
    if (!hasWork) return;
    status.textContent = 'Saving…';
    try {
      const imported = await window.cci.importScoreboards(teamId, payload);
      status.textContent = imported.length
        ? `${imported.length} scoreboard${imported.length === 1 ? '' : 's'} added to the inbox`
        : 'No images were added.';
      onImported?.(imported);
    } catch (err) {
      status.textContent = String(err?.message || err);
    }
  }

  async function fromFileList(list) {
    const paths = [];
    const files = [];
    for (const file of list) {
      if (file.path) paths.push(file.path);
      else files.push({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
    }
    await ingest({ paths, files });
  }

  async function browse() {
    const paths = await window.cci.pickScoreboards();
    await ingest({ paths });
  }

  async function browseFolder() {
    const folder = await window.cci.pickScoreboardFolder();
    if (folder) await ingest({ folders: [folder] });
  }

  zone.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    browse();
  });
  zone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      browse();
    }
  });
  zone.addEventListener('dragenter', (e) => { e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('over');
    fromFileList(e.dataTransfer.files);
  });

  return zone;
}

export function scoreboardGrid(items, { onOpen, onRemove } = {}) {
  if (!items.length) return null;
  const grid = el('div', { class: 'sb-shot-grid' });
  for (const item of items) {
    const thumb = el('div', { class: 'sb-shot-thumb' });
    window.cci.dataUrlForPath(item.relative).then((url) => {
      if (url) thumb.append(el('img', { src: url, alt: item.filename }));
    });
    const card = el('div', { class: 'sb-shot' }, [
      thumb,
      el('div', { class: 'sb-shot-name' }, item.originalName || item.filename),
      el('div', { class: 'sb-shot-meta' }, [
        item.date ? `${fmtDateFolder(item.date)} · ` : '',
        item.bucket === 'inbox' ? 'Inbox · waiting to be read' : 'Needs review',
      ].join('')),
    ]);
    if (onOpen) {
      card.setAttribute('role', 'button');
      card.tabIndex = 0;
      card.addEventListener('click', () => onOpen(item));
    }
    if (onRemove) {
      card.append(
        el('button', {
          type: 'button',
          class: 'btn subtle sm sb-shot-remove',
          onclick: (e) => { e.stopPropagation(); onRemove(item); },
        }, 'Remove')
      );
    }
    grid.append(card);
  }
  return grid;
}

export function fmtDateFolder(iso) {
  const [y, m, d] = String(iso || '').split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (!y || !m || !d || !months[Number(m) - 1]) return iso;
  return `${Number(d)} ${months[Number(m) - 1]} ${y}`;
}
