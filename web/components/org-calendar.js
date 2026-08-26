'use client';

import { useMemo, useState } from 'react';
import { MONTHS, WEEKDAYS, bucketByDate, chipClass, monthMatrix, shiftMonth, todayIso } from '../lib/calendar';
import { fmtDate } from '../lib/marks';
import { Icon } from './icon';

const LEGEND = [
  ['match', 'Match'],
  ['scrim', 'Scrim'],
  ['meeting', 'Meeting'],
  ['vod', 'VOD'],
  ['training', 'Training'],
  ['task', 'Task'],
];

export function OrgCalendar({ items, teams }) {
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [filterId, setFilterId] = useState('');
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

  return (
    <>
      <div className="cal-legend">
        {LEGEND.map(([cls, label]) => (
          <span key={cls} className="cal-legend-item">
            <span className={`cal-dot ${cls}`} />
            {label}
          </span>
        ))}
      </div>
      {teams?.length > 1 ? (
        <div style={{ marginBottom: 12 }}>
          <select
            aria-label="Team"
            value={filterId}
            onChange={(e) => setFilterId(e.target.value)}
          >
            <option value="">All teams</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="cal-shell">
        <div className="cal-toolbar">
          <div className="cal-month-label">
            {MONTHS[cursor.month]} {cursor.year}
          </div>
          <div className="cal-nav">
            <button
              type="button"
              className="btn cal-nav-btn"
              aria-label="Previous month"
              onClick={() => setCursor(shiftMonth(cursor.year, cursor.month, -1))}
            >
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
            <button
              type="button"
              className="btn cal-nav-btn"
              aria-label="Next month"
              onClick={() => setCursor(shiftMonth(cursor.year, cursor.month, 1))}
            >
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
                <div
                  key={`${wi}-${cell.date}`}
                  className={`cal-day${cell.inMonth ? '' : ' muted'}${cell.date === today ? ' today' : ''}`}
                >
                  <div className="cal-num">{cell.day}</div>
                  {dayItems.slice(0, 3).map((item, i) => (
                    <div key={`${item.title}-${i}`} className={`cal-chip ${chipClass(item.type)}`} title={item.title}>
                      {item.title}
                    </div>
                  ))}
                  {dayItems.length > 3 ? <div className="cal-more">+{dayItems.length - 3} more</div> : null}
                </div>
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
