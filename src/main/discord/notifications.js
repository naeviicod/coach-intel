// Notification delivery, behind a provider abstraction.
//
// Coach Intel domain events are published to a router; each provider decides
// whether and how to deliver them. Discord is one provider, so no domain module
// ever calls the Discord API directly.
//
// A notification is only delivered when all of these hold:
//   1. an integration exists and is not disconnected
//   2. the event is individually enabled in preferences
//   3. a channel is mapped and enabled for the event's purpose
//   4. the channel's sensitivity is at least the event's sensitivity
//   5. this exact event+destination has not already been delivered

const crypto = require('crypto');

const { EVENTS_BY_ID, SENSITIVITY, STATUS, AUDIT_ACTIONS } = require('./constants');
const { DiscordError, CODES, toDiscordError } = require('./redact');
const messages = require('./messages');
// In-app notifications ride the same shared_docs pipeline as tasks/events, so
// they reach every signed-in teammate live instead of sitting in a local file
// only the machine that created them can see.
const cloudSync = require('../cloudSync');

const OUTCOME = {
  DELIVERED: 'DELIVERED',
  SKIPPED: 'SKIPPED',
  FAILED: 'FAILED',
};

const SKIP_REASON = {
  NOT_CONNECTED: 'Discord is not connected',
  DISABLED: 'Event is disabled in Discord notification preferences',
  NO_CHANNEL: 'No Discord channel is configured for this event',
  SENSITIVITY: 'Channel sensitivity is lower than the event sensitivity',
  DUPLICATE: 'Already delivered to this channel',
  UNKNOWN_EVENT: 'Unknown event type',
};

function stableHash(value) {
  return crypto.createHash('sha1').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}

// Every embed is stamped with the moment it was built, so the timestamp has to be
// excluded for two renders of the same notification to hash identically. Without
// this, a retry would look like new content and post a duplicate.
function dedupeFingerprint(body) {
  return (body.embeds || []).map(({ timestamp, ...rest }) => rest);
}

/**
 * Delivery through the Coach Intel bot into a mapped guild channel.
 */
class DiscordProvider {
  constructor({ client, store, audit, orgName = null }) {
    this.id = 'discord';
    this.client = client;
    this.store = store;
    this.audit = audit;
    this.orgName = orgName;
  }

  // An event may only land in a channel configured for at least its sensitivity.
  static sensitivityAllows(eventSensitivity, channelSensitivity) {
    const required = SENSITIVITY[eventSensitivity];
    const offered = SENSITIVITY[channelSensitivity];
    if (required === undefined || offered === undefined) return false;
    return offered >= required;
  }

  async resolveDestination(eventId) {
    const integration = await this.store.getIntegration();
    if (!integration || !integration.guild_id || integration.status === STATUS.DISCONNECTED) {
      return { skip: SKIP_REASON.NOT_CONNECTED };
    }

    const event = EVENTS_BY_ID.get(eventId);
    if (!event) return { skip: SKIP_REASON.UNKNOWN_EVENT };

    const preference = integration.preferences?.[eventId];
    if (!preference || !preference.enabled) return { skip: SKIP_REASON.DISABLED, integration };

    const purpose = event.purpose;
    const mapping = (integration.channels || []).find((c) => c.purpose === purpose);
    if (!mapping || !mapping.enabled || !mapping.discord_channel_id) {
      return { skip: SKIP_REASON.NO_CHANNEL, integration };
    }

    if (!DiscordProvider.sensitivityAllows(event.sensitivity, mapping.sensitivity)) {
      return { skip: SKIP_REASON.SENSITIVITY, integration, mapping };
    }

    return { integration, event, mapping };
  }

  async deliver(eventId, payload = {}) {
    const resolved = await this.resolveDestination(eventId);

    if (resolved.skip) {
      // A suppressed restricted event is worth recording; routine "disabled" noise is not.
      if (resolved.skip === SKIP_REASON.SENSITIVITY) {
        await this.audit.record({
          action: AUDIT_ACTIONS.NOTIFICATION_SUPPRESSED,
          actor: payload.actor || 'Coach Intel',
          organization: this.orgName,
          target: eventId,
          result: 'SKIPPED',
          detail: { reason: resolved.skip },
        });
      }
      return { outcome: OUTCOME.SKIPPED, reason: resolved.skip, provider: this.id };
    }

    const { integration, mapping } = resolved;
    const body = messages.eventMessage(eventId, { ...payload, team: payload.team });

    // Same event + provider + destination must never post twice, so retries of a
    // failed publish are safe.
    const dedupeId = payload.dedupeId || stableHash(dedupeFingerprint(body));
    const key = this.store.deliveryKey({
      eventId: `${eventId}:${dedupeId}`,
      provider: this.id,
      destination: mapping.discord_channel_id,
    });

    if (await this.store.wasDelivered(key)) {
      return { outcome: OUTCOME.SKIPPED, reason: SKIP_REASON.DUPLICATE, provider: this.id };
    }

    try {
      await this.client.post(`/channels/${mapping.discord_channel_id}/messages`, body);
    } catch (err) {
      const error = toDiscordError(err);
      await this.store.setStatus(
        error.code === CODES.MISSING_CHANNEL_PERMISSIONS ? STATUS.PERMISSION_ERROR : STATUS.NEEDS_ATTENTION,
        error.userMessage
      );
      await this.audit.record({
        action: AUDIT_ACTIONS.INTEGRATION_ERROR,
        actor: payload.actor || 'Coach Intel',
        organization: this.orgName,
        target: `${eventId} → #${mapping.discord_channel_name}`,
        result: 'FAILURE',
        detail: { code: error.code },
      });
      return { outcome: OUTCOME.FAILED, provider: this.id, code: error.code, message: error.userMessage };
    }

    await this.store.markDelivered(key);
    await this.audit.record({
      action: AUDIT_ACTIONS.NOTIFICATION_SENT,
      actor: payload.actor || 'Coach Intel',
      organization: this.orgName,
      target: `${eventId} → #${mapping.discord_channel_name}`,
      result: 'SUCCESS',
    });

    if (integration.status !== STATUS.CONNECTED) {
      await this.store.setStatus(STATUS.CONNECTED, null);
    }

    return {
      outcome: OUTCOME.DELIVERED,
      provider: this.id,
      channel: mapping.discord_channel_name,
      channelId: mapping.discord_channel_id,
    };
  }

  /**
   * Explicit user-initiated share to a specific configured channel (§23).
   * Bypasses event preferences because the coach chose the destination, but the
   * dialog only ever offers channels that are mapped and enabled.
   */
  async share({ purpose, spec, actor }) {
    const integration = await this.store.requireIntegration();
    const mapping = (integration.channels || []).find((c) => c.purpose === purpose);
    if (!mapping || !mapping.enabled || !mapping.discord_channel_id) {
      throw new DiscordError(CODES.NOT_CONFIGURED);
    }

    const body = messages.shareMessage({ ...spec, team: spec.team });
    try {
      await this.client.post(`/channels/${mapping.discord_channel_id}/messages`, body);
    } catch (err) {
      const error = toDiscordError(err);
      await this.audit.record({
        action: AUDIT_ACTIONS.INTEGRATION_ERROR,
        actor: actor || 'Coach',
        organization: this.orgName,
        target: `share → #${mapping.discord_channel_name}`,
        result: 'FAILURE',
        detail: { code: error.code },
      });
      throw error;
    }

    await this.audit.record({
      action: AUDIT_ACTIONS.SHARED,
      actor: actor || 'Coach',
      organization: this.orgName,
      target: `${spec.kind || 'item'} → #${mapping.discord_channel_name}`,
      result: 'SUCCESS',
    });

    return { channel: mapping.discord_channel_name, channelId: mapping.discord_channel_id };
  }
}

/**
 * Records notifications inside Coach Intel itself — the app's own bell/feed,
 * independent of whether Discord is connected or a channel is mapped. Every
 * signed-in teammate sees the same team feed (there is no per-user private
 * inbox anywhere else in the app, so this matches that model rather than
 * inventing a new one).
 */
class InAppProvider {
  constructor({ store, orgName = null } = {}) {
    this.id = 'in-app';
    this.store = store;
    this.orgName = orgName;
  }

  async deliver(eventId, payload = {}) {
    const event = EVENTS_BY_ID.get(eventId);
    if (!event) return { outcome: OUTCOME.SKIPPED, provider: this.id, reason: SKIP_REASON.UNKNOWN_EVENT };
    const teamId = payload.team?.id || 'org';
    if (!this.store) {
      return { outcome: OUTCOME.SKIPPED, provider: this.id, reason: 'No notification store or team' };
    }
    try {
      const linkKind = payload.linkKind || messages.defaultLinkKind(eventId);
      const record = await this.store.addNotification(teamId, {
        event_id: eventId,
        title: payload.title || event.label,
        subtitle: payload.subtitle || null,
        route: messages.routeFor(linkKind, teamId, payload.targetId),
        recipient_member_ids: payload.recipientMemberIds || [],
      });
      cloudSync.push('notification', teamId, record).catch((err) => {
        console.warn('[in-app] notification cloud push failed:', err.message);
      });
      return { outcome: OUTCOME.DELIVERED, provider: this.id };
    } catch (err) {
      return { outcome: OUTCOME.FAILED, provider: this.id, message: err.message };
    }
  }
}

/**
 * Fan-out point for Coach Intel domain events. Domain modules publish here; they
 * never know Discord exists.
 */
class NotificationRouter {
  constructor({ providers = [] } = {}) {
    this.providers = providers;
  }

  register(provider) {
    this.providers.push(provider);
    return this;
  }

  async publish(eventId, payload = {}) {
    const results = [];
    for (const provider of this.providers) {
      try {
        results.push(await provider.deliver(eventId, payload));
      } catch (err) {
        const error = toDiscordError(err);
        results.push({
          outcome: OUTCOME.FAILED,
          provider: provider.id,
          code: error.code,
          message: error.userMessage,
        });
      }
    }
    return { eventId, results };
  }
}

module.exports = {
  OUTCOME,
  SKIP_REASON,
  DiscordProvider,
  InAppProvider,
  NotificationRouter,
  stableHash,
  dedupeFingerprint,
};
