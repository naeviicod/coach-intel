import { NextResponse } from 'next/server';
import { createMemberInvite, STAFF_INVITE_ROLES, suggestedAccessRole } from '../../../lib/invite';
import { createServerSupabase, getSessionUser } from '../../../lib/supabase/server';
import { getProfile } from '../../../lib/data';

export async function POST(request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const supabase = await createServerSupabase();
  const profile = await getProfile(supabase, user.id);
  if (!STAFF_INVITE_ROLES.has(profile?.role)) {
    return NextResponse.json({ error: 'Only staff can create invites.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const teamId = String(body.teamId || '');
  const memberId = String(body.memberId || '');
  if (!teamId || !memberId) {
    return NextResponse.json({ error: 'Missing team or member.' }, { status: 400 });
  }

  const { data: member } = await supabase
    .from('members')
    .select('id, title')
    .eq('team_id', teamId)
    .eq('id', memberId)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: 'Member not found.' }, { status: 404 });

  try {
    const invite = await createMemberInvite(supabase, {
      teamId,
      memberId,
      accessRole: body.accessRole || suggestedAccessRole(member),
      email: body.email,
    });
    return NextResponse.json({ url: invite.url });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Could not create invite.' }, { status: 400 });
  }
}
