import { previewJoinUrl } from '../../../lib/invite';
import { inviteEmailSubject, renderInviteEmail } from '../../../lib/invite-email';
import { loadInviteFromApp } from '../../../lib/app-invite';
import { markSrc } from '../../../lib/marks';
import { createServerSupabase } from '../../../lib/supabase/server';

export const metadata = { title: 'Invite email · Coach Intel' };

export default async function InviteEmailPreviewPage({ searchParams }) {
  const params = await searchParams;
  const who = String(params?.who || 'NaeviiSZN').trim() || 'NaeviiSZN';
  const supabase = await createServerSupabase();
  const invite = await loadInviteFromApp(supabase, {
    who,
    email: 'ion@ikstudios.nl',
  });
  const sample = {
    who: invite.gamertag,
    email: invite.invitee_email,
    org: invite.org_name,
    team: invite.team_name,
    role: invite.access_role,
    playRole: invite.play_role,
    slot: invite.slot,
    url: previewJoinUrl(invite.gamertag),
    accent: invite.accent,
    ciLogoSrc: '/assets/splash-logo.webp',
    wordmarkSrc: '/assets/splash-wordmark.webp',
    orgLogoSrc: markSrc(invite.org_logo),
    teamLogoSrc: markSrc(invite.team_logo),
  };
  const html = renderInviteEmail(sample);
  const subject = inviteEmailSubject(sample);

  return (
    <div className="mail-preview">
      <div className="mail-chrome">
        <p className="mail-kicker">Sample inbox view</p>
        <p className="mail-row"><span>From</span> Coach Intel &lt;coach@championshipseries.eu&gt;</p>
        <p className="mail-row"><span>To</span> {invite.gamertag} &lt;{invite.invitee_email}&gt;</p>
        <p className="mail-row"><span>Subject</span> {subject}</p>
      </div>
      <iframe
        title="Coach Intel invite email"
        className="mail-frame"
        srcDoc={html}
      />
    </div>
  );
}
