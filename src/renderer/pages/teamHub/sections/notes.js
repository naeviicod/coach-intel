import { el, fmtStamp } from '../../../utils.js';
import { hubHead, miniEmpty, iconBtn } from '../parts.js';

const TAGS = ['General', 'Opponent', 'Practice', 'Review'];

export async function render(root, hub) {
  root.append(
    hubHead('Team Notes', `Shared notes for ${hub.team.name}`, [
      el('button', { class: 'btn primary edit-only', onclick: () => openComposer() }, '+ New Note'),
      hub.ctxToggle,
    ])
  );

  const composer = el('div', {});
  const list = el('div', {});
  root.append(composer, list);

  // The composer doubles as the editor: passing an existing note prefills it and
  // saving keeps the same note_id so history is not duplicated.
  function openComposer(note = null) {
    composer.innerHTML = '';
    const title = el('input', { type: 'text', value: note?.title || '', placeholder: 'Note title', 'aria-label': 'Note title' });
    const tag = el(
      'select',
      { 'aria-label': 'Note tag' },
      TAGS.map((t) => el('option', { value: t, selected: (note?.tag || 'General') === t ? 'selected' : null }, t))
    );
    const body = el('textarea', { rows: '6', placeholder: 'What did you learn?', 'aria-label': 'Note body' }, note?.body || '');
    const error = el('div', { class: 'field-hint', style: 'color:var(--loss);display:none;' }, 'Give the note a title.');

    composer.append(
      el('div', { class: 'card', style: 'margin-bottom:14px;' }, [
        el('div', { style: 'display:flex;gap:8px;margin-bottom:8px;' }, [
          el('div', { style: 'flex:1;' }, [title]),
          tag,
        ]),
        body,
        error,
        el('div', { style: 'display:flex;gap:8px;margin-top:10px;' }, [
          el('button', { class: 'btn primary sm', onclick: save }, note ? 'Save Changes' : 'Save Note'),
          el('button', { class: 'btn subtle sm', onclick: () => (composer.innerHTML = '') }, 'Cancel'),
        ]),
      ])
    );
    title.focus();

    async function save(ev) {
      const btn = ev?.currentTarget;
      if (btn?.disabled) return;
      if (!title.value.trim()) {
        error.style.display = '';
        title.focus();
        return;
      }
      if (btn) btn.disabled = true;
      try {
        await window.cci.saveNote(hub.team.id, {
          note_id: note?.note_id,
          title: title.value.trim(),
          body: body.value,
          tag: tag.value,
        });
        composer.innerHTML = '';
        await draw();
        hub.refreshRail?.();
      } catch (err) {
        if (btn) btn.disabled = false;
        error.textContent = err?.message || 'Could not save the note.';
        error.style.display = '';
      }
    }
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
            ]),
            el('div', { class: 'edit-only', style: 'display:flex;gap:4px;' }, [
              iconBtn('edit', `Edit ${note.title}`, () => openComposer(note)),
              iconBtn('trash', `Delete ${note.title}`, async () => {
                if (!confirm(`Delete "${note.title}"?`)) return;
                await window.cci.deleteNote(hub.team.id, note.note_id);
                await draw();
                hub.refreshRail?.();
              }),
            ]),
          ]),
          note.body ? el('div', { class: 'note-body' }, note.body) : null,
        ])
      );
    }
  }

  await draw();
  // `notes/new` is the deep link the overview card and rail use to jump
  // straight into writing.
  if (hub.sub[0] === 'new') openComposer();
}
