'use client';

import { createBrowserSupabase } from '../lib/supabase/browser';

export function DiscordSignIn({ nextPath = '/dashboard' }) {
  async function signIn() {
    const supabase = createBrowserSupabase();
    const origin = window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });
    if (error) {
      window.location.href = `/sign-in?error=${encodeURIComponent(error.message)}`;
    }
  }

  return (
    <button type="button" className="btn btn-primary" onClick={signIn}>
      Continue with Discord
    </button>
  );
}
