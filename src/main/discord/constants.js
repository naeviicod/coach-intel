// Static Discord + Coach Intel integration vocabulary.
//
// Coach Intel connects to Discord outbound-only: the organization creates its own
// Discord application, invites that bot to its server, and pastes the bot token
// into Coach Intel. There is no OAuth flow and no client secret, because a
// distributed desktop app cannot keep one confidential.

const API_BASE = 'https://discord.com/api/v10';
const API_VERSION = 'v10';

// Discord permission bitfield flags, as BigInt (permissions arrive as decimal strings).
const PERMISSIONS = {
  ADMINISTRATOR: 1n << 3n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  EMBED_LINKS: 1n << 14n,
  ATTACH_FILES: 1n << 15n,
  SEND_MESSAGES_IN_THREADS: 1n << 38n,
};

// The only permissions Coach Intel needs to post an embed into a channel.
// Deliberately excludes Administrator, Manage Server/Channels/Messages, and
// member moderation — Coach Intel reads Discord config and posts, nothing more.
const REQUIRED_CHANNEL_PERMISSIONS = ['VIEW_CHANNEL', 'SEND_MESSAGES', 'EMBED_LINKS'];

// The permission integer used in the bot invite URL (view + send + embed).
const BOT_INVITE_PERMISSIONS = String(
  PERMISSIONS.VIEW_CHANNEL | PERMISSIONS.SEND_MESSAGES | PERMISSIONS.EMBED_LINKS
);

const BOT_INVITE_SCOPES = ['bot'];

// Discord channel types Coach Intel can post into.
const POSTABLE_CHANNEL_TYPES = new Set([
  0, // GUILD_TEXT
  5, // GUILD_ANNOUNCEMENT
]);

// ---------- Sensitivity ----------

// Ordered least → most sensitive. An event may only be delivered to a channel
// whose sensitivity is at least as high as the event's own.
const SENSITIVITY = {
  PUBLIC_TEAM: 0,
  COACHING_STAFF: 1,
  RESTRICTED: 2,
};

const SENSITIVITY_LABELS = {
  PUBLIC_TEAM: 'Public Team',
  COACHING_STAFF: 'Coaching Staff',
  RESTRICTED: 'Restricted',
};

// ---------- Channel purposes ----------

const CHANNEL_PURPOSES = [
  { id: 'general', label: 'General Intel', example: '#coach-intel', defaultSensitivity: 'PUBLIC_TEAM' },
  { id: 'schedule', label: 'Schedule', example: '#Schedule', defaultSensitivity: 'PUBLIC_TEAM' },
  { id: 'match_reports', label: 'Match Reports', example: '#match-reports', defaultSensitivity: 'PUBLIC_TEAM' },
  { id: 'scrims', label: 'Scrim Scheduling', example: '#scrims', defaultSensitivity: 'PUBLIC_TEAM' },
  { id: 'training', label: 'Training & Practice', example: '#training', defaultSensitivity: 'PUBLIC_TEAM' },
  { id: 'strats', label: 'Strat Review', example: '#strats', defaultSensitivity: 'COACHING_STAFF' },
  { id: 'vod_review', label: 'VOD Review', example: '#vod-review', defaultSensitivity: 'COACHING_STAFF' },
  { id: 'alerts', label: 'Alerts', example: '#coach-alerts', defaultSensitivity: 'RESTRICTED' },
  // The one purpose Coach Intel actually reads from, not just posts to — kept
  // singular and clearly labeled so every other channel mapping still means
  // "post here only", matching what the Integrations page tells the coach.
  { id: 'team_chat', label: 'Team Chat (Coach Intel reads this one)', example: '#team-chat', defaultSensitivity: 'PUBLIC_TEAM' },
];

const PURPOSE_IDS = CHANNEL_PURPOSES.map((p) => p.id);

// ---------- Domain event catalog ----------
//
// Each event is individually enableable. Defaults favour high-value events only,
// so a fresh connection does not spam a team's server.
//
// `auto` marks the events Coach Intel already emits from a real write today. The
// rest are part of the catalog but have no producer yet, because the app does not
// track that data (matches and VODs are read-only, Intel signals are derived at
// render time). The preferences screen labels them so a coach is never promised a
// notification that cannot fire.

const EVENTS = [
  // Intel
  { id: 'intel.high_confidence.created', group: 'Intel', label: 'High-confidence Intel', purpose: 'general', sensitivity: 'PUBLIC_TEAM', defaultEnabled: true },
  { id: 'intel.important.updated', group: 'Intel', label: 'Important Intel updated', purpose: 'general', sensitivity: 'PUBLIC_TEAM', defaultEnabled: false },
  { id: 'intel.opponent.changed', group: 'Intel', label: 'Opponent Intel changed', purpose: 'general', sensitivity: 'COACHING_STAFF', defaultEnabled: false },

  // Strategy
  { id: 'strategy.review_requested', group: 'Strategy', label: 'Strat ready for review', purpose: 'strats', sensitivity: 'COACHING_STAFF', defaultEnabled: true, auto: true },
  { id: 'strategy.approved', group: 'Strategy', label: 'Strat approved', purpose: 'strats', sensitivity: 'COACHING_STAFF', defaultEnabled: true, auto: true },
  { id: 'strategy.changed', group: 'Strategy', label: 'Strat changed', purpose: 'strats', sensitivity: 'COACHING_STAFF', defaultEnabled: false, auto: true },
  { id: 'strategy.match_ready.updated', group: 'Strategy', label: 'Match-ready Strat updated', purpose: 'strats', sensitivity: 'COACHING_STAFF', defaultEnabled: true, auto: true },

  // Review
  { id: 'review.needs_review.created', group: 'Review', label: 'New Needs Review item', purpose: 'vod_review', sensitivity: 'COACHING_STAFF', defaultEnabled: false },
  { id: 'review.assigned', group: 'Review', label: 'Review assigned', purpose: 'vod_review', sensitivity: 'COACHING_STAFF', defaultEnabled: true },
  { id: 'review.overdue', group: 'Review', label: 'Review overdue', purpose: 'alerts', sensitivity: 'COACHING_STAFF', defaultEnabled: false },
  { id: 'review.resolved', group: 'Review', label: 'Review resolved', purpose: 'vod_review', sensitivity: 'COACHING_STAFF', defaultEnabled: false },

  // Calendar — all land in #Schedule when the coach hits Notify players.
  { id: 'calendar.scrim_scheduled', group: 'Calendar', label: 'Scrim booked', purpose: 'schedule', sensitivity: 'PUBLIC_TEAM', defaultEnabled: true, auto: true },
  { id: 'calendar.training_scheduled', group: 'Calendar', label: 'Training/meeting/VOD review scheduled', purpose: 'schedule', sensitivity: 'PUBLIC_TEAM', defaultEnabled: true, auto: true },
  { id: 'calendar.match_scheduled', group: 'Calendar', label: 'Match added to calendar', purpose: 'schedule', sensitivity: 'PUBLIC_TEAM', defaultEnabled: true, auto: true },

  // Match
  { id: 'match.pre_match_ready', group: 'Match', label: 'Pre-match pack ready', purpose: 'match_reports', sensitivity: 'PUBLIC_TEAM', defaultEnabled: true },
  { id: 'match.opponent_report_ready', group: 'Match', label: 'Opponent report ready', purpose: 'match_reports', sensitivity: 'COACHING_STAFF', defaultEnabled: true },
  { id: 'match.preparation_incomplete', group: 'Match', label: 'Match preparation incomplete', purpose: 'alerts', sensitivity: 'COACHING_STAFF', defaultEnabled: false },
  { id: 'match.post_match_ready', group: 'Match', label: 'Post-match review ready', purpose: 'match_reports', sensitivity: 'PUBLIC_TEAM', defaultEnabled: true },

  // VOD
  { id: 'vod.review_item.created', group: 'VOD', label: 'New VOD review item', purpose: 'vod_review', sensitivity: 'COACHING_STAFF', defaultEnabled: false },
  { id: 'vod.note_assigned', group: 'VOD', label: 'VOD note assigned', purpose: 'vod_review', sensitivity: 'COACHING_STAFF', defaultEnabled: true },
  { id: 'vod.clip_added', group: 'VOD', label: 'Clip added to review', purpose: 'vod_review', sensitivity: 'COACHING_STAFF', defaultEnabled: false },

  // CDL / Data
  { id: 'cdl.ruleset_change_detected', group: 'Data', label: 'CDL ruleset change detected', purpose: 'alerts', sensitivity: 'PUBLIC_TEAM', defaultEnabled: true, auto: true },
  { id: 'external.opponent_updated', group: 'Data', label: 'External opponent data refreshed', purpose: 'alerts', sensitivity: 'COACHING_STAFF', defaultEnabled: false },
  { id: 'data.conflict_requires_review', group: 'Data', label: 'Data conflict requires review', purpose: 'alerts', sensitivity: 'COACHING_STAFF', defaultEnabled: false },
];

const EVENTS_BY_ID = new Map(EVENTS.map((e) => [e.id, e]));

const EVENT_GROUPS = [...new Set(EVENTS.map((e) => e.group))];

// ---------- Integration status ----------

const STATUS = {
  NOT_CONNECTED: 'NOT_CONNECTED',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  NEEDS_ATTENTION: 'NEEDS_ATTENTION',
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  DISCONNECTED: 'DISCONNECTED',
};

const STATUS_LABELS = {
  NOT_CONNECTED: 'Not Connected',
  CONNECTING: 'Connecting',
  CONNECTED: 'Connected',
  NEEDS_ATTENTION: 'Needs Attention',
  PERMISSION_ERROR: 'Permission Error',
  DISCONNECTED: 'Disconnected',
};

// ---------- Audit actions ----------

const AUDIT_ACTIONS = {
  GUILD_CONNECTED: 'discord.guild_connected',
  GUILD_DISCONNECTED: 'discord.guild_disconnected',
  CHANNEL_MAPPING_CHANGED: 'discord.channel_mapping_changed',
  PREFERENCES_CHANGED: 'discord.preferences_changed',
  TEST_MESSAGE_SENT: 'discord.test_message_sent',
  SHARED: 'discord.shared',
  NOTIFICATION_SENT: 'discord.notification_sent',
  NOTIFICATION_SUPPRESSED: 'discord.notification_suppressed',
  INTEGRATION_ERROR: 'discord.integration_error',
  BOT_PERMISSIONS_CHANGED: 'discord.bot_permissions_changed',
  HEALTH_VERIFIED: 'discord.health_verified',
};

// Coach Intel brand accent, reused as the Discord embed colour.
const EMBED_COLOR = 0xb6f542;

const DEEP_LINK_SCHEME = 'coachintel';

module.exports = {
  API_BASE,
  API_VERSION,
  PERMISSIONS,
  REQUIRED_CHANNEL_PERMISSIONS,
  BOT_INVITE_PERMISSIONS,
  BOT_INVITE_SCOPES,
  POSTABLE_CHANNEL_TYPES,
  SENSITIVITY,
  SENSITIVITY_LABELS,
  CHANNEL_PURPOSES,
  PURPOSE_IDS,
  EVENTS,
  EVENTS_BY_ID,
  EVENT_GROUPS,
  STATUS,
  STATUS_LABELS,
  AUDIT_ACTIONS,
  EMBED_COLOR,
  DEEP_LINK_SCHEME,
};
