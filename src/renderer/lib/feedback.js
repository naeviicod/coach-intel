// Pure helpers for the Feedback modal — kept free of DOM/IPC so they're testable
// the same way lib/access.js and lib/invite.js are.

export const FEEDBACK_CATEGORIES = [
  { value: 'bug', label: 'Bug' },
  { value: 'incorrect_data', label: 'Incorrect Data' },
  { value: 'ui_ux', label: 'UI / UX' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'performance', label: 'Performance' },
  { value: 'strategy_map_data', label: 'Strategy / Map Data' },
  { value: 'other', label: 'Other' },
];

export function feedbackCategoryLabel(value) {
  return FEEDBACK_CATEGORIES.find((c) => c.value === value)?.label || 'Other';
}

const SUBJECT_MAX = 200;
const DESCRIPTION_MAX = 8000;

// Trims and bounds free text before it ever reaches IPC — the table has no
// length constraint, so this is the only thing stopping an accidental
// multi-megabyte paste from becoming a row.
export function normalizeFeedbackEntry(entry = {}) {
  return {
    category: FEEDBACK_CATEGORIES.some((c) => c.value === entry.category) ? entry.category : 'other',
    subject: String(entry.subject || '').trim().slice(0, SUBJECT_MAX),
    description: String(entry.description || '').trim().slice(0, DESCRIPTION_MAX),
    contactEmail: String(entry.contactEmail || '').trim(),
    page: entry.page || null,
    appVersion: entry.appVersion || null,
    platform: entry.platform || null,
    teamId: entry.teamId || null,
  };
}

export function validateFeedback(entry) {
  const clean = normalizeFeedbackEntry(entry);
  if (!clean.subject) return { ok: false, error: 'Add a short subject.', field: 'subject' };
  if (!clean.description) return { ok: false, error: 'Add a description.', field: 'description' };
  return { ok: true, entry: clean };
}
