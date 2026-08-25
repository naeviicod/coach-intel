'use client';

import { useEffect, useState } from 'react';
import { newId, saveDoc, deleteDoc } from '../lib/docs';
import { fmtStamp } from '../lib/marks';
import { HubHead, MiniEmpty } from './hub-parts';

const TAGS = ['General', 'Opponent', 'Practice', 'Review'];

export function HubNotes({ team, notes, canEdit, author, ctxToggle, openId }) {
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (openId === 'new' && canEdit) {
      setDraft({ note_id: newId('note'), title: '', body: '', tag: 'General' });
    } else if (openId) {
      const note = notes.find((n) => (n.note_id || n.id) === openId);
      if (note) setDraft({ ...note, note_id: note.note_id || note.id });
    }
  }, [openId, notes, canEdit]);

  async function save() {
    if (!draft || !canEdit) return;
    setError('');
    try {
      const id = draft.note_id || newId('note');
      await saveDoc({
        kind: 'note',
        teamId: team.id,
        id,
        payload: {
          ...draft,
          note_id: id,
          team_id: team.id,
          title: draft.title.trim() || 'Untitled note',
          body: draft.body || '',
          tag: draft.tag || 'General',
          author: draft.author || author || 'Coach',
          updated_by: author || 'Coach',
        },
      });
      window.location.assign(`/team-hub/${encodeURIComponent(team.id)}/notes`);
    } catch (err) {
      setError(err.message || 'Could not save the note.');
    }
  }

  async function remove(note) {
    if (!canEdit) return;
    const id = note.note_id || note.id;
    if (!window.confirm(`Delete "${note.title}"?`)) return;
    await deleteDoc({ kind: 'note', teamId: team.id, id });
    window.location.reload();
  }

  return (
    <>
      <HubHead title="Team Notes" sub={`Shared notes for ${team.name}`}>
        {canEdit ? (
          <button type="button" className="btn primary edit-only" onClick={() => setDraft({ note_id: newId('note'), title: '', body: '', tag: 'General' })}>
            + New Note
          </button>
        ) : null}
        {ctxToggle}
      </HubHead>
      {draft ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <input type="text" value={draft.title} placeholder="Note title" aria-label="Note title" onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <div className="inline-fields" style={{ marginTop: 8 }}>
            <select aria-label="Note tag" value={draft.tag || 'General'} onChange={(e) => setDraft({ ...draft, tag: e.target.value })}>
              {TAGS.map((tag) => <option key={tag}>{tag}</option>)}
            </select>
          </div>
          <textarea rows={6} value={draft.body || ''} placeholder="What did you learn?" aria-label="Note body" style={{ marginTop: 8, width: '100%' }} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          {error ? <div className="field-hint" style={{ color: 'var(--loss)' }}>{error}</div> : null}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {canEdit ? <button type="button" className="btn primary sm" onClick={save}>Save</button> : null}
            <button type="button" className="btn subtle sm" onClick={() => setDraft(null)}>Cancel</button>
          </div>
        </div>
      ) : null}
      {notes.length === 0 && !draft ? (
        <div className="card">
          <MiniEmpty title="No notes yet" body="Capture practice focus, scrim takeaways and map issues so they survive the week." />
        </div>
      ) : (
        notes.map((note) => (
          <button key={note.note_id || note.id} type="button" className="note-row" onClick={() => setDraft({ ...note, note_id: note.note_id || note.id })}>
            <div className="note-title">{note.title}</div>
            <div className="note-meta">{`${note.tag || 'General'} · ${note.author || 'Coach'} · ${fmtStamp(note.updated_at)}`}</div>
            {canEdit ? (
              <span
                className="btn subtle sm"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(note);
                }}
              >
                Delete
              </span>
            ) : null}
          </button>
        ))
      )}
    </>
  );
}
