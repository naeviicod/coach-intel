import { el, fmtStamp } from '../../../utils.js';
import { chipIdentity } from '../../../lib/profile.js';
import { hubHead, miniEmpty, iconBtn } from '../parts.js';

const TAGS = ['General', 'Opponent', 'Practice', 'Review'];
let live = null;

export async function render(root, hub) {
  live?.controller.abort();
  const controller = new AbortController();
  live = { root, controller };

  root.append(
    hubHead('Team Notes', `Shared notes for ${hub.team.name}`, [
      el('button', { class: 'btn primary edit-only', onclick: () => openComposer() }, '+ New Note'),
      hub.ctxToggle,
    ])
  );

  const composer = el('div', {});
  const list = el('div', {});
  root.append(composer, list);
  let activeEditor = null;

  document.addEventListener('cci:remote-data-change', (event) => {
    if (event.detail?.table !== 'shared_docs' || !activeEditor?.dirty) return;
    // Realtime only tells us the table, not the record ID. Keep the active
    // draft stable first, then hydrate and compare this note asynchronously.
    event.preventDefault();
    void checkForRemoteRevision();
  }, { signal: controller.signal });

  async function checkForRemoteRevision() {
    if (!activeEditor?.dirty || !activeEditor.noteId || !root.isConnected) return;
    try {
      const notes = await window.cci.getNotes(hub.team.id);
      const remote = notes.find((item) => item.note_id === activeEditor.noteId);
      if (!remote || Number(remote.revision || 1) <= Number(activeEditor.note?.revision || 0)) return;
      activeEditor.remote = remote;
      showRemoteNotice(activeEditor);
    } catch (err) {
      console.error('[notes] remote revision check failed', err);
    }
  }

  function openComposer(note = null) {
    if (activeEditor?.timer) clearTimeout(activeEditor.timer);
    const identity = chipIdentity(hub.org, hub.access);
    const editor = {
      note: note ? { ...note } : null,
      noteId: note?.note_id || crypto.randomUUID(),
      attachments: [...(note?.attachments || [])],
      dirty: false,
      saving: false,
      remote: null,
      timer: 0,
      identity,
    };
    activeEditor = editor;
    composer.innerHTML = '';

    const title = el('input', { type: 'text', value: note?.title || '', placeholder: 'Note title', 'aria-label': 'Note title' });
    const tag = el(
      'select',
      { 'aria-label': 'Note tag' },
      TAGS.map((item) => el('option', { value: item, selected: (note?.tag || 'General') === item ? 'selected' : null }, item))
    );
    const body = el('textarea', { rows: '6', placeholder: 'What did you learn?', 'aria-label': 'Note body' }, note?.body || '');
    const status = el('div', { class: 'field-hint note-composer-status' }, note ? 'Changes save automatically.' : 'Start writing to create a shared note.');
    const error = el('div', { class: 'field-hint', style: 'color:var(--loss);display:none;' });
    const remoteNotice = el('div', { class: 'note-remote-notice', style: 'display:none;' });
    const attachments = el('div', { class: 'note-attachments', 'aria-live': 'polite' });

    editor.title = title;
    editor.tag = tag;
    editor.body = body;
    editor.status = status;
    editor.error = error;
    editor.remoteNotice = remoteNotice;
    editor.attachmentsNode = attachments;

    const markDirty = () => {
      editor.dirty = true;
      status.textContent = 'Saving changes…';
    };
    const debounceSave = () => {
      clearTimeout(editor.timer);
      if (!title.value.trim()) return;
      editor.timer = window.setTimeout(() => void persist({ quiet: true }), 900);
    };

    function paintAttachments() {
      attachments.replaceChildren(...editor.attachments.map((attachment) => attachmentCard(attachment, {
        onRemove: () => {
          editor.attachments = editor.attachments.filter((item) => item.id !== attachment.id);
          markDirty();
          paintAttachments();
          debounceSave();
        },
      })));
    }

    async function attachImage() {
      try {
        const sourcePath = await window.cci.pickImage();
        if (!sourcePath) return;
        const attachment = await window.cci.attachNoteImage(hub.team.id, editor.noteId, sourcePath);
        if (!attachment) return;
        editor.attachments.push(attachment);
        markDirty();
        paintAttachments();
        debounceSave();
      } catch (err) {
        error.textContent = err?.message || 'Could not attach the image.';
        error.style.display = '';
      }
    }

    async function persist({ quiet = false } = {}) {
      if (editor.saving || !title.value.trim()) return null;
      clearTimeout(editor.timer);
      editor.timer = 0;
      editor.saving = true;
      if (!quiet) status.textContent = 'Saving shared note…';
      error.style.display = 'none';
      try {
        const saved = await window.cci.saveNote(hub.team.id, {
          note_id: editor.noteId,
          title: title.value.trim(),
          body: body.value,
          tag: tag.value,
          attachments: editor.attachments,
          author: editor.identity.name,
          expected_revision: editor.note?.revision,
        });
        editor.note = saved;
        editor.noteId = saved.note_id;
        editor.attachments = [...(saved.attachments || [])];
        editor.dirty = false;
        editor.remote = null;
        remoteNotice.style.display = 'none';
        status.textContent = `Shared just now · v${saved.revision || 1}`;
        paintAttachments();
        await draw();
        hub.refreshRail?.();
        return saved;
      } catch (err) {
        if (err?.code === 'NOTE_CONFLICT') {
          await checkForRemoteRevision();
          error.textContent = 'A teammate saved a newer version. Reload it before saving your draft.';
        } else {
          error.textContent = err?.message || 'Could not save the note.';
        }
        error.style.display = '';
        return null;
      } finally {
        editor.saving = false;
      }
    }

    function reloadRemote() {
      const remote = editor.remote;
      if (!remote) return;
      editor.note = { ...remote };
      editor.noteId = remote.note_id;
      editor.attachments = [...(remote.attachments || [])];
      editor.dirty = false;
      editor.remote = null;
      title.value = remote.title || '';
      tag.value = remote.tag || 'General';
      body.value = remote.body || '';
      paintAttachments();
      remoteNotice.style.display = 'none';
      error.style.display = 'none';
      status.textContent = `Loaded ${remote.updated_by || remote.author || 'teammate'}’s v${remote.revision || 1}.`;
    }

    editor.reloadRemote = reloadRemote;

    for (const input of [title, body]) {
      input.addEventListener('input', () => {
        markDirty();
        debounceSave();
      });
    }
    tag.addEventListener('change', () => {
      markDirty();
      debounceSave();
    });

    composer.append(
      el('div', { class: 'card note-composer', style: 'margin-bottom:14px;' }, [
        el('div', { style: 'display:flex;gap:8px;margin-bottom:8px;' }, [
          el('div', { style: 'flex:1;' }, [title]),
          tag,
        ]),
        body,
        remoteNotice,
        attachments,
        error,
        el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:10px;' }, [
          el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;' }, [
            el('button', { class: 'btn primary sm', onclick: () => void persist() }, editor.note ? 'Save Changes' : 'Save Note'),
            el('button', { class: 'btn subtle sm', onclick: () => void attachImage() }, 'Attach image'),
            el('button', {
              class: 'btn subtle sm',
              onclick: () => {
                clearTimeout(editor.timer);
                if (activeEditor === editor) activeEditor = null;
                composer.innerHTML = '';
              },
            }, 'Cancel'),
          ]),
          status,
        ]),
      ])
    );
    paintAttachments();
    title.focus();
  }

  function showRemoteNotice(editor) {
    if (!editor.remoteNotice || !editor.remote) return;
    const who = editor.remote.updated_by || editor.remote.author || 'A teammate';
    editor.remoteNotice.replaceChildren(
      el('span', {}, `${who} saved v${editor.remote.revision || 1} while you were editing.`),
      el('button', { class: 'btn subtle sm', onclick: () => editor.reloadRemote?.() }, 'Reload newer version')
    );
    editor.remoteNotice.style.display = '';
  }

  function attachmentCard(attachment, { onRemove = null } = {}) {
    const preview = el('div', { class: 'note-attachment-preview' }, attachment.name);
    window.cci.dataUrlForPath(attachment.path).then((url) => {
      if (!url || !preview.isConnected) return;
      preview.replaceChildren(el('img', { src: url, alt: attachment.name }));
    }).catch(() => {});
    return el('div', { class: 'note-attachment' }, [
      preview,
      el('div', { class: 'note-attachment-name', title: attachment.name }, attachment.name),
      onRemove ? el('button', { class: 'icon-btn note-attachment-remove', title: `Remove ${attachment.name}`, 'aria-label': `Remove ${attachment.name}`, onclick: onRemove }, '×') : null,
    ]);
  }

  async function draw() {
    list.innerHTML = '';
    const notes = await window.cci.getNotes(hub.team.id);
    if (!notes.length) {
      list.append(
        el('div', { class: 'card' }, [
          miniEmpty(
            'No notes yet',
            'Scrim takeaways, opponent tendencies and coaching reminders live here, scoped to this team.',
            el('button', { class: 'btn primary sm edit-only', onclick: () => openComposer() }, '+ New Note')
          ),
        ])
      );
      return;
    }

    for (const note of notes) {
      list.append(
        el('div', { class: 'card note-card' }, [
          el('div', { class: 'note-head' }, [
            el('div', {}, [
              el('div', { class: 'note-title' }, note.title),
              el('div', { class: 'note-meta' }, `${note.tag || 'General'} · ${fmtStamp(note.updated_at)}`),
              el('div', { class: 'note-byline' }, `Updated by ${note.updated_by || note.author || 'Coach'} · v${note.revision || 1}`),
            ]),
            el('div', { class: 'edit-only', style: 'display:flex;gap:4px;' }, [
              iconBtn('edit', `Edit ${note.title}`, () => openComposer(note)),
              iconBtn('trash', `Delete ${note.title}`, async () => {
                if (!confirm(`Delete "${note.title}"?`)) return;
                await window.cci.deleteNote(hub.team.id, note.note_id);
                if (activeEditor?.noteId === note.note_id) {
                  clearTimeout(activeEditor.timer);
                  activeEditor = null;
                  composer.innerHTML = '';
                }
                await draw();
                hub.refreshRail?.();
              }),
            ]),
          ]),
          note.body ? el('div', { class: 'note-body' }, note.body) : null,
          note.attachments?.length ? el('div', { class: 'note-attachments note-attachments-readonly' }, note.attachments.map((attachment) => attachmentCard(attachment))) : null,
        ])
      );
    }
  }

  await draw();
  // `notes/new` is the deep link the overview card and rail use to jump
  // straight into writing.
  if (hub.sub[0] === 'new') openComposer();
}
