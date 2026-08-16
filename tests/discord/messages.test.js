const test = require('node:test');
const assert = require('node:assert/strict');

const messages = require('../../src/main/discord/messages');
const { EMBED_COLOR } = require('../../src/main/discord/constants');

const TEAM = { id: 'team-naevii', name: 'Team Naevii' };

function linkField(embed) {
  return (embed.fields || []).find((f) => f.name === 'Open in Coach Intel');
}

test('builds a Coach Intel branded embed', () => {
  const embed = messages.buildEmbed({ kind: 'Strat Review', title: 'Den · Hardpoint' });
  assert.equal(embed.author.name, 'COACH INTEL · STRAT REVIEW');
  assert.equal(embed.color, EMBED_COLOR);
  assert.equal(embed.title, 'Den · Hardpoint');
  assert.ok(embed.timestamp);
});

test('deep links use the coachintel scheme', () => {
  assert.equal(messages.deepLink('team-hub/t1/strats'), 'coachintel://team-hub/t1/strats');
  assert.equal(messages.deepLink('#/needs-review'), 'coachintel://needs-review');
});

test('routes resolve to real Coach Intel destinations', () => {
  assert.equal(messages.routeFor('strat', 'team-1'), 'team-hub/team-1/strats');
  assert.equal(messages.routeFor('strat', 'team-1', 'den-hardpoint'), 'team-hub/team-1/strats/edit/den-hardpoint');
  assert.equal(messages.routeFor('intel', 'team-1'), 'intel-feed/team-1');
  assert.equal(messages.routeFor('match', 'team-1'), 'matches/team-1');
  assert.equal(messages.routeFor('maps', 'team-1'), 'maps-modes/team-1');
  assert.equal(messages.routeFor('review', 'team-1'), 'needs-review');
  assert.equal(messages.routeFor('member', 'team-1', 'blitz'), 'member/team-1/blitz');
});

// A deep link that no longer matches a renderer route silently dead-ends, so the
// first segment of every route is checked against the router itself.
test('every deep-link destination is a page the renderer can route to', () => {
  const fs = require('fs');
  const path = require('path');
  const appSource = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'renderer', 'app.js'), 'utf8');
  const routeBlock = appSource.slice(appSource.indexOf('const routes = {'), appSource.indexOf('const NAV_GROUPS'));
  const pages = new Set(
    [...routeBlock.matchAll(/^\s{2}'?([a-z-]+)'?[,:]/gm)].map((m) => m[1])
  );

  for (const [kind, builder] of Object.entries(messages.ROUTES)) {
    const page = builder('team-1', 'target-1').split('/')[0];
    assert.ok(pages.has(page), `deep link "${kind}" points at unknown page "${page}"`);
  }
});

test('a strat message carries map, mode, status and a deep link', () => {
  const { embeds } = messages.stratMessage({
    strat: { strategy_id: 'p2-p3', strategy_name: 'P2 → P3 Rotation', map: 'Den', mode: 'Hardpoint', status: 'READY FOR REVIEW', versions: [{}, {}] },
    team: TEAM,
    actor: 'CoachName',
  });
  const [embed] = embeds;

  assert.equal(embed.title, 'Den · Hardpoint');
  assert.match(embed.description, /P2 → P3 Rotation/);
  const fields = Object.fromEntries(embed.fields.map((f) => [f.name, f.value]));
  assert.equal(fields.Status, 'READY FOR REVIEW');
  assert.equal(fields.Team, 'Team Naevii');
  assert.equal(fields['Updated by'], 'CoachName');
  assert.equal(fields.Version, 'v2');
  assert.match(linkField(embed).value, /coachintel:\/\/team-hub\/team-naevii\/strats\/edit\/p2-p3/);
});

test('match prep sends a readiness summary rather than the full report', () => {
  const { embeds } = messages.matchPrepMessage({
    team: TEAM,
    opponent: 'Opponent',
    kickoff: 'Friday · 19:00',
    readiness: 82,
    stratsReady: '7/9',
    openReviews: 2,
    opponentIntel: 'UPDATED',
  });
  const fields = Object.fromEntries(embeds[0].fields.map((f) => [f.name, f.value]));
  assert.equal(fields.Readiness, '82%');
  assert.equal(fields['Strats Ready'], '7/9');
  assert.equal(fields['Open Reviews'], '2');
});

test('long content is truncated to Discord limits', () => {
  const embed = messages.buildEmbed({
    kind: 'Intel',
    title: 'T'.repeat(400),
    fields: [{ name: 'N'.repeat(400), value: 'V'.repeat(2000) }],
  });
  assert.ok(embed.title.length <= messages.LIMITS.title);
  assert.ok(embed.fields[0].name.length <= messages.LIMITS.fieldName);
  assert.ok(embed.fields[0].value.length <= messages.LIMITS.fieldValue);
});

test('empty and whitespace-only values are dropped rather than sent blank', () => {
  const embed = messages.buildEmbed({ kind: 'Intel', title: '   ', summary: '' });
  assert.equal(embed.title, undefined);
  assert.equal(embed.description, undefined);
});

test('share honours the include toggles', () => {
  const spec = {
    kind: 'Strat',
    title: 'Den · Hardpoint',
    subtitle: 'P2 → P3',
    summary: 'Rotate early off the second hill.',
    team: TEAM,
    route: 'team-hub/team-naevii/strats/edit/den-hp',
  };

  const all = messages.shareMessage({ ...spec, include: { title: true, summary: true, link: true } }).embeds[0];
  assert.equal(all.title, 'Den · Hardpoint');
  assert.match(all.description, /Rotate early/);
  assert.ok(linkField(all));

  const linkOnly = messages.shareMessage({ ...spec, include: { title: false, summary: false, link: true } }).embeds[0];
  assert.equal(linkOnly.title, undefined);
  assert.equal(linkOnly.description, undefined);
  assert.ok(linkOnly.fields.some((f) => f.name === 'Team'));

  const noLink = messages.shareMessage({ ...spec, include: { title: true, summary: true, link: false } }).embeds[0];
  assert.equal(linkField(noLink), undefined);
});

test('event messages pick a sensible deep-link destination per event family', () => {
  assert.equal(messages.defaultLinkKind('strategy.approved'), 'strat');
  assert.equal(messages.defaultLinkKind('intel.high_confidence.created'), 'intel');
  assert.equal(messages.defaultLinkKind('match.pre_match_ready'), 'match');
  assert.equal(messages.defaultLinkKind('vod.note_assigned'), 'review');
  assert.equal(messages.defaultLinkKind('cdl.ruleset_change_detected'), 'maps');

  const { embeds } = messages.eventMessage('strategy.approved', { team: TEAM, status: 'APPROVED', targetId: 'den-hp' });
  assert.match(linkField(embeds[0]).value, /team-hub\/team-naevii\/strats\/edit\/den-hp/);
});

test('a test message names the organization and server', () => {
  const { embeds } = messages.testMessage({ orgName: 'Naevii', guildName: 'Team Discord', channelName: 'coach-intel' });
  const fields = Object.fromEntries(embeds[0].fields.map((f) => [f.name, f.value]));
  assert.equal(fields.Organization, 'Naevii');
  assert.equal(fields.Server, 'Team Discord');
  assert.equal(fields.Status, 'Ready');
  assert.match(embeds[0].footer.text, /#coach-intel/);
});
