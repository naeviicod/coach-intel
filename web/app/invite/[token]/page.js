import { redirect } from 'next/navigation';
import { PublicGateway } from '../../../components/public-gateway';
import { previewInvite, redeemInvite } from '../../../lib/invite';
import { createServerSupabase, getSessionUser } from '../../../lib/supabase/server';

export const metadata = { title: 'Invite · Coach Intel' };

export default async function InvitePage({ params }) {
  const { token } = await params;
  const inviteToken = decodeURIComponent(token);
  const supabase = await createServerSupabase();
  const preview = await previewInvite(supabase, inviteToken);
  const user = await getSessionUser();

  if (user && preview?.ok) {
    const redeemed = await redeemInvite(supabase, inviteToken);
    if (redeemed?.ok) redirect('/dashboard');
    return <PublicGateway error={redeemed?.error || 'Could not accept that invite.'} />;
  }

  if (!preview?.ok) {
    return <PublicGateway error={preview?.error || 'Invite not found.'} />;
  }

  return (
    <PublicGateway
      invite={preview}
      nextPath={`/invite/${encodeURIComponent(inviteToken)}`}
    />
  );
}
