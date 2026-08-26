'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { createBrowserSupabase } from '../lib/supabase/browser';

const TABLES = ['teams', 'members', 'profiles', 'shared_docs'];

export function OrgLiveSync() {
  const router = useRouter();
  const timer = useRef(null);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    const pull = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => router.refresh(), 400);
    };
    let channel = supabase.channel('org-live');
    for (const table of TABLES) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, pull);
    }
    channel.subscribe();
    return () => {
      window.clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
