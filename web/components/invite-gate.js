import { DiscordSignIn } from './discord-sign-in';
import { LookSync } from './look-sync';
import { Pit } from './pit';
import { inviteChips, accessRoleLabel } from '../lib/invite';

export function InviteGate({ error, nextPath = '/dashboard', invite = null }) {
  const who = String(invite?.gamertag || invite?.member_name || '').trim();
  const team = String(invite?.team_name || '').trim() || 'Your team';
  const chips = invite
    ? inviteChips({
      team,
      playRole: invite.play_role,
      slot: invite.slot,
      accessRole: invite.access_role,
    })
    : [];
  const fallback = invite ? accessRoleLabel(invite.access_role) : '';

  return (
    <div className="gate invite-gate">
      <Pit />
      {invite?.accent ? <LookSync accent={invite.accent} /> : null}
      <main className="onboarding-screen signin-screen gate-in">
        <div className="signin-identity">
          <div className="signin-lockup">
            <img className="signin-mark" src="/assets/splash-logo.png" alt="Coach Intel" />
            <img className="signin-wordmark" src="/assets/splash-wordmark.png" alt="" aria-hidden="true" />
          </div>
          <div className="signin-slogan-frame" aria-hidden="true">
            <img className="signin-slogan" src="/assets/splash-slogan.png" alt="" />
          </div>
        </div>
        {error ? (
          <div className="card inline-error" style={{ maxWidth: 360 }}>
            <div className="inline-error-title">{invite ? 'Could not accept that invite' : 'This invite is not valid'}</div>
            <div>{error}</div>
          </div>
        ) : null}
        {who && !error ? (
          <div className="card" style={{ maxWidth: 360, padding: '14px 16px' }}>
            <div className="settings-row-title">Join as {who}</div>
            <div className="field-hint" style={{ marginTop: 6, lineHeight: 1.45 }}>
              {chips.length ? `${chips.join(' · ')}. ` : fallback ? `${team} · ${fallback}. ` : ''}
              Sign in with Discord to link this roster slot. You can change your profile later in Settings.
            </div>
          </div>
        ) : null}
        <DiscordSignIn nextPath={nextPath} />
      </main>
    </div>
  );
}
