const { shell } = require('electron');

// Must also be added under Authentication -> URL Configuration -> Redirect URLs
// in the Supabase dashboard, or Supabase will refuse to redirect back here.
const REDIRECT_TO = 'coachintel://auth-callback';

function createAuthService({ client }) {
  async function signInWithDiscord() {
    if (!client) {
      throw new Error('Supabase is not configured yet — paste the project URL and anon key into src/main/supabase/config.js');
    }
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: REDIRECT_TO, skipBrowserRedirect: true },
    });
    if (error) throw error;
    await shell.openExternal(data.url);
    return true;
  }

  // Called with the full coachintel://auth-callback?code=... URL once Electron
  // routes it back in from the system browser.
  async function handleCallback(url) {
    if (!client) return null;
    const parsed = new URL(url);
    const code = parsed.searchParams.get('code');
    if (!code) {
      const description = parsed.searchParams.get('error_description');
      if (description) throw new Error(description);
      return null;
    }
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return data.session;
  }

  async function getSession() {
    if (!client) return null;
    const { data } = await client.auth.getSession();
    return data.session;
  }

  async function signOut() {
    if (!client) return;
    await client.auth.signOut();
  }

  function onAuthStateChange(callback) {
    if (!client) return () => {};
    const { data } = client.auth.onAuthStateChange((_event, session) => callback(session));
    return () => data.subscription.unsubscribe();
  }

  return { signInWithDiscord, handleCallback, getSession, signOut, onAuthStateChange };
}

module.exports = { createAuthService, REDIRECT_TO };
