'use client';

import { useState } from 'react';
import { newId, saveDoc, saveTeam, deleteMember, slugify } from '../lib/docs';
import { isProtectedPerson } from '../lib/access';
import { Err, Field, FormCard } from './workspace';

export function AddTeam({ canEdit }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', tag: '' });
  if (!canEdit) return null;
  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      await saveTeam({ id: slugify(form.name), name: form.name, tag: form.tag });
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Could not create team.');
    }
  }
  return (
    <>
      <div className="add-row">
        <button type="button" className="btn primary" onClick={() => setOpen(true)}>+ Add Team</button>
      </div>
      {open ? (
        <FormCard title="New team" onClose={() => setOpen(false)} actions={<button type="submit" form="add-team" className="btn primary">Save</button>}>
          <form id="add-team" onSubmit={save} className="inline-fields">
            <Field label="Name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
            <Field label="Tag"><input value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} /></Field>
          </form>
          <Err error={error} />
        </FormCard>
      ) : null}
    </>
  );
}

export { AddMember as AddPlayer, EditMember } from './member-edit';

export function RemoveMember({ member, canEdit }) {
  const [busy, setBusy] = useState(false);
  if (!canEdit || !member?.id) return null;
  if (isProtectedPerson(member)) return null;
  async function remove() {
    if (!window.confirm(`Remove ${member.gamertag || 'this player'} from the team?`)) return;
    setBusy(true);
    try {
      await deleteMember({ team_id: member.team_id, id: member.id });
      window.location.reload();
    } catch (err) {
      setBusy(false);
      window.alert(err.message || 'Could not remove member.');
    }
  }
  return (
    <button type="button" className="btn sm danger" disabled={busy} onClick={remove}>Remove</button>
  );
}

export function AddTask({ teams, canEdit }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', team_id: teams[0]?.id || '', due: '' });
  if (!canEdit || !teams.length) return null;
  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      const id = newId('task');
      await saveDoc({ kind: 'task', teamId: form.team_id, id, payload: { task_id: id, team_id: form.team_id, title: form.title, due: form.due || null, done: false, notes: '' } });
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Could not add task.');
    }
  }
  return (
    <>
      <button type="button" className="btn primary" onClick={() => setOpen(true)}>+ Add Task</button>
      {open ? (
        <FormCard title="New task" onClose={() => setOpen(false)} actions={<button type="submit" form="add-task" className="btn primary">Save</button>}>
          <form id="add-task" onSubmit={save} className="inline-fields">
            <Field label="Title"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></Field>
            <Field label="Team">
              <select value={form.team_id} onChange={(e) => setForm({ ...form, team_id: e.target.value })}>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Due"><input type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} /></Field>
          </form>
          <Err error={error} />
        </FormCard>
      ) : null}
    </>
  );
}

export { AddMatch } from './add-match';

export function AddEvent({ teams, canEdit }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ team_id: '', title: '', type: 'meeting', date: today, time: '' });
  if (!canEdit) return null;
  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      const id = newId('event');
      await saveDoc({
        kind: 'event',
        teamId: form.team_id || '',
        id,
        payload: { event_id: id, team_id: form.team_id || '', title: form.title, type: form.type, date: form.date, time: form.time || null, notes: '' },
      });
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Could not add event.');
    }
  }
  return (
    <>
      <button type="button" className="btn primary" onClick={() => setOpen(true)}>+ Add Event</button>
      {open ? (
        <FormCard title="Add event" onClose={() => setOpen(false)} actions={<button type="submit" form="add-event" className="btn primary">Save</button>}>
          <form id="add-event" onSubmit={save} className="inline-fields">
            <Field label="Title"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></Field>
            <Field label="Type">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {['league-match', 'scrim', 'meeting', 'vod-review', 'training'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Team">
              <select value={form.team_id} onChange={(e) => setForm({ ...form, team_id: e.target.value })}>
                <option value="">Entire org</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Date"><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></Field>
            <Field label="Time"><input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></Field>
          </form>
          <Err error={error} />
        </FormCard>
      ) : null}
    </>
  );
}

export function ToggleTask({ task, canEdit }) {
  if (!canEdit) return null;
  return (
    <button
      type="button"
      className="btn sm"
      onClick={async () => {
        const id = task.task_id || task.id;
        await saveDoc({ kind: 'task', teamId: task.team_id, id, payload: { ...task, done: !task.done } });
        window.location.reload();
      }}
    >
      {task.done ? 'Reopen' : 'Done'}
    </button>
  );
}
