const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('node:url');

const libUrl = (name) => pathToFileURL(path.join(__dirname, '..', 'src', 'renderer', 'lib', name)).href;

test('subject and description are required', async () => {
  const { validateFeedback } = await import(libUrl('feedback.js'));
  assert.equal(validateFeedback({ subject: '', description: 'x' }).ok, false);
  assert.equal(validateFeedback({ subject: 'x', description: '' }).ok, false);
  assert.equal(validateFeedback({ subject: '   ', description: 'x' }).ok, false);
  const ok = validateFeedback({ subject: 'A bug', description: 'It broke.' });
  assert.equal(ok.ok, true);
  assert.equal(ok.entry.subject, 'A bug');
  assert.equal(ok.entry.category, 'other');
});

test('an unknown category falls back to other rather than failing validation', async () => {
  const { validateFeedback } = await import(libUrl('feedback.js'));
  const result = validateFeedback({ category: 'not-a-real-category', subject: 'x', description: 'y' });
  assert.equal(result.ok, true);
  assert.equal(result.entry.category, 'other');
});

test('free text is trimmed and length-bounded before it reaches IPC', async () => {
  const { normalizeFeedbackEntry } = await import(libUrl('feedback.js'));
  const entry = normalizeFeedbackEntry({ subject: '  padded  ', description: 'x'.repeat(9000) });
  assert.equal(entry.subject, 'padded');
  assert.equal(entry.description.length, 8000);
});

test('every category has a label, and unknown values fall back to Other', async () => {
  const { FEEDBACK_CATEGORIES, feedbackCategoryLabel } = await import(libUrl('feedback.js'));
  assert.equal(FEEDBACK_CATEGORIES.length, 7);
  assert.equal(feedbackCategoryLabel('bug'), 'Bug');
  assert.equal(feedbackCategoryLabel('nonsense'), 'Other');
});
