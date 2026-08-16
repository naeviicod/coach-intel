import { el, icon, fmtDate } from '../utils.js';
import { iconBtn } from './teamHub/parts.js';
import { openModal } from '../components/modal.js';
import { pageHeader, teamSelect, emptyState, openForm, toast } from './planningShared.js';
import { WEEKDAYS, MONTHS, monthMatrix, shiftMonth, bucketByDate, todayIso, isoDate } from '../lib/calendar.js';

const TYPE_META = {
  match: { label: 'League match', cls: 'match' },
  'league-match': { label: 'League match', cls: 'match' },
  scrim: { label: 'Scrim', cls: 'scrim' },
  'scrim-block': { label: 'Scrim', cls: 'scrim' },
  'vod-review': { label: 'VOD review', cls: 'vod' },
  meeting: { label: 'Meeting', cls: 'meeting' },
  training: { label: 'Training', cls: 'training' },
  practice: { label: 'Training', cls: 'training' },
  other: { label: 'Other', cls: 'other' },
};

const EVENT_TYPE_OPTIONS = [
  ['league-match', 'League match'],
  ['scrim', 'Scrim'],
  ['vod-review', 'VOD review'],
  ['meeting', 'Meeting'],
  ['training', 'Training'],
];

const LEGEND = [
  ['match', 'League match'],
  ['scrim', 'Scrim'],
  ['vod', 'VOD review'],
  ['meeting', 'Meeting'],
  ['training', 'Training'],
];

export async function render(container, ctx) {
  const teams = await window.cci.getTeams();
  if (!teams.length) {
    container.append(pageHeader('Calendar', 'Scrim blocks, match days and practice on one timeline'));
    container.append(emptyState('No teams yet', 'Create a team to plan practices, scrims and match days.'));
    return;
  }
  const active = teams.find((t) => t.id === ctx.param) || teams[0];
  const now = new Date();
  const state = { year: now.getFullYear(), month: now.getMonth() };
  const reload = () => {
    container.innerHTML = '';
    return draw(container, ctx, teams, active, state, reload);
  };
  await draw(container, ctx, teams, active, state, reload);
}

async function draw(container, ctx, teams, active, state, reload) {
  const [matches, scrims, events] = await Promise.all([
    window.cci.getMatches(active.id),
    window.cci.getScrims(active.id),
    window.cci.getEvents(active.id),
  ]);

  const items = [
    ...matches.map((m) => ({
      type: 'match',
      date: m.date,
      title: `Match vs ${m.opponent || 'Unknown'}`,
      sub: `${m.mode || ''}${m.map ? ` · ${m.map}` : ''}${m.result ? ` · ${m.result}` : ''}`,
      route: 'matches',
    })),
    ...scrims.map((s) => ({
      type: 'scrim',
      date: s.date,
      time: s.time,
      title: `Scrim vs ${s.opponent}`,
      sub: `${s.format} · ${s.status}`,
      route: 'scrim-hub',
      param: active.id,
    })),
    ...events.map((e) => ({
      type: e.type,
      date: e.date,
      time: e.time,
      title: e.title,
      sub: e.opponent || e.notes || '',
      event: e,
    })),
  ];
  const byDate = bucketByDate(items);

  container.append(
    pageHeader(
      'Calendar',
      `${active.name}: scrim blocks, match days and practice`,
      el('div', { style: 'display:flex;gap:10px;align-items:center;' }, [
        teamSelect(teams, active.id, (id) => ctx.navigate('calendar', id)),
        el('button', { class: 'btn primary', onclick: () => addEvent(active.id, todayIso(), reload) }, [
          el('span', { class: 'icon', style: 'display:inline-flex;vertical-align:-2px;margin-right:6px;', html: icon('plus', 13) }),
          'Add Event',
        ]),
      ])
    )
  );

  const shell = el('div', { class: 'cal-shell' });
  container.append(shell);
  renderCalendar(shell, ctx, active, state, byDate, reload);

  container.append(
    el(
      'div',
      { class: 'cal-legend' },
      LEGEND.map(([cls, label]) =>
        el('div', { style: 'display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-dim);' }, [
          el('span', { class: `cal-dot ${cls}` }),
          label,
        ])
      )
    )
  );

  // Upcoming list
  const upcoming = items
    .filter((i) => i.date >= todayIso())
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time || '').localeCompare(b.time || '')))
    .slice(0, 10);
  container.append(el('div', { class: 'section-title' }, 'Upcoming'));
  if (!upcoming.length) {
    container.append(el('div', { class: 'card' }, el('div', { class: 'field-hint', style: 'padding:6px;' }, 'Nothing scheduled ahead. Add an event or book a scrim.')));
  } else {
    const list = el('div', { class: 'card' });
    for (const item of upcoming) list.append(upcomingRow(item, ctx));
    container.append(list);
  }
}

function renderCalendar(shell, ctx, active, state, byDate, reload) {
  shell.innerHTML = '';
  const title = `${MONTHS[state.month]} ${state.year}`;
  shell.append(
    el('div', { class: 'cal-toolbar' }, [
      el('div', { class: 'cal-month-label' }, title),
      el('div', { style: 'display:flex;gap:6px;' }, [
        el('button', { class: 'btn sm subtle', 'aria-label': 'Previous month', onclick: () => nav(-1) }, '‹'),
        el('button', { class: 'btn sm subtle', onclick: () => { const d = new Date(); state.year = d.getFullYear(); state.month = d.getMonth(); renderCalendar(shell, ctx, active, state, byDate, reload); } }, 'Today'),
        el('button', { class: 'btn sm subtle', 'aria-label': 'Next month', onclick: () => nav(1) }, '›'),
      ]),
    ])
  );

  function nav(delta) {
    const next = shiftMonth(state.year, state.month, delta);
    state.year = next.year;
    state.month = next.month;
    renderCalendar(shell, ctx, active, state, byDate, reload);
  }

  // `.grid` is a known-working utility. Columns are also inline so the month
  // cannot collapse into a single stacked column if the sheet is stale.
  const board = el('div', {
    class: 'grid cal-board',
    style: 'display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:1px;',
  });
  for (const wd of WEEKDAYS) board.append(el('div', { class: 'cal-wd' }, wd));
  const today = todayIso();
  for (const week of monthMatrix(state.year, state.month)) {
    for (const day of week) {
      const dayItems = byDate[day.date] || [];
      const cell = el(
        'div',
        {
          class: `cal-day${day.inMonth ? '' : ' muted'}${day.date === today ? ' today' : ''}`,
          role: 'button',
          tabindex: '0',
          onclick: () => openDay(ctx, active, day.date, dayItems, reload),
          onkeydown: (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openDay(ctx, active, day.date, dayItems, reload);
            }
          },
        },
        [el('div', { class: 'cal-num' }, String(day.day))]
      );
      for (const item of dayItems.slice(0, 3)) {
        const meta = TYPE_META[item.type] || TYPE_META.other;
        cell.append(el('div', { class: `cal-chip ${meta.cls}`, title: item.title }, item.title));
      }
      if (dayItems.length > 3) cell.append(el('div', { class: 'cal-more' }, `+${dayItems.length - 3} more`));
      board.append(cell);
    }
  }
  shell.append(board);
}

function upcomingRow(item, ctx) {
  const meta = TYPE_META[item.type] || TYPE_META.other;
  return el(
    'div',
    {
      class: 'crow',
      role: 'button',
      tabindex: '0',
      onclick: () => item.route && ctx.navigate(item.route, item.param),
      onkeydown: (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && item.route) {
          e.preventDefault();
          ctx.navigate(item.route, item.param);
        }
      },
    },
    [
      el('span', { class: `cal-dot ${meta.cls}`, style: 'flex-shrink:0;' }),
      el('div', { class: 'crow-main' }, [
        el('div', { class: 'crow-title' }, item.title),
        el('div', { class: 'crow-sub' }, `${meta.label}${item.sub ? ` · ${item.sub}` : ''}`),
      ]),
      el('div', { class: 'crow-meta' }, `${fmtDate(item.date)}${item.time ? ` · ${item.time}` : ''}`),
    ]
  );
}

function openDay(ctx, active, date, dayItems, reload) {
  const body = el('div', {}, [el('h3', {}, fmtDate(date))]);
  if (!dayItems.length) {
    body.append(el('div', { class: 'field-hint', style: 'margin-bottom:8px;' }, 'Nothing scheduled on this day.'));
  }
  for (const item of dayItems) {
    const meta = TYPE_META[item.type] || TYPE_META.other;
    const row = el('div', { class: 'crow', style: 'cursor:default;' }, [
      el('span', { class: `cal-dot ${meta.cls}`, style: 'flex-shrink:0;' }),
      el('div', { class: 'crow-main' }, [
        el('div', { class: 'crow-title' }, item.title),
        el('div', { class: 'crow-sub' }, `${meta.label}${item.sub ? ` · ${item.sub}` : ''}`),
      ]),
    ]);
    if (item.event) {
      row.append(
        el('div', { class: 'crow-actions' }, [
          iconBtn('edit', 'Edit event', () => { overlay.remove(); addEvent(active.id, date, reload, item.event); }),
          iconBtn('trash', 'Delete event', async () => {
            await window.cci.deleteEvent(active.id, item.event.event_id);
            overlay.remove();
            reload();
          }),
        ])
      );
    } else if (item.route) {
      row.style.cursor = 'pointer';
      row.setAttribute('role', 'button');
      row.addEventListener('click', () => { overlay.remove(); ctx.navigate(item.route, item.param); });
    }
    body.append(row);
  }
  body.append(
    el('div', { class: 'modal-actions' }, [
      el('button', { class: 'btn subtle', onclick: () => overlay.remove() }, 'Close'),
      el('button', { class: 'btn primary', onclick: () => { overlay.remove(); addEvent(active.id, date, reload); } }, '+ Add Event'),
    ])
  );
  const overlay = openModal(body, { width: '440px' });
}

function addEvent(teamId, date, reload, event = null) {
  openForm({
    title: event ? 'Edit Event' : 'Add Event',
    fields: [
      { key: 'title', label: 'Title', required: true, placeholder: 'VOD review, training block…' },
      { key: 'type', label: 'Type', type: 'select', options: EVENT_TYPE_OPTIONS },
      [
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'time', label: 'Time', type: 'time' },
      ],
      { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Optional details' },
    ],
    values: event || { type: 'training', date },
    onSubmit: async (values) => {
      await window.cci.saveEvent(teamId, { ...(event || {}), ...values });
      toast(event ? 'Event updated' : 'Event added', 'ok');
      reload();
    },
  });
}
