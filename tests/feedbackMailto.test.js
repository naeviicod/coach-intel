const test = require('node:test');
const assert = require('node:assert/strict');
const { FEEDBACK_EMAIL, buildFeedbackMailto } = require('../src/main/feedbackMailto');

test('mailto always targets the fixed feedback address, never a caller-supplied one', () => {
  const url = buildFeedbackMailto({ subject: 'x', description: 'y', to: 'attacker@evil.example' });
  assert.equal(url.startsWith(`mailto:${FEEDBACK_EMAIL}?`), true);
  assert.equal(url.includes('evil.example'), false);
});

test('body includes every field from the requested template, in order', () => {
  const url = buildFeedbackMailto({
    category: 'bug',
    categoryLabel: 'Bug',
    subject: 'Sidebar collapse crashes',
    userLabel: 'Coach Nova',
    teamLabel: 'Naevii Black',
    orgLabel: 'Naevii',
    page: 'team-hub',
    appVersion: '0.8.1',
    platform: 'macOS',
    timestamp: '2026-08-19T12:00:00.000Z',
    description: 'It crashed when I collapsed the sidebar.',
  });
  const params = new URLSearchParams(url.slice(url.indexOf('?') + 1));
  const body = params.get('body');
  assert.equal(params.get('subject'), 'Coach Intel Feedback: Sidebar collapse crashes');

  const expectedOrder = [
    'Category: Bug',
    'Subject: Sidebar collapse crashes',
    'User: Coach Nova',
    'Team: Naevii Black',
    'Organization: Naevii',
    'Page: team-hub',
    'App Version: 0.8.1',
    'Platform: macOS',
    'Timestamp: 2026-08-19T12:00:00.000Z',
    'Feedback:',
    'It crashed when I collapsed the sidebar.',
  ];
  let cursor = -1;
  for (const line of expectedOrder) {
    const idx = body.indexOf(line);
    assert.ok(idx > cursor, `expected "${line}" after position ${cursor}, found at ${idx}`);
    cursor = idx;
  }
});

test('missing optional fields render as blank, not the string "undefined"', () => {
  const url = buildFeedbackMailto({ description: 'Just a description.' });
  const body = new URLSearchParams(url.slice(url.indexOf('?') + 1)).get('body');
  assert.equal(body.includes('undefined'), false);
  assert.match(body, /Feedback:\nJust a description\./);
});

test('spaces are percent-encoded, not left as a literal "+" (mailto bodies do not treat + as space)', () => {
  const url = buildFeedbackMailto({ subject: 'two words', description: 'more words here' });
  assert.equal(url.includes('+'), false);
});
