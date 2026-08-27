'use client';

import { useMemo, useState } from 'react';
import { newId, saveDoc } from '../lib/docs';
import { MONTHS, WEEKDAYS, bucketByDate, chipClass, monthMatrix, shiftMonth, todayIso } from '../lib/calendar';
import { fmtDate } from '../lib/marks';
import { Icon } from './icon';
import { PageHeader } from './page-header';
import { Err, Field, FormCard } from './workspace';

const LEGEND = [
  ['match', 'Match'],
  ['scrim', 'Scrim'],
  ['meeting', 'Meeting'],
  ['vod', 'VOD'],
  ['training', 'Training'],
  ['task', 'Task'],
];

const EVENT_TYPE_OPTIONS = [
  ['league-match', 'League match'],
  ['scrim', 'Scrim'],
  ['vod-review', 'VOD review'],
  ['meeting', 'Meeting'],
  ['training', 'Training'],
];

function emptyForm(date, teamId) {
  return {
    team_id: teamId || '',
    title: '',
    type: 'meeting',
    opponent: '',
    maps: '',
    date: date || todayIso(),
    time: '',
    notes: '',
    notify_players: false,
  };
}

export function OrgCalendar({ items, teams, canEdit }) {
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [filterId, setFilterId] = useState('');
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const weeks = useMemo(() => monthMatrix(cursor.year, cursor.month), [cursor]);
  const scoped = useMemo(
    () => (filterId ? items.filter((item) => !item.teamId || item.teamId === filterId || item.team_id === filterId) : items),
    [items, filterId]
  );
  const byDay = useMemo(() => bucketByDate(scoped), [scoped]);
  const today = todayIso();
  const upcoming = useMemo(
    () =>
      scoped
        .filter((i) => i.date >= today)
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time || '').localeCompare(b.time || '')))
        .slice(0, 12),
    [scoped, today]
  );

  function openAdd(date) {
    if (!canEdit) return;
    setError('');
    setDraft(emptyForm(date, filterId));
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      const id = newId('event');
      const type = draft.type || 'meeting';
      const title =
        draft.title.trim() ||
        (type === 'league-match' ? `vs ${draft.opponent || 'TBD'}` : 'Event');
      const teamId = draft.team_id || '';
      await saveDoc({
        kind: 'event',
        teamId,
        id,
        payload: {
          event_id: id,
          team_id: teamId,
          title,
          type,
          opponent: draft.opponent || '',
          maps: String(draft.maps || '').split(',').map((m) => m.trim()).filter(Boolean),
          date: draft.date,
          time: draft.time || null,
          notes: draft.notes || '',
        },
      });
      if (draft.notify_players) {
        const notifId = newId('notification');
        await saveDoc({
          kind: 'notification',
          teamId: teamId || 'org',
          id: notifId,
          payload: {
            id: notifId,
            team_id: teamId || 'org',
            event_id: type === 'league-match' || type === 'match'
              ? 'calendar.match_scheduled'
              : type === 'scrim' || type === 'scrim-block'
                ? 'calendar.scrim_scheduled'
                : 'calendar.training_scheduled',
            title,
            subtitle: [draft.date, draft.time].filter(Boolean).join(' · ') || null,
            route: teamId ? `calendar/${teamId}` : 'calendar',
            recipient_member_ids: [],
            created_at: new Date().toISOString(),
          },
        });
      }
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Could not add event.');
    }
  }

  const actions = (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      {teams?.length > 1 ? (
        <select aria-label="Team" value={filterId} onChange={(e) => setFilterId(e.target.value)}>
          <option value="">All teams</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>{team.name}</option>
          ))}
        </select>
      ) : null}
      {canEdit ? (
        <button type="button" className="btn primary" onClick={() => openAdd(today)}>
          <span className="icon" style={{ display: 'inline-flex', verticalAlign: '-2px', marginRight: 6 }}>
            <Icon name="plus" size={13} />
          </span>
          Add Event
        </button>
      ) : null}
    </div>
  );

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle="Org overview — matches, meetings, reviews and tasks for every team and staff seat"
        actions={actions}
      />
      {draft ? (
        <FormCard title="Add Event" onClose={() => setDraft(null)} actions={<button type="submit" form="add-event" className="btn primary">Save</button>}>
          <form id="add-event" onSubmit={save} className="inline-fields">
            {teams?.length ? (
              <Field label="Team">
                <select value={draft.team_id} onChange={(e) => setDraft({ ...draft, team_id: e.target.value })}>
                  <option value="">Entire org</option>
                  {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
              </Field>
            ) : null}
            <Field label="Title">
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="VOD review, design sync, training block…" />
            </Field>
            <Field label="Type">
              <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
                {EVENT_TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <Field label="Opponent">
              <input value={draft.opponent} onChange={(e) => setDraft({ ...draft, opponent: e.target.value })} placeholder="League matches and scrims" />
            </Field>
            <Field label="Maps">
              <input value={draft.maps} onChange={(e) => setDraft({ ...draft, maps: e.target.value })} placeholder="Den, Raid, Scar" />
            </Field>
            <Field label="Date">
              <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} required />
            </Field>
            <Field label="Time">
              <input type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} />
            </Field>
            <Field label="Notes">
              <input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Optional details" />
            </Field>
            <label className="check-row">
              <input
                type="checkbox"
                checked={Boolean(draft.notify_players)}
                onChange={(e) => setDraft({ ...draft, notify_players: e.target.checked })}
              />
              <span>Notify players</span>
            </label>
            <p className="field-hint" style={{ margin: '-4px 0 0', maxWidth: 520, lineHeight: 1.45 }}>
              Players see this in Coach Intel. Map Discord #Schedule under Integrations to post it there too.
            </p>
          </form>
          <Err error={error} />
        </FormCard>
      ) : null}
      <div className="cal-legend">
        {LEGEND.map(([cls, label]) => (
          <span key={cls} className="cal-legend-item">
            <span className={`cal-dot ${cls}`} />
            {label}
          </span>
        ))}
      </div>
      <div className="cal-shell">
        <div className="cal-toolbar">
          <div className="cal-month-label">
            {MONTHS[cursor.month]} {cursor.year}
          </div>
          <div className="cal-nav">
            <button type="button" className="btn cal-nav-btn" aria-label="Previous month" onClick={() => setCursor(shiftMonth(cursor.year, cursor.month, -1))}>
              <Icon name="chevronLeft" size={14} />
            </button>
            <button
              type="button"
              className="btn sm"
              onClick={() => {
                const d = new Date();
                setCursor({ year: d.getFullYear(), month: d.getMonth() });
              }}
            >
              Today
            </button>
            <button type="button" className="btn cal-nav-btn" aria-label="Next month" onClick={() => setCursor(shiftMonth(cursor.year, cursor.month, 1))}>
              <Icon name="chevronRight" size={14} />
            </button>
          </div>
        </div>
        <div className="grid cal-board" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 1 }}>
          {WEEKDAYS.map((day) => (
            <div key={day} className="cal-wd">{day}</div>
          ))}
          {weeks.map((week, wi) =>
            week.map((cell) => {
              const dayItems = byDay[cell.date] || [];
              return (
                <button
                  key={`${wi}-${cell.date}`}
                  type="button"
                  className={`cal-day${cell.inMonth ? '' : ' muted'}${cell.date === today ? ' today' : ''}`}
                  onClick={() => openAdd(cell.date)}
                >
                  <div className="cal-num">{cell.day}</div>
                  {dayItems.slice(0, 3).map((item, i) => (
                    <div key={`${item.title}-${i}`} className={`cal-chip ${chipClass(item.type)}`} title={item.title}>
                      {item.title}
                    </div>
                  ))}
                  {dayItems.length > 3 ? <div className="cal-more">+{dayItems.length - 3} more</div> : null}
                </button>
              );
            })
          )}
        </div>
      </div>
      <div className="section-title">Upcoming</div>
      {upcoming.length === 0 ? (
        <div className="card">
          <div className="field-hint" style={{ padding: 6 }}>
            Nothing scheduled. Add a match, meeting, or task so staff and creatives can see it here.
          </div>
        </div>
      ) : (
        <div className="card">
          {upcoming.map((item, i) => (
            <div key={`${item.date}-${item.title}-${i}`} className="crow">
              <div className={`cal-dot ${chipClass(item.type)}`} />
              <div className="crow-main">
                <div className="crow-title">{item.title}</div>
                <div className="crow-sub">
                  {[item.teamName, item.people?.join(', '), item.time].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div className="crow-meta">{fmtDate(item.date)}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
