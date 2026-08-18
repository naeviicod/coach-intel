import { el, icon, fmtDate } from '../utils.js';
import { iconBtn } from './teamHub/parts.js';
import { openModal } from '../components/modal.js';
import { pageHeader, emptyState, openForm, toast } from './planningShared.js';
import {
  WEEKDAYS,
  MONTHS,
  monthMatrix,
  shiftMonth,
  bucketByDate,
  todayIso,
  parseMaps,
  formatMaps,
  leagueItemsForTeam,
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
  if (!teams.length) {
    container.append(pageHeader('Calendar', 'League matches across every team in the org'));
    container.append(emptyState('No teams yet', 'Create a team, then schedule a league match to put it on the org calendar.'));
    return;
  }
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
  const packs = await Promise.all(
    scoped.map(async (team) => {
      const [events, matches] = await Promise.all([
        window.cci.getEvents(team.id),
        window.cci.getMatches(team.id),
      ]);
      return leagueItemsForTeam(team, { events, matches });
    })
  );
  const items = packs.flat();
  const byDate = bucketByDate(items);
  const many = teams.length > 1;

  container.append(
    pageHeader(
      'Calendar',
      many
        ? 'League matches for every team — opponent, maps, date and time'
        : `${teams[0].name}: league matches — opponent, maps, date and time`,
      el('div', { style: 'display:flex;gap:10px;align-items:center;' }, [
        orgTeamFilter(teams, filterId, (id) => ctx.navigate('calendar', id || undefined)),
        el(
          'button',
          {
            class: 'btn primary edit-only',
            onclick: () => addLeagueMatch(teams, filterId || teams[0].id, todayIso(), reload),
          },
          [
            el('span', { class: 'icon', style: 'display:inline-flex;vertical-align:-2px;margin-right:6px;', html: icon('plus', 13) }),
            'Add League Match',
          ]
        ),
      ])
    )
  );

  const shell = el('div', { class: 'cal-shell' });
  container.append(shell);
  renderCalendar(shell, ctx, teams, filterId, state, byDate, reload);

  const upcoming = items
    .filter((i) => i.date >= todayIso())
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time || '').localeCompare(b.time || '')))
    .slice(0, 12);
  container.append(el('div', { class: 'section-title' }, 'Upcoming league matches'));
  if (!upcoming.length) {
    container.append(
      el(
        'div',
        { class: 'card' },
        el(
          'div',
          { class: 'field-hint', style: 'padding:6px;' },
          'No league matches scheduled. Add one from a team planner or with Add League Match.'
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
      el('div', { style: 'display:flex;gap:6px;' }, [
        el('button', { class: 'btn sm subtle', 'aria-label': 'Previous month', onclick: () => nav(-1) }, '‹'),
        el(
          'button',
          {
            class: 'btn sm subtle',
            onclick: () => {
              const d = new Date();
              state.year = d.getFullYear();
              state.month = d.getMonth();
              renderCalendar(shell, ctx, teams, filterId, state, byDate, reload);
            },
          },
          'Today'
        ),
        el('button', { class: 'btn sm subtle', 'aria-label': 'Next month', onclick: () => nav(1) }, '›'),
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
        cell.append(el('div', { class: 'cal-chip match', title: itemDetail(item) }, item.title));
      }
      if (dayItems.length > 3) cell.append(el('div', { class: 'cal-more' }, `+${dayItems.length - 3} more`));
      board.append(cell);
    }
  }
  shell.append(board);
}

function itemDetail(item) {
  return [item.title, formatMaps(item.maps), item.time, item.result].filter(Boolean).join(' · ');
}

function seriesDetail(item, { time = true } = {}) {
  const parts = [formatMaps(item.maps)];
  if (time && item.time) parts.push(item.time);
  if (item.result) parts.push(item.result);
  return parts.filter(Boolean).join(' · ') || 'League match';
}

function upcomingRow(item, ctx) {
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
      el('span', { class: 'cal-dot match', style: 'flex-shrink:0;' }),
      el('div', { class: 'crow-main' }, [
        el('div', { class: 'crow-title' }, `${item.teamName} vs ${item.opponent || 'TBD'}`),
        el('div', { class: 'crow-sub' }, seriesDetail(item, { time: false })),
      ]),
      el('div', { class: 'crow-meta' }, `${fmtDate(item.date)}${item.time ? ` · ${item.time}` : ''}`),
    ]
  );
}

function openDay(ctx, teams, filterId, date, dayItems, reload) {
  const body = el('div', {}, [el('h3', {}, fmtDate(date))]);
  if (!dayItems.length) {
    body.append(el('div', { class: 'field-hint', style: 'margin-bottom:8px;' }, 'No league matches on this day.'));
  }
  for (const item of dayItems) {
    const row = el('div', { class: 'crow', style: 'cursor:default;' }, [
      el('span', { class: 'cal-dot match', style: 'flex-shrink:0;' }),
      el('div', { class: 'crow-main' }, [
        el('div', { class: 'crow-title' }, `${item.teamName} vs ${item.opponent || 'TBD'}`),
        el('div', { class: 'crow-sub' }, seriesDetail(item)),
      ]),
    ]);
    if (item.event) {
      row.append(
        el('div', { class: 'crow-actions edit-only' }, [
          iconBtn('edit', 'Edit match', () => {
            overlay.remove();
            addLeagueMatch(teams, item.teamId, date, reload, item.event);
          }),
          iconBtn('trash', 'Delete match', async () => {
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
      el('button', { class: 'btn subtle', onclick: () => overlay.remove() }, 'Close'),
      el(
        'button',
        {
          class: 'btn primary edit-only',
          onclick: () => {
            overlay.remove();
            addLeagueMatch(teams, filterId || teams[0].id, date, reload);
          },
        },
        '+ Add League Match'
      ),
    ])
  );
  const overlay = openModal(body, { width: '460px' });
}

function addLeagueMatch(teams, teamId, date, reload, event = null) {
  const fields = [];
  if (teams.length > 1 && !event) {
    fields.push({
      key: 'team_id',
      label: 'Team',
      type: 'select',
      options: teams.map((t) => [t.id, t.name]),
    });
  }
  fields.push(
    { key: 'opponent', label: 'Opponent', required: true, placeholder: 'Opposing team' },
    [
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'time', label: 'Time', type: 'time' },
    ],
    { key: 'maps', label: 'Maps', placeholder: 'Den, Raid, Scar', hint: 'Comma-separated map names for the series' },
    { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Optional details' }
  );
  openForm({
    title: event ? 'Edit League Match' : 'Add League Match',
    fields,
    values: event
      ? { ...event, maps: formatMaps(event.maps) }
      : { team_id: teamId, type: 'league-match', date },
    onSubmit: async (values) => {
      const id = event?.team_id || values.team_id || teamId;
      const opponent = values.opponent || '';
      await window.cci.saveEvent(id, {
        ...(event || {}),
        type: 'league-match',
        title: `vs ${opponent || 'TBD'}`,
        opponent,
        maps: parseMaps(values.maps),
        date: values.date,
        time: values.time,
        notes: values.notes,
      });
      toast(event ? 'League match updated' : 'League match added', 'ok');
      reload();
    },
  });
}

export async function addEvent(teamId, date, reload, event = null) {
  let members = [];
  try {
    members = await window.cci.getMembers(teamId);
  } catch (err) {
    console.error('[calendar] could not load roster for attendees', err);
  }

  openForm({
    title: event ? 'Edit Event' : 'Add Event',
    fields: [
      { key: 'title', label: 'Title', placeholder: 'VOD review, training block…' },
      { key: 'type', label: 'Type', type: 'select', options: EVENT_TYPE_OPTIONS },
      { key: 'opponent', label: 'Opponent', placeholder: 'Required for league matches' },
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
            hint: 'Who this is for — they show up in the app notification feed, and get named in the Discord post for this event\'s channel.',
          }
        : null,
      { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Optional details' },
    ].filter(Boolean),
    values: event
      ? { ...event, maps: formatMaps(event.maps), attendees: event.attendee_ids || [] }
      : { type: 'training', date },
    onSubmit: async (values) => {
      const type = values.type || 'training';
      const opponent = values.opponent || '';
      const title =
        values.title ||
        (type === 'league-match' ? `vs ${opponent || 'TBD'}` : 'Training');
      const { attendees, ...rest } = values;
      await window.cci.saveEvent(teamId, {
        ...(event || {}),
        ...rest,
        type,
        title,
        opponent,
        maps: parseMaps(values.maps),
        attendee_ids: attendees || [],
      });
      toast(event ? 'Event updated' : 'Event added', 'ok');
      reload();
    },
  });
}
