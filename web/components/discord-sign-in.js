'use client';

import { createBrowserSupabase } from '../lib/supabase/browser';

export function DiscordSignIn({ nextPath = '/dashboard' }) {
  async function signIn() {
    const supabase = createBrowserSupabase();
    const origin = window.location.origin;
    const next = nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/dashboard';
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `ci-auth-next=${encodeURIComponent(next)}; Path=/; Max-Age=600; SameSite=Lax${secure}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: `${origin}/auth/callback`,
      },
    });
    if (error) {
      window.location.href = `/sign-in?error=${encodeURIComponent(error.message)}`;
    }
  }

  return (
    <button type="button" className="btn primary signin-discord" onClick={signIn}>
      Sign in with Discord
    </button>
  );
}
