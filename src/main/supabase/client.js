const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL, SUPABASE_ANON_KEY } = require('./config');

function isConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

// PKCE flow is what lets a desktop app finish sign-in with exchangeCodeForSession
// after the system browser redirects back via coachintel://auth-callback.
function createSupabaseClient(sessionStore) {
  if (!isConfigured()) return null;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: sessionStore,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });
}

module.exports = { createSupabaseClient, isConfigured };
