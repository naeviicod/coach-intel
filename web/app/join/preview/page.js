import { InviteGate } from '../../../components/invite-gate';
import { loadInviteFromApp } from '../../../lib/app-invite';
import { createServerSupabase } from '../../../lib/supabase/server';

export const metadata = { title: 'Join · Coach Intel' };

export default async function JoinPreviewPage() {
  const supabase = await createServerSupabase();
  const invite = await loadInviteFromApp(supabase);
  return <InviteGate invite={invite} nextPath="/dashboard" />;
}
