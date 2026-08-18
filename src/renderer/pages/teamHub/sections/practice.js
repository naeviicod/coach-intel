import { el, icon, fmtDue, fmtDate } from '../../../utils.js';
import { hubHead, miniEmpty, taskRow, iconBtn } from '../parts.js';
import { addEvent, TYPE_META } from '../../calendar.js';
import { todayIso } from '../../../lib/calendar.js';

// The team's planner: any date-bearing thing this team has (practice/training
// blocks, league matches, VOD review, meetings, plus read-only scrims and
// logged matches) in one upcoming list. Adding here writes the same event
// record the global Calendar page reads, so the two never disagree.
export async function render(root, hub) {
  const [tasks, strats, events, matches, scrims] = await Promise.all([
    window.cci.getTasks(hub.team.id),
    window.cci.getStrats(hub.team.id),
    window.cci.getEvents(hub.team.id),
    window.cci.getMatches(hub.team.id),
    window.cci.getScrims(hub.team.id),
  ]);

  const reload = () => hub.go('practice');

  root.append(
    hubHead('Planner', 'Practice, league matches, VOD review and meetings for this team', [
      hub.ctxToggle,
      el(
        'button',
        { class: 'btn primary sm edit-only', onclick: () => addEvent(hub.team.id, todayIso(), reload) },
        [
          el('span', { class: 'icon', style: 'display:inline-flex;vertical-align:-2px;margin-right:6px;', html: icon('plus', 12) }),
          'Add',
        ]
      ),
    ])
  );

  const today = todayIso();
  const items = [
    ...events.map((e) => ({ date: e.date, time: e.time, title: e.title, type: e.type, event: e })),
    ...scrims.map((s) => ({ date: s.date, time: s.time, title: `Scrim vs ${s.opponent || 'TBD'}`, type: 'scrim' })),
    ...matches.map((m) => ({ date: m.date, title: `Match vs ${m.opponent || 'Unknown'}`, type: 'league-match' })),
  ]
    .filter((i) => i.date >= today)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time || '').localeCompare(b.time || '')));

  const upcoming = el('div', { class: 'card compact', style: 'margin-bottom:14px;' }, [
    el('div', { class: 'card-head' }, [el('div', { class: 'card-title' }, 'Upcoming'), el('div', { class: 'card-meta' }, `${items.length}`)]),
  ]);
  if (!items.length) {
    upcoming.append(
      miniEmpty(
        'Nothing scheduled',
        'Add a practice block, league match, VOD review or meeting to plan the team\'s week.',
        el('button', { class: 'btn primary sm edit-only', onclick: () => addEvent(hub.team.id, today, reload) }, '+ Add')
      )
    );
  } else {
    for (const item of items.slice(0, 12)) {
      const meta = TYPE_META[item.type] || TYPE_META.other;
      const row = el('div', { class: 'crow' }, [
        el('span', { class: `cal-dot ${meta.cls}`, style: 'flex-shrink:0;' }),
        el('div', { class: 'crow-main' }, [
          el('div', { class: 'crow-title' }, item.title),
          el('div', { class: 'crow-sub' }, `${meta.label}${item.time ? ` · ${item.time}` : ''}`),
        ]),
        el('div', { class: 'crow-meta' }, fmtDate(item.date)),
      ]);
      if (item.event) {
        row.append(
          el('div', { class: 'crow-actions' }, [
            iconBtn('edit', 'Edit event', () => addEvent(hub.team.id, item.date, reload, item.event)),
            iconBtn('trash', 'Delete event', async () => {
              await window.cci.deleteEvent(hub.team.id, item.event.event_id);
              reload();
            }),
          ])
        );
      }
      upcoming.append(row);
    }
  }
  root.append(upcoming);

  const dated = tasks.filter((t) => t.due && !t.done).sort((a, b) => (a.due > b.due ? 1 : -1));
  const datedCard = el('div', { class: 'card compact', style: 'margin-bottom:14px;' }, [
    el('div', { class: 'card-head' }, [el('div', { class: 'card-title' }, 'Dated work')]),
  ]);
  if (!dated.length) {
    datedCard.append(el('div', { class: 'field-hint', style: 'padding:6px 2px;' }, 'No objectives have a target date.'));
  } else {
    for (const task of dated) {
      const row = taskRow(task, {
        onToggle: async (t) => {
          await window.cci.saveTask(hub.team.id, { task_id: t.task_id, done: !t.done });
          reload();
        },
      });
      if (fmtDue(task.due).overdue) row.classList.add('overdue');
      datedCard.append(row);
    }
  }
  root.append(datedCard);

  const inPractice = strats.filter((s) => String(s.status || '').toUpperCase() === 'IN PRACTICE');
  const card = el('div', { class: 'card compact' }, [
    el('div', { class: 'card-head' }, [
      el('div', { class: 'card-title' }, 'Strats in practice'),
      el('div', { class: 'card-meta' }, `${inPractice.length}`),
    ]),
  ]);
  if (!inPractice.length) {
    card.append(
      el('div', { class: 'field-hint', style: 'padding:6px 2px;' }, 'Set a strat to "IN PRACTICE" and it shows up here.')
    );
  } else {
    for (const strat of inPractice) {
      card.append(
        el(
          'div',
          {
            class: 'crow',
            role: 'button',
            tabindex: '0',
            onclick: () => hub.openPlaybooks('edit', strat.strategy_id),
            onkeydown: (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                hub.openPlaybooks('edit', strat.strategy_id);
              }
            },
          },
          [
            el('div', { class: 'crow-main' }, [
              el('div', { class: 'crow-title' }, strat.strategy_name),
              el('div', { class: 'crow-sub' }, [el('span', {}, `${strat.map} · ${strat.mode}`)]),
            ]),
          ]
        )
      );
    }
  }
  root.append(card);
}
