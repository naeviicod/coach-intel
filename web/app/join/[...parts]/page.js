import { InviteGate } from '../../../components/invite-gate';
import { JoinInvite } from '../../../components/join-invite';
import { loadInviteFromApp } from '../../../lib/app-invite';
import { createServerSupabase } from '../../../lib/supabase/server';

export const metadata = { title: 'Join · Coach Intel' };

export default async function JoinPartsPage({ params }) {
  const { parts } = await params;
  const segments = Array.isArray(parts) ? parts : [parts];
  const token = segments.length >= 2 ? segments[1] : segments[0];
  if (String(token || '') === 'preview' || String(segments[0] || '') === 'preview') {
    const supabase = await createServerSupabase();
    const slug = String(segments[0] || '');
    const who = slug && slug !== 'preview' ? slug : undefined;
    const invite = await loadInviteFromApp(supabase, who ? { who } : {});
    return <InviteGate invite={invite} nextPath="/dashboard" />;
  }
  return <JoinInvite token={token} />;
}
