import { redirect } from 'next/navigation';
import { InviteGate } from '../../../components/invite-gate';
import { previewInvite, redeemInvite } from '../../../lib/invite';
import { createServerSupabase, getSessionUser } from '../../../lib/supabase/server';

export const metadata = { title: 'Join · Coach Intel' };

export default async function JoinTokenPage({ params }) {
  const { token } = await params;
  const inviteToken = decodeURIComponent(token);
  const supabase = await createServerSupabase();
  const preview = await previewInvite(supabase, inviteToken);
  const user = await getSessionUser();

  if (user && preview?.ok) {
    const redeemed = await redeemInvite(supabase, inviteToken);
    if (redeemed?.ok) redirect('/dashboard');
    return <InviteGate error={redeemed?.error || 'Could not accept that invite.'} />;
  }

  if (!preview?.ok) {
    return <InviteGate error={preview?.error || 'Invite not found.'} />;
  }

  return (
    <InviteGate
      invite={preview}
      nextPath={`/join/${encodeURIComponent(inviteToken)}`}
    />
  );
}
