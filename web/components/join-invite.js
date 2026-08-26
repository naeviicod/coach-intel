import { redirect } from 'next/navigation';
import { InviteGate } from './invite-gate';
import { ensureProfile } from '../lib/data';
import { inviteeSlug, previewInvite, redeemInvite } from '../lib/invite';
import { createServerSupabase, getSessionUser } from '../lib/supabase/server';

export async function JoinInvite({ token }) {
  const inviteToken = decodeURIComponent(String(token || ''));
  const supabase = await createServerSupabase();
  const preview = await previewInvite(supabase, inviteToken);
  const user = await getSessionUser();

  if (user && preview?.ok) {
    await ensureProfile(supabase).catch(() => null);
    const redeemed = await redeemInvite(supabase, inviteToken);
    if (redeemed?.ok) redirect('/dashboard');
    return <InviteGate error={redeemed?.error || 'Could not accept that invite.'} invite={preview} />;
  }

  if (!preview?.ok) {
    return <InviteGate error={preview?.error || 'Invite not found.'} />;
  }

  const slug = inviteeSlug(preview.gamertag);
  return (
    <InviteGate
      invite={preview}
      nextPath={`/join/${slug}/${inviteToken}`}
    />
  );
}
