const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL, SUPABASE_ANON_KEY } = require('./config');

function websocketTransport() {
  if (typeof globalThis.WebSocket === 'function') return globalThis.WebSocket;
  try {
    return require('ws');
  } catch {
    return null;
  }
}

function isConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

// PKCE flow is what lets a desktop app finish sign-in with exchangeCodeForSession
// after the system browser redirects back via coachintel://auth-callback.
function createSupabaseClient(sessionStore) {
  if (!isConfigured()) return null;
  const transport = websocketTransport();
  try {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: sessionStore,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
      realtime: transport ? { transport } : {},
    });
  } catch (err) {
    console.error('[supabase] client init failed', err);
    return null;
  }
}

module.exports = { createSupabaseClient, isConfigured };
