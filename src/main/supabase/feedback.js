// User-submitted feedback (bug reports, feature requests, etc).
// RLS on the `feedback` table (see scripts/supabase/schema.sql) is what actually
// enforces that a user can only insert their own row and only ever read their
// own submissions (staff can read all, to triage) — this module just calls the
// table through the signed-in user's own session.

function createFeedbackService({ client }) {
  function requireClient() {
    if (!client) throw new Error('Supabase is not configured yet — see src/main/supabase/config.js');
    return client;
  }

  async function submit(entry) {
    const c = requireClient();
    const { data: sessionData } = await c.auth.getSession();
    const userId = sessionData?.session?.user?.id || null;
    if (!userId) throw new Error('Sign in to send feedback this way.');

    const row = {
      user_id: userId,
      team_id: entry?.teamId || null,
      category: entry?.category || 'other',
      subject: entry?.subject || '',
      description: entry?.description || '',
      contact_email: entry?.contactEmail || null,
      page: entry?.page || null,
      app_version: entry?.appVersion || null,
      platform: entry?.platform || null,
    };
    const { data, error } = await c.from('feedback').insert(row).select().single();
    if (error) throw error;
    return data;
  }

  return { submit };
}

module.exports = { createFeedbackService };
