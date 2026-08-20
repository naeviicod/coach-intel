// Builds the mailto: fallback used when a feedback entry cannot be (or wasn't)
// saved to Supabase — e.g. signed out, offline, or the table isn't migrated yet.
// The recipient is fixed here, never taken from the renderer, so nothing IPC-side
// can redirect where feedback goes.

const FEEDBACK_EMAIL = 'feedback@ikstudios.nl';

function buildFeedbackMailto(entry = {}) {
  const subjectLine = `Coach Intel Feedback: ${entry.subject || entry.categoryLabel || 'General'}`;
  const body = [
    'Coach Intel Feedback',
    '',
    `Category: ${entry.categoryLabel || entry.category || ''}`,
    `Subject: ${entry.subject || ''}`,
    `User: ${entry.userLabel || ''}`,
    `Team: ${entry.teamLabel || ''}`,
    `Organization: ${entry.orgLabel || ''}`,
    `Page: ${entry.page || ''}`,
    `App Version: ${entry.appVersion || ''}`,
    `Platform: ${entry.platform || ''}`,
    `Timestamp: ${entry.timestamp || new Date().toISOString()}`,
    '',
    'Feedback:',
    entry.description || '',
  ].join('\n');

  const params = new URLSearchParams({ subject: subjectLine, body });
  return `mailto:${FEEDBACK_EMAIL}?${params.toString().replace(/\+/g, '%20')}`;
}

module.exports = { FEEDBACK_EMAIL, buildFeedbackMailto };
