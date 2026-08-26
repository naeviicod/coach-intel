import { NextResponse } from 'next/server';
import { createMemberInvite, STAFF_INVITE_ROLES, suggestedAccessRole } from '../../../lib/invite';
import { canEditTeam, resolveAccessRole } from '../../../lib/access';
import { createServerSupabase, getSessionUser } from '../../../lib/supabase/server';
import { getProfile } from '../../../lib/data';

export async function POST(request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const supabase = await createServerSupabase();
  const profile = await getProfile(supabase, user.id);
  const { data: linked } = await supabase
    .from('members')
    .select('team_id, gamertag, name')
    .eq('user_id', user.id);
  const teamIds = (linked || []).map((row) => row.team_id).filter(Boolean);
  const role = resolveAccessRole(profile, {
    names: [profile?.discord_username, profile?.display_name, ...(linked || []).flatMap((row) => [row.gamertag, row.name])],
  });
  if (!STAFF_INVITE_ROLES.has(role)) {
    return NextResponse.json({ error: 'Only staff can create invites.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const teamId = String(body.teamId || '');
  const memberId = String(body.memberId || '');
  if (!teamId || !memberId) {
    return NextResponse.json({ error: 'Missing team or member.' }, { status: 400 });
  }
  if (!canEditTeam(role, teamId, { teamIds })) {
    return NextResponse.json({ error: 'You can only invite people to your own team.' }, { status: 403 });
  }

  const { data: member } = await supabase
    .from('members')
    .select('id, title, gamertag, slot')
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
      gamertag: body.gamertag || member.gamertag,
    });
    return NextResponse.json({ url: invite.url });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Could not create invite.' }, { status: 400 });
  }
}
