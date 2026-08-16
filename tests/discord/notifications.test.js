const test = require('node:test');
const assert = require('node:assert/strict');

const { createStore } = require('../../src/main/discord/store');
const { DiscordProvider, NotificationRouter, OUTCOME, SKIP_REASON } = require('../../src/main/discord/notifications');
const { STATUS, AUDIT_ACTIONS } = require('../../src/main/discord/constants');
const { DiscordError, CODES } = require('../../src/main/discord/redact');
const { fakeSecretStore, tempDataRoot, cleanup, collectingAudit } = require('../helpers');

const TEAM = { id: 'team-naevii', name: 'Team Naevii' };

// Builds a connected integration with the given channel mappings.
async function setup(t, { channels, preferences, postImpl } = {}) {
  const dataRoot = await tempDataRoot();
  t.after(() => cleanup(dataRoot));

  const store = createStore({ dataRoot, secretStore: fakeSecretStore() });
  const integration = await store.saveIntegration({
    guild_id: 'g1',
    guild_name: 'Team Discord',
    bot_user_id: 'b1',
    status: STATUS.CONNECTED,
  });
  await store.setSecret(integration.id, 'MTIzNDU2Nzg5MDEyMzQ1Njc4.GaBcDe.abcdefghijklmnopqrstuvwxyz123');

  await store.saveChannels(
    channels || [
      { purpose: 'strats', discord_channel_id: 'c-strats', discord_channel_name: 'strats', sensitivity: 'COACHING_STAFF', enabled: true },
      { purpose: 'general', discord_channel_id: 'c-general', discord_channel_name: 'coach-intel', sensitivity: 'PUBLIC_TEAM', enabled: true },
    ]
  );
  if (preferences) await store.savePreferences(preferences);

  const posts = [];
  const client = {
    async post(endpoint, body) {
      posts.push({ endpoint, body });
      if (postImpl) return postImpl(endpoint, body);
      return null;
    },
  };
  const audit = collectingAudit();
  const provider = new DiscordProvider({ client, store, audit, orgName: 'Naevii' });
  return { store, provider, posts, audit };
}

test('an enabled event with a mapped channel is delivered', async (t) => {
  const { provider, posts } = await setup(t);

  const result = await provider.deliver('strategy.approved', { team: TEAM, status: 'APPROVED' });

  assert.equal(result.outcome, OUTCOME.DELIVERED);
  assert.equal(result.channel, 'strats');
  assert.equal(posts.length, 1);
  assert.equal(posts[0].endpoint, '/channels/c-strats/messages');
  assert.ok(posts[0].body.embeds[0].author.name.includes('COACH INTEL'));
});

test('a disabled event sends nothing', async (t) => {
  const { provider, posts } = await setup(t, {
    preferences: { 'strategy.approved': { enabled: false } },
  });

  const result = await provider.deliver('strategy.approved', { team: TEAM });

  assert.equal(result.outcome, OUTCOME.SKIPPED);
  assert.equal(result.reason, SKIP_REASON.DISABLED);
  assert.equal(posts.length, 0);
});

test('an event with no configured channel is skipped, not failed', async (t) => {
  const { provider, posts } = await setup(t, {
    channels: [
      { purpose: 'strats', discord_channel_id: 'c-strats', discord_channel_name: 'strats', sensitivity: 'COACHING_STAFF', enabled: true },
    ],
    preferences: { 'match.pre_match_ready': { enabled: true } },
  });

  const result = await provider.deliver('match.pre_match_ready', { team: TEAM });

  assert.equal(result.outcome, OUTCOME.SKIPPED);
  assert.equal(result.reason, SKIP_REASON.NO_CHANNEL);
  assert.equal(posts.length, 0);
});

test('a restricted event is never posted to a public team channel', async (t) => {
  // strategy.approved is COACHING_STAFF; route it at a PUBLIC_TEAM channel.
  const { provider, posts, audit } = await setup(t, {
    channels: [
      { purpose: 'strats', discord_channel_id: 'c-open', discord_channel_name: 'general', sensitivity: 'PUBLIC_TEAM', enabled: true },
    ],
  });

  const result = await provider.deliver('strategy.approved', { team: TEAM });

  assert.equal(result.outcome, OUTCOME.SKIPPED);
  assert.equal(result.reason, SKIP_REASON.SENSITIVITY);
  assert.equal(posts.length, 0);
  assert.ok(audit.entries.some((e) => e.action === AUDIT_ACTIONS.NOTIFICATION_SUPPRESSED));
});

test('a channel above the event sensitivity still receives the event', async (t) => {
  const { provider, posts } = await setup(t, {
    channels: [
      { purpose: 'strats', discord_channel_id: 'c-locked', discord_channel_name: 'staff', sensitivity: 'RESTRICTED', enabled: true },
    ],
  });

  const result = await provider.deliver('strategy.approved', { team: TEAM });

  assert.equal(result.outcome, OUTCOME.DELIVERED);
  assert.equal(posts.length, 1);
});

test('sensitivity comparison is inclusive at the same level', () => {
  assert.equal(DiscordProvider.sensitivityAllows('COACHING_STAFF', 'COACHING_STAFF'), true);
  assert.equal(DiscordProvider.sensitivityAllows('RESTRICTED', 'COACHING_STAFF'), false);
  assert.equal(DiscordProvider.sensitivityAllows('PUBLIC_TEAM', 'RESTRICTED'), true);
  assert.equal(DiscordProvider.sensitivityAllows('NOPE', 'RESTRICTED'), false);
});

test('an identical event is not posted twice to the same channel', async (t) => {
  const { provider, posts } = await setup(t);
  const payload = { team: TEAM, status: 'APPROVED', dedupeId: 'strat-1-v3' };

  const first = await provider.deliver('strategy.approved', payload);
  const second = await provider.deliver('strategy.approved', payload);

  assert.equal(first.outcome, OUTCOME.DELIVERED);
  assert.equal(second.outcome, OUTCOME.SKIPPED);
  assert.equal(second.reason, SKIP_REASON.DUPLICATE);
  assert.equal(posts.length, 1);
});

test('a different occurrence of the same event type is still delivered', async (t) => {
  const { provider, posts } = await setup(t);

  await provider.deliver('strategy.approved', { team: TEAM, dedupeId: 'strat-1' });
  const second = await provider.deliver('strategy.approved', { team: TEAM, dedupeId: 'strat-2' });

  assert.equal(second.outcome, OUTCOME.DELIVERED);
  assert.equal(posts.length, 2);
});

test('identical payloads dedupe even without an explicit dedupe id, so retries are safe', async (t) => {
  const { provider, posts } = await setup(t);

  await provider.deliver('strategy.approved', { team: TEAM, title: 'Same', summary: 'Same' });
  const second = await provider.deliver('strategy.approved', { team: TEAM, title: 'Same', summary: 'Same' });

  assert.equal(second.reason, SKIP_REASON.DUPLICATE);
  assert.equal(posts.length, 1);
});

test('losing channel permissions marks the integration and does not throw', async (t) => {
  const { provider, store } = await setup(t, {
    postImpl: () => {
      throw new DiscordError(CODES.MISSING_CHANNEL_PERMISSIONS);
    },
  });

  const result = await provider.deliver('strategy.approved', { team: TEAM });

  assert.equal(result.outcome, OUTCOME.FAILED);
  assert.equal(result.code, CODES.MISSING_CHANNEL_PERMISSIONS);
  const integration = await store.getIntegration();
  assert.equal(integration.status, STATUS.PERMISSION_ERROR);
  assert.match(integration.last_error, /missing required channel permissions/i);
});

test('a failed delivery is not recorded as delivered, so a retry can succeed', async (t) => {
  let fail = true;
  const { provider, posts } = await setup(t, {
    postImpl: () => {
      if (fail) throw new DiscordError(CODES.UNAVAILABLE);
      return null;
    },
  });
  const payload = { team: TEAM, dedupeId: 'strat-9' };

  assert.equal((await provider.deliver('strategy.approved', payload)).outcome, OUTCOME.FAILED);
  fail = false;
  assert.equal((await provider.deliver('strategy.approved', payload)).outcome, OUTCOME.DELIVERED);
  assert.equal(posts.length, 2);
});

test('nothing is delivered when Discord is not connected', async (t) => {
  const dataRoot = await tempDataRoot();
  t.after(() => cleanup(dataRoot));
  const store = createStore({ dataRoot, secretStore: fakeSecretStore() });
  const provider = new DiscordProvider({ client: { post: async () => null }, store, audit: collectingAudit() });

  const result = await provider.deliver('strategy.approved', { team: TEAM });
  assert.equal(result.reason, SKIP_REASON.NOT_CONNECTED);
});

test('an unknown event id is skipped rather than crashing the publisher', async (t) => {
  const { provider } = await setup(t);
  const result = await provider.deliver('not.a.real.event', { team: TEAM });
  assert.equal(result.reason, SKIP_REASON.UNKNOWN_EVENT);
});

test('successful delivery and errors are both recorded in the audit log', async (t) => {
  const { provider, audit } = await setup(t);
  await provider.deliver('strategy.approved', { team: TEAM, dedupeId: 'a' });
  assert.ok(audit.entries.some((e) => e.action === AUDIT_ACTIONS.NOTIFICATION_SENT));
});

test('share posts to the chosen configured channel', async (t) => {
  const { provider, posts, audit } = await setup(t);

  const result = await provider.share({
    purpose: 'general',
    actor: 'Coach',
    spec: { kind: 'Intel', title: 'Map Signal', summary: 'Den is strongest', team: TEAM, route: 'command-center/team-naevii/intel', include: { title: true, summary: true, link: true } },
  });

  assert.equal(result.channel, 'coach-intel');
  assert.equal(posts[0].endpoint, '/channels/c-general/messages');
  assert.ok(audit.entries.some((e) => e.action === AUDIT_ACTIONS.SHARED));
});

test('sharing to an unconfigured purpose is rejected', async (t) => {
  const { provider } = await setup(t);
  await assert.rejects(
    () => provider.share({ purpose: 'vod_review', spec: { kind: 'VOD', title: 'x', route: 'needs-review' } }),
    (err) => err.code === CODES.NOT_CONFIGURED
  );
});

test('the router fans out to providers and survives a throwing provider', async (t) => {
  const { provider } = await setup(t);
  const broken = {
    id: 'broken',
    deliver: async () => {
      throw new Error('boom');
    },
  };
  const router = new NotificationRouter({ providers: [broken, provider] });

  const { results } = await router.publish('strategy.approved', { team: TEAM, dedupeId: 'r1' });

  assert.equal(results.length, 2);
  assert.equal(results[0].outcome, OUTCOME.FAILED);
  assert.equal(results[1].outcome, OUTCOME.DELIVERED);
});
