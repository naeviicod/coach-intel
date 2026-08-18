// Builds Discord messages that read like Coach Intel rather than debug output.
//
// Embeds carry a type, team, map/mode where relevant, a short summary, a status,
// and a deep link back into the app. They deliberately do not carry the full
// contents of a Strat, report, or scouting note — the link is enough.

const { EMBED_COLOR, DEEP_LINK_SCHEME, EVENTS_BY_ID } = require('./constants');

// Discord embed size ceilings.
const LIMITS = {
  title: 256,
  description: 4096,
  fieldName: 256,
  fieldValue: 1024,
  footer: 2048,
  author: 256,
  fields: 25,
};

function truncate(value, max) {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (!str) return null;
  if (str.length <= max) return str;
  return `${str.slice(0, max - 1)}…`;
}

/**
 * Deep link into a Coach Intel route.
 *
 * Discord only turns http(s) URLs into clickable links, so this custom scheme is
 * rendered as copyable inline code inside the embed. The app registers itself as
 * the handler for the scheme, so opening the link focuses the right screen.
 */
function deepLink(route) {
  const clean = String(route || '').replace(/^#?\/?/, '');
  return `${DEEP_LINK_SCHEME}://${clean}`;
}

// A Strat link opens that exact Strat when its id is known, so a review request in
// Discord lands on the board rather than the list.
const ROUTES = {
  strat: (teamId, stratId) => (stratId ? `team-hub/${teamId}/strats/edit/${stratId}` : `team-hub/${teamId}/strats`),
  intel: (teamId) => `intel-feed/${teamId}`,
  match: (teamId) => `matches/${teamId}`,
  performance: (teamId) => `statistics/${teamId}`,
  maps: (teamId) => `maps-modes/${teamId}`,
  review: () => 'needs-review',
  member: (teamId, memberId) => `member/${teamId}/${memberId}`,
  integrations: () => 'integrations',
  calendar: (teamId) => `calendar/${teamId}`,
  scrim: (teamId) => `scrim-hub/${teamId}`,
};

function routeFor(kind, teamId, extra) {
  const builder = ROUTES[kind];
  if (!builder) return ROUTES.intel(teamId);
  return builder(teamId, extra);
}

/**
 * @param {object} spec
 * @param {string} spec.kind        e.g. 'STRAT REVIEW' — appended to "COACH INTEL · "
 * @param {string} [spec.title]     primary line, e.g. "Den · Hardpoint"
 * @param {string} [spec.subtitle]  secondary line, e.g. "P2 → P3 Rotation"
 * @param {string} [spec.summary]   short body text
 * @param {Array<{name: string, value: string, inline?: boolean}>} [spec.fields]
 * @param {string} [spec.link]      deep link route (already built via deepLink)
 * @param {string} [spec.footer]
 */
function buildEmbed(spec = {}) {
  const descriptionParts = [];
  if (spec.subtitle) descriptionParts.push(`**${truncate(spec.subtitle, 200)}**`);
  if (spec.summary) descriptionParts.push(truncate(spec.summary, 1500));

  const fields = [];
  for (const field of spec.fields || []) {
    const name = truncate(field.name, LIMITS.fieldName);
    const value = truncate(field.value, LIMITS.fieldValue);
    if (!name || !value) continue;
    fields.push({ name, value, inline: field.inline !== false });
    if (fields.length >= LIMITS.fields - 1) break;
  }

  if (spec.link) {
    fields.push({
      name: 'Open in Coach Intel',
      value: `\`${truncate(spec.link, 900)}\``,
      inline: false,
    });
  }

  const embed = {
    color: EMBED_COLOR,
    author: { name: truncate(`COACH INTEL · ${spec.kind || 'UPDATE'}`.toUpperCase(), LIMITS.author) },
    timestamp: new Date().toISOString(),
  };

  const title = truncate(spec.title, LIMITS.title);
  if (title) embed.title = title;
  const description = descriptionParts.filter(Boolean).join('\n\n');
  if (description) embed.description = truncate(description, LIMITS.description);
  if (fields.length) embed.fields = fields;
  const footer = truncate(spec.footer, LIMITS.footer);
  if (footer) embed.footer = { text: footer };

  return embed;
}

function message(embed) {
  return { embeds: [embed] };
}

// ---------- Specific message types ----------

function testMessage({ orgName, guildName, channelName }) {
  return message(
    buildEmbed({
      kind: 'Integration',
      title: 'Discord integration connected successfully.',
      fields: [
        { name: 'Organization', value: orgName || 'Coach Intel' },
        { name: 'Server', value: guildName || '—' },
        { name: 'Status', value: 'Ready' },
      ],
      footer: channelName ? `Delivered to #${channelName}` : null,
    })
  );
}

function stratMessage({ strat, team, actor, kind = 'Strat' }) {
  const mapMode = [strat?.map, strat?.mode].filter(Boolean).join(' · ');
  return message(
    buildEmbed({
      kind,
      title: mapMode || strat?.strategy_name || 'Strat',
      subtitle: mapMode ? strat?.strategy_name : null,
      summary: truncate(strat?.notes, 400),
      fields: [
        { name: 'Status', value: strat?.status || 'DRAFT' },
        { name: 'Team', value: team?.name || '—' },
        actor ? { name: 'Updated by', value: actor } : null,
        strat?.versions?.length ? { name: 'Version', value: `v${strat.versions.length}` } : null,
      ].filter(Boolean),
      link: deepLink(routeFor('strat', team?.id, strat?.strategy_id)),
    })
  );
}

function intelMessage({ signal, team }) {
  return message(
    buildEmbed({
      kind: 'Intel',
      title: signal?.title || 'Intel',
      summary: signal?.body,
      fields: [
        { name: 'Team', value: team?.name || '—' },
        signal?.mode ? { name: 'Mode', value: signal.mode } : null,
      ].filter(Boolean),
      link: deepLink(routeFor('intel', team?.id)),
    })
  );
}

function matchPrepMessage({ team, opponent, kickoff, readiness, stratsReady, openReviews, opponentIntel }) {
  return message(
    buildEmbed({
      kind: 'Match Prep',
      title: `${team?.name || 'Team'} vs ${opponent || 'Opponent'}`,
      subtitle: kickoff || null,
      fields: [
        readiness !== undefined && readiness !== null ? { name: 'Readiness', value: `${readiness}%` } : null,
        stratsReady ? { name: 'Strats Ready', value: String(stratsReady) } : null,
        openReviews !== undefined && openReviews !== null ? { name: 'Open Reviews', value: String(openReviews) } : null,
        opponentIntel ? { name: 'Opponent Intel', value: opponentIntel } : null,
      ].filter(Boolean),
      link: deepLink(routeFor('match', team?.id)),
    })
  );
}

/**
 * Generic domain-event message. Used by the notification dispatcher so new events
 * do not each need a bespoke builder.
 */
function eventMessage(eventId, payload = {}) {
  const event = EVENTS_BY_ID.get(eventId);
  const team = payload.team || null;
  const linkKind = payload.linkKind || defaultLinkKind(eventId);

  return message(
    buildEmbed({
      kind: payload.kind || event?.group || 'Update',
      title: payload.title || event?.label || 'Coach Intel update',
      subtitle: payload.subtitle || null,
      summary: payload.summary || null,
      fields: [
        team?.name ? { name: 'Team', value: team.name } : null,
        payload.mapMode ? { name: 'Map / Mode', value: payload.mapMode } : null,
        payload.status ? { name: 'Status', value: payload.status } : null,
        payload.actor ? { name: 'Updated by', value: payload.actor } : null,
        ...(payload.fields || []),
      ].filter(Boolean),
      link: deepLink(routeFor(linkKind, team?.id, payload.targetId || payload.memberId)),
      footer: payload.footer || null,
    })
  );
}

function defaultLinkKind(eventId) {
  if (eventId.startsWith('strategy.')) return 'strat';
  if (eventId.startsWith('intel.')) return 'intel';
  if (eventId === 'calendar.scrim_scheduled') return 'scrim';
  if (eventId.startsWith('calendar.')) return 'calendar';
  if (eventId.startsWith('match.')) return 'match';
  if (eventId.startsWith('review.') || eventId.startsWith('vod.')) return 'review';
  if (eventId.startsWith('cdl.') || eventId.startsWith('data.') || eventId.startsWith('external.')) return 'maps';
  return 'intel';
}

/**
 * Share payload assembled by the Share to Discord dialog. Each part is opt-in so a
 * coach can share a title and link without the summary.
 */
function shareMessage({ kind, title, subtitle, summary, status, team, route, include = {} }) {
  return message(
    buildEmbed({
      kind: kind || 'Share',
      title: include.title === false ? null : title,
      subtitle: include.title === false ? null : subtitle,
      summary: include.summary === false ? null : summary,
      fields: [
        team?.name ? { name: 'Team', value: team.name } : null,
        status ? { name: 'Status', value: status } : null,
      ].filter(Boolean),
      link: include.link === false ? null : deepLink(route),
    })
  );
}

module.exports = {
  LIMITS,
  truncate,
  deepLink,
  ROUTES,
  routeFor,
  buildEmbed,
  message,
  testMessage,
  stratMessage,
  intelMessage,
  matchPrepMessage,
  eventMessage,
  shareMessage,
  defaultLinkKind,
};
