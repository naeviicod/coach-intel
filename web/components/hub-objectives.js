'use client';

import { useState } from 'react';
import { deleteDoc, newId, saveDoc } from '../lib/docs';
import { fmtDue } from '../lib/marks';
import { HubHead, MiniEmpty, TaskRow } from './hub-parts';

export function HubObjectives({ team, tasks, canEdit, ctxToggle }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [error, setError] = useState('');
  const active = tasks.filter((t) => !t.done);
  const complete = tasks.filter((t) => t.done);

  async function save() {
    if (!canEdit) return;
    if (!title.trim()) {
      setError('Describe the objective first.');
      return;
    }
    const id = newId('task');
    await saveDoc({
      kind: 'task',
      teamId: team.id,
      id,
      payload: { task_id: id, team_id: team.id, title: title.trim(), due: due || null, done: false, notes: '' },
    });
    window.location.reload();
  }

  async function toggle(task) {
    if (!canEdit) return;
    const id = task.task_id || task.id;
    await saveDoc({ kind: 'task', teamId: team.id, id, payload: { ...task, done: !task.done } });
    window.location.reload();
  }

  async function remove(task) {
    if (!canEdit) return;
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    await deleteDoc({ kind: 'task', teamId: team.id, id: task.task_id || task.id });
    window.location.reload();
  }

  return (
    <>
      <HubHead title="Objectives" sub={`What ${team.name} is working on`}>
        {canEdit ? (
          <button type="button" className="btn primary sm edit-only" onClick={() => setOpen(true)}>+ New Objective</button>
        ) : null}
        {ctxToggle}
      </HubHead>
      {open && canEdit ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <input type="text" value={title} placeholder="e.g. Cut first-blood deaths on Skyline Hardpoint" aria-label="Objective" onChange={(e) => setTitle(e.target.value)} />
            </div>
            <input type="date" value={due} aria-label="Target date" onChange={(e) => setDue(e.target.value)} />
            <button type="button" className="btn primary sm" onClick={save}>Add</button>
            <button type="button" className="btn subtle sm" onClick={() => setOpen(false)}>Cancel</button>
          </div>
          {error ? <div className="field-hint" style={{ color: 'var(--loss)' }}>{error}</div> : null}
        </div>
      ) : null}
      <div className="card compact" style={{ marginBottom: 14 }}>
        <div className="card-head"><div className="card-title">{`Open · ${active.length}`}</div></div>
        {active.length === 0 ? (
          <MiniEmpty title="No open objectives" body="Set a target the team can measure, like a map win rate or a specific habit to fix.">
            {canEdit ? <button type="button" className="btn primary sm edit-only" onClick={() => setOpen(true)}>+ New Objective</button> : null}
          </MiniEmpty>
        ) : (
          active.map((task) => {
            const dueInfo = fmtDue(task.due);
            return (
              <div key={task.task_id || task.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <TaskRow task={{ ...task, dueLabel: dueInfo.label, overdue: dueInfo.overdue }} canEdit={canEdit} onToggle={toggle} />
                </div>
                {canEdit ? <button type="button" className="btn subtle sm edit-only" onClick={() => remove(task)}>Delete</button> : null}
              </div>
            );
          })
        )}
      </div>
      <div className="card compact">
        <div className="card-head"><div className="card-title">{`Completed · ${complete.length}`}</div></div>
        {complete.length === 0 ? (
          <div className="field-hint" style={{ padding: '6px 2px' }}>Nothing completed yet.</div>
        ) : (
          complete.map((task) => {
            const dueInfo = fmtDue(task.due);
            return (
              <div key={task.task_id || task.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <TaskRow task={{ ...task, dueLabel: dueInfo.label, overdue: dueInfo.overdue }} canEdit={canEdit} onToggle={toggle} />
                </div>
                {canEdit ? <button type="button" className="btn subtle sm edit-only" onClick={() => remove(task)}>Delete</button> : null}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
