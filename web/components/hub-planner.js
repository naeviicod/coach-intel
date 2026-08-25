'use client';

import { useState } from 'react';
import Link from 'next/link';
import { deleteDoc, newId, saveDoc } from '../lib/docs';
import { TYPE_META, todayIso } from '../lib/calendar';
import { fmtDate, fmtDue } from '../lib/marks';
import { HubHead, MiniEmpty, TaskRow } from './hub-parts';
import { Icon } from './icon';

export function HubPlanner({ team, events, tasks, matches, scrims, strats, canEdit, ctxToggle }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'training', date: todayIso(), time: '' });
  const today = todayIso();
  const items = [
    ...events.map((e) => ({ date: e.date, time: e.time, title: e.title, type: e.type, event: e })),
    ...scrims.map((s) => ({ date: s.date, time: s.time, title: `Scrim vs ${s.opponent || 'TBD'}`, type: 'scrim' })),
    ...matches.map((m) => ({ date: m.date, title: `Match vs ${m.opponent || 'Unknown'}`, type: 'league-match' })),
  ]
    .filter((i) => i.date && i.date >= today)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : String(a.time || '').localeCompare(String(b.time || ''))));
  const dated = tasks.filter((t) => t.due && !t.done).sort((a, b) => (a.due > b.due ? 1 : -1));
  const inPractice = strats.filter((s) => String(s.status || '').toUpperCase() === 'IN PRACTICE');

  async function add() {
    if (!canEdit || !form.title.trim()) return;
    const id = newId('event');
    await saveDoc({
      kind: 'event',
      teamId: team.id,
      id,
      payload: { event_id: id, team_id: team.id, title: form.title.trim(), type: form.type, date: form.date, time: form.time || null, notes: '' },
    });
    window.location.reload();
  }

  async function remove(event) {
    if (!canEdit) return;
    await deleteDoc({ kind: 'event', teamId: team.id, id: event.event_id || event.id });
    window.location.reload();
  }

  async function toggle(task) {
    if (!canEdit) return;
    const id = task.task_id || task.id;
    await saveDoc({ kind: 'task', teamId: team.id, id, payload: { ...task, done: !task.done } });
    window.location.reload();
  }

  return (
    <>
      <HubHead title="Planner" sub="Practice, league matches, VOD review and meetings for this team">
        {ctxToggle}
        {canEdit ? (
          <button type="button" className="btn primary sm edit-only" onClick={() => setOpen(true)}>
            <span className="icon" style={{ display: 'inline-flex', verticalAlign: -2, marginRight: 6 }}>
              <Icon name="plus" size={12} />
            </span>
            Add
          </button>
        ) : null}
      </HubHead>
      {open && canEdit ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="inline-fields">
            <input value={form.title} placeholder="Title" onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {['league-match', 'scrim', 'vod-review', 'meeting', 'training'].map((t) => (
                <option key={t} value={t}>{TYPE_META[t]?.label || t}</option>
              ))}
            </select>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            <button type="button" className="btn primary sm" onClick={add}>Save</button>
            <button type="button" className="btn subtle sm" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      ) : null}
      <div className="card compact" style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div className="card-title">Upcoming</div>
          <div className="card-meta">{items.length}</div>
        </div>
        {items.length === 0 ? (
          <MiniEmpty title="Nothing scheduled" body="Add a practice block, league match, VOD review or meeting to plan the team's week.">
            {canEdit ? <button type="button" className="btn primary sm edit-only" onClick={() => setOpen(true)}>+ Add</button> : null}
          </MiniEmpty>
        ) : (
          items.slice(0, 12).map((item, i) => {
            const meta = TYPE_META[item.type] || TYPE_META.other;
            return (
              <div key={`${item.title}-${item.date}-${i}`} className="crow">
                <span className={`cal-dot ${meta.cls}`} style={{ flexShrink: 0 }} />
                <div className="crow-main">
                  <div className="crow-title">{item.title}</div>
                  <div className="crow-sub">{`${meta.label}${item.time ? ` · ${item.time}` : ''}`}</div>
                </div>
                <div className="crow-meta">{fmtDate(item.date)}</div>
                {item.event && canEdit ? (
                  <div className="crow-actions">
                    <button type="button" className="icon-btn" aria-label="Delete event" onClick={() => remove(item.event)}>
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
      <div className="card compact" style={{ marginBottom: 14 }}>
        <div className="card-head"><div className="card-title">Dated work</div></div>
        {dated.length === 0 ? (
          <div className="field-hint" style={{ padding: '6px 2px' }}>No objectives have a target date.</div>
        ) : (
          dated.map((task) => {
            const due = fmtDue(task.due);
            return <TaskRow key={task.task_id || task.id} task={{ ...task, dueLabel: due.label, overdue: due.overdue }} canEdit={canEdit} onToggle={toggle} />;
          })
        )}
      </div>
      <div className="card compact">
        <div className="card-head">
          <div className="card-title">Strats in practice</div>
          <div className="card-meta">{inPractice.length}</div>
        </div>
        {inPractice.length === 0 ? (
          <div className="field-hint" style={{ padding: '6px 2px' }}>Set a strat to "IN PRACTICE" and it shows up here.</div>
        ) : (
          inPractice.map((strat) => (
            <Link key={strat.strategy_id || strat.id} href={`/playbooks?team=${encodeURIComponent(team.id)}`} className="crow">
              <div className="crow-main">
                <div className="crow-title">{strat.strategy_name}</div>
                <div className="crow-sub">{`${strat.map} · ${strat.mode}`}</div>
              </div>
            </Link>
          ))
        )}
      </div>
    </>
  );
}
