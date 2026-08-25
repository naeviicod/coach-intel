'use client';

import { useMemo, useState } from 'react';
import { MONTHS, WEEKDAYS, bucketByDate, monthMatrix, shiftMonth } from '../lib/calendar';

export function OrgCalendar({ items }) {
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const weeks = useMemo(() => monthMatrix(cursor.year, cursor.month), [cursor]);
  const byDay = useMemo(() => bucketByDate(items), [items]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="cal">
      <div className="cal-head">
        <button type="button" className="text-link" onClick={() => setCursor(shiftMonth(cursor.year, cursor.month, -1))}>
          Previous
        </button>
        <h2>
          {MONTHS[cursor.month]} {cursor.year}
        </h2>
        <button type="button" className="text-link" onClick={() => setCursor(shiftMonth(cursor.year, cursor.month, 1))}>
          Next
        </button>
      </div>
      <div className="cal-weekdays">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="cal-grid">
        {weeks.map((week, wi) =>
          week.map((cell) => {
            const dayItems = byDay[cell.date] || [];
            return (
              <div
                key={`${wi}-${cell.date}`}
                className={`cal-cell${cell.inMonth ? '' : ' muted'}${cell.date === today ? ' today' : ''}`}
              >
                <span className="cal-num">{cell.day}</span>
                {dayItems.slice(0, 3).map((item, i) => (
                  <span key={`${item.title}-${i}`} className={`cal-chip ${item.type}`}>
                    {item.title}
                  </span>
                ))}
                {dayItems.length > 3 ? <span className="cal-more">+{dayItems.length - 3}</span> : null}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
