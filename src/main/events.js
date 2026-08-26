// Coach Intel domain events.
//
// Domain writes publish here and subscribers decide what to do with them, so no
// part of the data layer ever calls a notification provider directly. The Discord
// notification router is currently the only subscriber.
//
// A subscriber that throws must never break the write that produced the event, so
// failures are logged and swallowed.

const listeners = new Set();

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function reset() {
  listeners.clear();
}

async function emit(eventId, payload = {}) {
  const results = [];
  for (const listener of listeners) {
    try {
      results.push(await listener(eventId, payload));
    } catch (err) {
      console.warn(`[events] subscriber failed for ${eventId}:`, err.message);
    }
  }
  return results;
}

// ---------- Strats ----------

const STRAT_STATUS_EVENTS = {
  'READY FOR REVIEW': 'strategy.review_requested',
  APPROVED: 'strategy.approved',
  'MATCH READY': 'strategy.match_ready.updated',
};

/**
 * Which event a Strat save represents.
 *
 * A status change is the interesting signal. Edits to a Strat that is already
 * match-ready also matter, because the team is preparing against it. A brand-new
 * draft is not announced — that would notify on every empty Strat.
 */
function stratEventId(previous, next) {
  const status = String(next?.status || 'DRAFT').toUpperCase();
  const before = String(previous?.status || '').toUpperCase();

  if (status !== before && STRAT_STATUS_EVENTS[status]) return STRAT_STATUS_EVENTS[status];
  if (status === 'MATCH READY') return 'strategy.match_ready.updated';
  if (!previous) return null;
  return 'strategy.changed';
}

async function stratSaved({ previous, strat, team, actor }) {
  const eventId = stratEventId(previous, strat);
  if (!eventId) return null;

  const mapMode = [strat.map, strat.mode].filter(Boolean).join(' · ');
  await emit(eventId, {
    title: strat.strategy_name || 'Strat',
    subtitle: mapMode || null,
    mapMode: mapMode || null,
    summary: strat.notes || null,
    status: strat.status || 'DRAFT',
    team,
    actor,
    // Deep-links straight to this Strat's board.
    targetId: strat.strategy_id,
    // One notification per saved version: a retry of the same save is a duplicate,
    // a genuine new version is not.
    dedupeId: `${strat.strategy_id}:v${strat.versions?.length || 1}`,
  });
  return eventId;
}

/**
 * Saves a Strat and announces what the save means.
 *
 * The previous record has to be read before the write, otherwise the status
 * transition is lost and every save looks like a plain edit.
 */
async function saveStratAndAnnounce(store, teamId, strat) {
  const previous = strat.strategy_id ? await store.getStrat(teamId, strat.strategy_id) : null;
  const saved = await store.saveStrat(teamId, strat);
  const [team, org] = await Promise.all([store.getTeam(teamId), store.getOrg()]);
  await stratSaved({ previous, strat: saved, team, actor: org?.coachName || 'Coach' });
  return saved;
}

// ---------- CDL ruleset ----------

const CDL_CHANGE_LABELS = {
  added: 'added to',
  updated: 'updated in',
  modes: 'mode list changed in',
  deactivated: 'retired from',
  restored: 'restored to',
  removed: 'removed from',
};

// `stamp` keeps the notification idempotent per ruleset revision: a retry of the
// same edit is a duplicate, while a later edit to the same map is not.
async function cdlRulesetChanged({ change, mapName, mapId, detail, stamp, actor }) {
  const verb = CDL_CHANGE_LABELS[change] || 'changed in';
  await emit('cdl.ruleset_change_detected', {
    title: `${mapName || mapId} ${verb} the CDL ruleset`,
    summary: detail || null,
    actor,
    dedupeId: `cdl:${mapId}:${change}:${stamp || ''}`,
  });
  return 'cdl.ruleset_change_detected';
}

// ---------- Calendar events & scrims ----------
//
// A calendar event's `type` decides which Discord channel purpose it belongs
// to. Only creation is announced — editing an existing event/scrim would
// otherwise re-post on every small correction.

const CALENDAR_TYPE_EVENT = {
  scrim: 'calendar.scrim_scheduled',
  'scrim-block': 'calendar.scrim_scheduled',
  training: 'calendar.training_scheduled',
  practice: 'calendar.training_scheduled',
  meeting: 'calendar.training_scheduled',
  'vod-review': 'calendar.training_scheduled',
  'league-match': 'calendar.match_scheduled',
  match: 'calendar.match_scheduled',
};

function attendeeNamesFor(event, members) {
  const ids = Array.isArray(event.attendee_ids) ? event.attendee_ids : [];
  if (!ids.length || !Array.isArray(members)) return [];
  return ids.map((id) => members.find((m) => m.id === id)?.gamertag).filter(Boolean);
}

async function calendarEventSaved({ isNew, event, team, members, actor }) {
  if (!isNew) return null;
  const eventId = CALENDAR_TYPE_EVENT[event.type];
  if (!eventId) return null;

  const attendeeNames = attendeeNamesFor(event, members);

  await emit(eventId, {
    title: event.title || 'Event',
    subtitle: [event.date, event.time].filter(Boolean).join(' · ') || null,
    summary: event.notes || null,
    fields: attendeeNames.length ? [{ name: 'Attendees', value: attendeeNames.join(', ') }] : [],
    team,
    actor,
    targetId: event.event_id,
    dedupeId: event.event_id,
    recipientMemberIds: event.attendee_ids || [],
  });
  return eventId;
}

/**
 * Saves a calendar event and announces it if it's brand new.
 *
 * "New" has to be judged from the *incoming* payload, before the store fills
 * in a generated id — planningStore has no singular getEvent to diff against.
 */
async function saveEventAndAnnounce(store, teamId, event) {
  const isNew = !event.event_id;
  const saved = await store.saveEvent(teamId, event);
  const orgWide = !teamId;
  const [team, members] = await Promise.all([
    orgWide ? { id: '', name: 'Org' } : store.getTeam(teamId),
    orgWide ? [] : store.getMembers(teamId).catch(() => []),
  ]);
  await calendarEventSaved({ isNew, event: saved, team, members, actor: 'Coach' });
  return saved;
}

async function scrimSaved({ isNew, scrim, team, actor }) {
  if (!isNew) return null;
  await emit('calendar.scrim_scheduled', {
    title: `Scrim vs ${scrim.opponent || 'TBD'}`,
    subtitle: [scrim.date, scrim.time].filter(Boolean).join(' · ') || null,
    summary: scrim.format || null,
    team,
    actor,
    targetId: scrim.scrim_id,
    dedupeId: scrim.scrim_id,
  });
  return 'calendar.scrim_scheduled';
}

/**
 * Saves a scrim booking and announces it if it's brand new. Same
 * judge-newness-before-save approach as saveEventAndAnnounce.
 */
async function saveScrimAndAnnounce(store, teamId, scrim) {
  const isNew = !scrim.scrim_id;
  const saved = await store.saveScrim(teamId, scrim);
  const team = await store.getTeam(teamId);
  await scrimSaved({ isNew, scrim: saved, team, actor: 'Coach' });
  return saved;
}

module.exports = {
  subscribe,
  reset,
  emit,
  stratEventId,
  stratSaved,
  saveStratAndAnnounce,
  cdlRulesetChanged,
  saveEventAndAnnounce,
  saveScrimAndAnnounce,
};
