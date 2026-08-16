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

module.exports = {
  subscribe,
  reset,
  emit,
  stratEventId,
  stratSaved,
  saveStratAndAnnounce,
  cdlRulesetChanged,
};
