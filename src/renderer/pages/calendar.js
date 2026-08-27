import { el, icon, fmtDate } from '../utils.js';
import { iconBtn } from './teamHub/parts.js';
import { openModal } from '../components/modal.js';
import { pageHeader, openForm, toast } from './planningShared.js';
import {
  WEEKDAYS,
  MONTHS,
  monthMatrix,
  shiftMonth,
  bucketByDate,
  todayIso,
  parseMaps,
  formatMaps,
  chipClass,
  orgCalendarItems,
} from '../lib/calendar.js';

export const TYPE_META = {
  match: { label: 'League match', cls: 'match' },
  'league-match': { label: 'League match', cls: 'match' },
  scrim: { label: 'Scrim', cls: 'scrim' },
  'scrim-block': { label: 'Scrim', cls: 'scrim' },
  'vod-review': { label: 'VOD review', cls: 'vod' },
  meeting: { label: 'Meeting', cls: 'meeting' },
  training: { label: 'Training', cls: 'training' },
  practice: { label: 'Training', cls: 'training' },
  task: { label: 'Task', cls: 'task' },
  other: { label: 'Other', cls: 'other' },
};

export const EVENT_TYPE_OPTIONS = [
  ['league-match', 'League match'],
  ['scrim', 'Scrim'],
  ['vod-review', 'VOD review'],
  ['meeting', 'Meeting'],
  ['training', 'Training'],
];

export async function render(container, ctx) {
  const teams = await window.cci.getTeams();
  const filterId = teams.some((t) => t.id === ctx.param) ? ctx.param : null;
  const now = new Date();
  const state = { year: now.getFullYear(), month: now.getMonth() };
  const reload = () => {
    container.innerHTML = '';
    return draw(container, ctx, teams, filterId, state, reload);
  };
  await draw(container, ctx, teams, filterId, state, reload);
}

function orgTeamFilter(teams, activeId, onChange) {
  if (teams.length < 2) return null;
  return el(
    'select',
    { 'aria-label': 'Team', onchange: (e) => onChange(e.target.value || null) },
    [
      el('option', { value: '', selected: !activeId ? 'selected' : null }, 'All teams'),
      ...teams.map((t) => el('option', { value: t.id, selected: t.id === activeId ? 'selected' : null }, t.name)),
    ]
  );
}

async function draw(container, ctx, teams, filterId, state, reload) {
  const scoped = filterId ? teams.filter((t) => t.id === filterId) : teams;
  const [orgEvents, org, packs] = await Promise.all([
    window.cci.getEvents('').catch(() => []),
    window.cci.getOrg().catch(() => null),
    Promise.all(
      scoped.map(async (team) => {
        const [events, matches, tasks, scrims, members] = await Promise.all([
          window.cci.getEvents(team.id),
          window.cci.getMatches(team.id),
          window.cci.getTasks(team.id),
          window.cci.getScrims(team.id),
          window.cci.getMembers(team.id).catch(() => []),
        ]);
        return orgCalendarItems(team, { events, matches, tasks, scrims, members });
      })
    ),
  ]);
  const orgTeam = { id: '', name: org?.name || org?.tag || 'Org' };
  const items = [...orgCalendarItems(orgTeam, { events: orgEvents }), ...packs.flat()];
  const byDate = bucketByDate(items);

  container.append(
    pageHeader(
      'Calendar',
      'Org overview — matches, meetings, reviews and tasks for every team and staff seat',
      el('div', { style: 'display:flex;gap:10px;align-items:center;flex-wrap:wrap;' }, [
        orgTeamFilter(teams, filterId, (id) => ctx.navigate('calendar', id || undefined)),
        el(
          'button',
          {
            class: 'btn primary edit-only',
            onclick: () => addEvent(filterId || '', todayIso(), reload, null, teams),
          },
          [
            el('span', { class: 'icon', style: 'display:inline-flex;vertical-align:-2px;margin-right:6px;', html: icon('plus', 13) }),
            'Add Event',
          ]
        ),
      ])
    )
  );

  container.append(
    el('div', { class: 'cal-legend' }, [
      ['match', 'Match'],
      ['scrim', 'Scrim'],
      ['meeting', 'Meeting'],
      ['vod', 'VOD'],
      ['training', 'Training'],
      ['task', 'Task'],
    ].map(([cls, label]) =>
      el('span', { class: 'cal-legend-item' }, [
        el('span', { class: `cal-dot ${cls}` }),
        label,
      ])
    ))
  );

  const shell = el('div', { class: 'cal-shell' });
  container.append(shell);
  renderCalendar(shell, ctx, teams, filterId, state, byDate, reload);

  const upcoming = items
    .filter((i) => i.date >= todayIso())
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time || '').localeCompare(b.time || '')))
    .slice(0, 12);

  container.append(el('div', { class: 'section-title' }, 'Upcoming'));
  if (!upcoming.length) {
    container.append(
      el(
        'div',
        { class: 'card' },
        el(
          'div',
          { class: 'field-hint', style: 'padding:6px;' },
          'Nothing scheduled. Add a match, meeting, or task so staff and creatives can see it here.'
        )
      )
    );
  } else {
    const list = el('div', { class: 'card' });
    for (const item of upcoming) list.append(upcomingRow(item, ctx));
    container.append(list);
  }
}

function renderCalendar(shell, ctx, teams, filterId, state, byDate, reload) {
  shell.innerHTML = '';
  const title = `${MONTHS[state.month]} ${state.year}`;
  shell.append(
    el('div', { class: 'cal-toolbar' }, [
      el('div', { class: 'cal-month-label' }, title),
      el('div', { class: 'cal-nav' }, [
        el('button', {
          type: 'button',
          class: 'btn cal-nav-btn',
          'aria-label': 'Previous month',
          onclick: () => nav(-1),
          html: icon('chevronLeft', 14),
        }),
        el(
          'button',
          {
            type: 'button',
            class: 'btn sm',
            onclick: () => {
              const d = new Date();
              state.year = d.getFullYear();
              state.month = d.getMonth();
              renderCalendar(shell, ctx, teams, filterId, state, byDate, reload);
            },
          },
          'Today'
        ),
        el('button', {
          type: 'button',
          class: 'btn cal-nav-btn',
          'aria-label': 'Next month',
          onclick: () => nav(1),
          html: icon('chevronRight', 14),
        }),
      ]),
    ])
  );

  function nav(delta) {
    const next = shiftMonth(state.year, state.month, delta);
    state.year = next.year;
    state.month = next.month;
    renderCalendar(shell, ctx, teams, filterId, state, byDate, reload);
  }

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
          onclick: () => openDay(ctx, teams, filterId, day.date, dayItems, reload),
          onkeydown: (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openDay(ctx, teams, filterId, day.date, dayItems, reload);
            }
          },
        },
        [el('div', { class: 'cal-num' }, String(day.day))]
      );
      for (const item of dayItems.slice(0, 3)) {
        cell.append(el('div', { class: `cal-chip ${chipClass(item.type)}`, title: itemDetail(item) }, item.title));
      }
      if (dayItems.length > 3) cell.append(el('div', { class: 'cal-more' }, `+${dayItems.length - 3} more`));
      board.append(cell);
    }
  }
  shell.append(board);
}

function itemDetail(item) {
  return [item.teamName, item.title, item.people?.join(', '), formatMaps(item.maps), item.time]
    .filter(Boolean)
    .join(' · ');
}

function itemSub(item, { time = true } = {}) {
  const parts = [item.teamName];
  if (item.people?.length) parts.push(item.people.join(', '));
  if (item.maps?.length) parts.push(formatMaps(item.maps));
  if (time && item.time) parts.push(item.time);
  if (item.result) parts.push(item.result);
  return parts.filter(Boolean).join(' · ') || (TYPE_META[item.type]?.label || 'Event');
}

function upcomingRow(item, ctx) {
  const cls = chipClass(item.type);
  return el(
    'div',
    {
      class: 'crow',
      role: item.route ? 'button' : undefined,
      tabindex: item.route ? '0' : undefined,
      onclick: () => item.route && ctx.navigate(item.route, item.param),
      onkeydown: (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && item.route) {
          e.preventDefault();
          ctx.navigate(item.route, item.param);
        }
      },
    },
    [
      el('span', { class: `cal-dot ${cls}`, style: 'flex-shrink:0;' }),
      el('div', { class: 'crow-main' }, [
        el('div', { class: 'crow-title' }, item.title),
        el('div', { class: 'crow-sub' }, itemSub(item, { time: false })),
      ]),
      el('div', { class: 'crow-meta' }, `${fmtDate(item.date)}${item.time ? ` · ${item.time}` : ''}`),
    ]
  );
}

function openDay(ctx, teams, filterId, date, dayItems, reload) {
  const body = el('div', {}, [el('h3', {}, fmtDate(date))]);
  if (!dayItems.length) {
    body.append(el('div', { class: 'field-hint', style: 'margin-bottom:8px;' }, 'Nothing on this day yet.'));
  }
  for (const item of dayItems) {
    const cls = chipClass(item.type);
    const row = el('div', { class: 'crow', style: 'cursor:default;' }, [
      el('span', { class: `cal-dot ${cls}`, style: 'flex-shrink:0;' }),
      el('div', { class: 'crow-main' }, [
        el('div', { class: 'crow-title' }, item.title),
        el('div', { class: 'crow-sub' }, itemSub(item)),
      ]),
    ]);
    if (item.event) {
      row.append(
        el('div', { class: 'crow-actions edit-only' }, [
          iconBtn('edit', 'Edit', () => {
            overlay.remove();
            addEvent(item.teamId, date, reload, item.event, teams);
          }),
          iconBtn('trash', 'Delete', async () => {
            await window.cci.deleteEvent(item.teamId, item.event.event_id);
            overlay.remove();
            reload();
          }),
        ])
      );
    } else if (item.route) {
      row.style.cursor = 'pointer';
      row.setAttribute('role', 'button');
      row.addEventListener('click', () => {
        overlay.remove();
        ctx.navigate(item.route, item.param);
      });
    }
    body.append(row);
  }
  body.append(
    el('div', { class: 'modal-actions' }, [
      el('button', { class: 'btn', onclick: () => overlay.remove() }, 'Close'),
      el(
        'button',
        {
          class: 'btn primary edit-only',
          onclick: () => {
            overlay.remove();
            addEvent(filterId || '', date, reload, null, teams);
          },
        },
        '+ Add Event'
      ),
    ])
  );
  const overlay = openModal(body, { width: '460px' });
}

export async function addEvent(teamId, date, reload, event = null, teams = null) {
  let members = [];
  const rosterTeam = event?.team_id || teamId;
  try {
    if (!rosterTeam && teams?.length) {
      const packs = await Promise.all(teams.map((t) => window.cci.getMembers(t.id).catch(() => [])));
      members = packs.flat();
    } else if (rosterTeam) {
      members = await window.cci.getMembers(rosterTeam);
    }
  } catch (err) {
    console.error('[calendar] could not load roster for attendees', err);
  }

  const teamFields = teams?.length && !event
    ? [{
        key: 'team_id',
        label: 'Team',
        type: 'select',
        options: [['', 'Entire org'], ...teams.map((t) => [t.id, t.name])],
      }]
    : [];

  openForm({
    title: event ? 'Edit Event' : 'Add Event',
    fields: [
      ...teamFields,
      { key: 'title', label: 'Title', placeholder: 'VOD review, design sync, training block…' },
      { key: 'type', label: 'Type', type: 'select', options: EVENT_TYPE_OPTIONS },
      { key: 'opponent', label: 'Opponent', placeholder: 'League matches and scrims' },
      { key: 'maps', label: 'Maps', placeholder: 'Den, Raid, Scar', hint: 'League matches only — comma-separated' },
      [
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'time', label: 'Time', type: 'time' },
      ],
      members.length
        ? {
            key: 'attendees',
            label: 'Attendees',
            type: 'checks',
            options: members.map((m) => [m.id, m.gamertag]),
            hint: 'Who this is for — they show in the feed, and get named in the Discord post.',
          }
        : null,
      { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Optional details' },
      {
        key: 'notify_players',
        label: 'Notify players',
        type: 'checkbox',
        hint: 'Players see this in the bell. Map Discord #Schedule in Integrations to post it there too.',
      },
    ].filter(Boolean),
    values: event
      ? { ...event, maps: formatMaps(event.maps), attendees: event.attendee_ids || [], notify_players: false }
      : { type: 'meeting', date, team_id: teamId || '', notify_players: false },
    onSubmit: async (values) => {
      const id = event ? (event.team_id || '') : (values.team_id ?? teamId ?? '');
      const type = values.type || 'training';
      const opponent = values.opponent || '';
      const title =
        values.title ||
        (type === 'league-match' ? `vs ${opponent || 'TBD'}` : 'Event');
      const { attendees, team_id: _team, notify_players, ...rest } = values;
      await window.cci.saveEvent(id, {
        ...(event || {}),
        ...rest,
        type,
        title,
        opponent,
        maps: parseMaps(values.maps),
        attendee_ids: attendees || [],
        notify_players: Boolean(notify_players),
      });
      toast(
        notify_players
          ? (event ? 'Event updated — players notified' : 'Event added — players notified')
          : (event ? 'Event updated' : 'Event added'),
        'ok'
      );
      reload();
    },
  });
}
