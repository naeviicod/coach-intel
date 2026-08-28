'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { APP_PREFIXES } from '../lib/nav';
import { createBrowserSupabase } from '../lib/supabase/browser';

const TABLES = ['teams', 'members', 'profiles', 'shared_docs'];

export function OrgLiveSync() {
  const router = useRouter();
  const timer = useRef(null);

  useEffect(() => {
    // First paint can still be a stale empty RSC payload from the client
    // router cache. Pull once on mount so a poisoned "0 teams" page does not
    // sit there until someone clicks + Add Team.
    fetch('/api/revalidate', { method: 'POST', cache: 'no-store' }).catch(() => null);
    router.refresh();
    const supabase = createBrowserSupabase();
    const pull = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        fetch('/api/revalidate', { method: 'POST', cache: 'no-store' }).catch(() => null);
        router.refresh();
      }, 400);
    };
    let channel = supabase.channel('org-live');
    for (const table of TABLES) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, pull);
    }
    channel.subscribe();
    APP_PREFIXES.forEach((href, i) => {
      window.setTimeout(() => router.prefetch(href), 400 + i * 90);
    });
    const tick = window.setInterval(() => router.refresh(), 60_000);
    return () => {
      window.clearTimeout(timer.current);
      window.clearInterval(tick);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
