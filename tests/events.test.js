const test = require('node:test');
const assert = require('node:assert/strict');

const events = require('../src/main/events');
const { EVENTS_BY_ID, CHANNEL_PURPOSES } = require('../src/main/discord/constants');

const TEAM = { id: 'team-naevii', name: 'Team Naevii' };

function collector() {
  const seen = [];
  events.reset();
  events.subscribe((eventId, payload) => seen.push({ eventId, payload }));
  return seen;
}

function strat(overrides = {}) {
  return {
    strategy_id: 'den-hardpoint',
    strategy_name: 'Den Spawn Trap',
    map: 'Den',
    mode: 'Hardpoint',
    status: 'DRAFT',
    notes: 'Hold P2 until the break.',
    versions: [{ version: 1 }],
    ...overrides,
  };
}

test.afterEach(() => events.reset());

// ---------- Which save is worth a notification ----------

test('a status change to a reviewable state maps to the matching event', () => {
  assert.equal(
    events.stratEventId(strat({ status: 'DRAFT' }), strat({ status: 'READY FOR REVIEW' })),
    'strategy.review_requested'
  );
  assert.equal(
    events.stratEventId(strat({ status: 'READY FOR REVIEW' }), strat({ status: 'APPROVED' })),
    'strategy.approved'
  );
  assert.equal(
    events.stratEventId(strat({ status: 'APPROVED' }), strat({ status: 'MATCH READY' })),
    'strategy.match_ready.updated'
  );
});

test('editing a strat that is already match ready still notifies, because the team preps against it', () => {
  assert.equal(
    events.stratEventId(strat({ status: 'MATCH READY' }), strat({ status: 'MATCH READY', notes: 'new' })),
    'strategy.match_ready.updated'
  );
});

test('an ordinary edit is a change, and a brand-new draft is not announced at all', () => {
  assert.equal(events.stratEventId(strat(), strat({ notes: 'tweaked' })), 'strategy.changed');
  assert.equal(events.stratEventId(null, strat()), null);
});

test('a new strat created straight into a review state is announced', () => {
  assert.equal(events.stratEventId(null, strat({ status: 'READY FOR REVIEW' })), 'strategy.review_requested');
});

test('status matching ignores casing so UI values and stored values agree', () => {
  assert.equal(
    events.stratEventId(strat({ status: 'draft' }), strat({ status: 'ready for review' })),
    'strategy.review_requested'
  );
});

// ---------- Published payloads ----------

test('a strat save publishes an event every subscriber can render', async () => {
  const seen = collector();

  await events.stratSaved({
    previous: strat({ status: 'DRAFT' }),
    strat: strat({ status: 'READY FOR REVIEW', versions: [{ version: 1 }, { version: 2 }] }),
    team: TEAM,
    actor: 'Ion',
  });

  assert.equal(seen.length, 1);
  const { eventId, payload } = seen[0];
  assert.equal(eventId, 'strategy.review_requested');
  assert.equal(payload.title, 'Den Spawn Trap');
  assert.equal(payload.mapMode, 'Den · Hardpoint');
  assert.equal(payload.status, 'READY FOR REVIEW');
  assert.equal(payload.team, TEAM);
  assert.equal(payload.actor, 'Ion');
  // One notification per saved version: retries dedupe, real edits do not.
  assert.equal(payload.dedupeId, 'den-hardpoint:v2');
});

test('a new draft publishes nothing', async () => {
  const seen = collector();
  await events.stratSaved({ previous: null, strat: strat(), team: TEAM, actor: 'Ion' });
  assert.deepEqual(seen, []);
});

test('a ruleset change publishes a per-revision idempotency key', async () => {
  const seen = collector();

  await events.cdlRulesetChanged({
    change: 'deactivated',
    mapId: 'skidrow',
    mapName: 'Skidrow',
    detail: 'No longer in the competitive pool',
    stamp: '2026-08-16',
    actor: 'Ion',
  });

  assert.equal(seen.length, 1);
  assert.equal(seen[0].eventId, 'cdl.ruleset_change_detected');
  assert.match(seen[0].payload.title, /Skidrow retired from the CDL ruleset/);
  assert.equal(seen[0].payload.dedupeId, 'cdl:skidrow:deactivated:2026-08-16');
});

// ---------- Save + announce ----------

test('a strat save reads the previous record first, so the status transition survives', async () => {
  const seen = collector();
  const stored = strat({ status: 'DRAFT' });
  const calls = [];
  const store = {
    async getStrat() {
      calls.push('getStrat');
      return stored;
    },
    async saveStrat(teamId, next) {
      calls.push('saveStrat');
      return { ...stored, ...next, versions: [{ version: 1 }, { version: 2 }] };
    },
    async getTeam() {
      return TEAM;
    },
    async getOrg() {
      return { coachName: 'Ion' };
    },
  };

  const saved = await events.saveStratAndAnnounce(store, TEAM.id, {
    strategy_id: 'den-hardpoint',
    status: 'APPROVED',
  });

  assert.deepEqual(calls, ['getStrat', 'saveStrat']);
  assert.equal(saved.status, 'APPROVED');
  assert.equal(seen.length, 1);
  assert.equal(seen[0].eventId, 'strategy.approved');
  assert.equal(seen[0].payload.actor, 'Ion');
  assert.equal(seen[0].payload.targetId, 'den-hardpoint');
});

test('saving a brand-new strat writes it without reading a previous record or notifying', async () => {
  const seen = collector();
  const store = {
    async getStrat() {
      throw new Error('should not look up a strat that has no id yet');
    },
    async saveStrat(teamId, next) {
      return { ...next, strategy_id: 'new-strat', status: 'DRAFT', versions: [{ version: 1 }] };
    },
    async getTeam() {
      return TEAM;
    },
    async getOrg() {
      return { coachName: 'Ion' };
    },
  };

  const saved = await events.saveStratAndAnnounce(store, TEAM.id, { strategy_name: 'Fresh' });
  assert.equal(saved.strategy_id, 'new-strat');
  assert.deepEqual(seen, []);
});

// ---------- The bus must never break a domain write ----------

test('a failing subscriber cannot fail the write that produced the event', async () => {
  events.reset();
  const reached = [];
  events.subscribe(() => {
    throw new Error('discord exploded');
  });
  events.subscribe((eventId) => reached.push(eventId));

  await assert.doesNotReject(() =>
    events.stratSaved({ previous: strat(), strat: strat({ status: 'APPROVED' }), team: TEAM, actor: 'Ion' })
  );
  assert.deepEqual(reached, ['strategy.approved']);
});

test('unsubscribing stops delivery', async () => {
  events.reset();
  const seen = [];
  const off = events.subscribe((eventId) => seen.push(eventId));
  await events.emit('strategy.changed', {});
  off();
  await events.emit('strategy.changed', {});
  assert.deepEqual(seen, ['strategy.changed']);
});

// ---------- Catalog agreement ----------

test('every event the app emits exists in the Discord catalog and is marked automatic', () => {
  const emitted = [
    'strategy.review_requested',
    'strategy.approved',
    'strategy.changed',
    'strategy.match_ready.updated',
    'cdl.ruleset_change_detected',
    'calendar.scrim_scheduled',
    'calendar.training_scheduled',
    'calendar.match_scheduled',
  ];
  for (const id of emitted) {
    const event = EVENTS_BY_ID.get(id);
    assert.ok(event, `${id} is missing from the event catalog`);
    assert.equal(event.auto, true, `${id} should be marked as automatically emitted`);
  }
});

test('calendar notifications route to Discord #Schedule', () => {
  assert.ok(CHANNEL_PURPOSES.some((p) => p.id === 'schedule' && p.example === '#Schedule'));
  for (const id of ['calendar.scrim_scheduled', 'calendar.training_scheduled', 'calendar.match_scheduled']) {
    assert.equal(EVENTS_BY_ID.get(id).purpose, 'schedule');
  }
});

test('saving a calendar event is silent unless the coach asks to notify players', async () => {
  const seen = collector();
  const store = {
    async saveEvent(_teamId, event) {
      return { ...event, event_id: event.event_id || 'e1', date: event.date || '2026-08-26', time: event.time || '21:00' };
    },
    async getTeam() {
      return TEAM;
    },
    async getMembers() {
      return [];
    },
  };

  await events.saveEventAndAnnounce(store, TEAM.id, {
    type: 'league-match',
    title: 'vs DMT',
    date: '2026-08-26',
    time: '21:00',
  });
  assert.deepEqual(seen, []);

  await events.saveEventAndAnnounce(store, TEAM.id, {
    event_id: 'e1',
    type: 'league-match',
    title: 'vs DMT',
    date: '2026-08-26',
    time: '21:00',
    notify_players: true,
  });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].eventId, 'calendar.match_scheduled');
  assert.equal(seen[0].payload.dedupeId, 'e1:2026-08-26:21:00');
});

test('catalog events without a producer are not advertised as automatic', () => {
  for (const event of EVENTS_BY_ID.values()) {
    if (event.id.startsWith('match.') || event.id.startsWith('vod.') || event.id.startsWith('intel.')) {
      assert.notEqual(event.auto, true, `${event.id} has no producer yet, so it must not claim to be automatic`);
    }
  }
});
