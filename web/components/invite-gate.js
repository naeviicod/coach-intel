import { DiscordSignIn } from './discord-sign-in';
import { LookSync } from './look-sync';
import { Pit } from './pit';
import { OrgMark, TeamMark } from '../lib/marks';
import { inviteChips, inviteCopy, inviteVisual, accessRoleLabel, rosterSlotLabel } from '../lib/invite';

export function InviteGate({ error, nextPath = '/dashboard', invite = null }) {
  const who = String(invite?.gamertag || invite?.member_name || '').trim();
  const copy = inviteCopy(invite);
  const look = invite ? inviteVisual(invite) : null;
  const team = look?.teamName || 'Your team';
  const chips = invite
    ? inviteChips({
      team,
      playRole: invite.play_role,
      slot: invite.slot,
      accessRole: invite.access_role,
    })
    : [];
  const fallback = invite ? accessRoleLabel(invite.access_role) : '';
  const slot = invite ? rosterSlotLabel(invite.slot) : '';
  const playerChips = [...new Set([
    look?.teamTag || team,
    slot,
    String(invite?.play_role || '').trim(),
    fallback && fallback !== 'Player' ? fallback : '',
  ].filter(Boolean))];

  return (
    <div className="gate invite-gate">
      <Pit />
      {look?.accent ? <LookSync accent={look.accent} /> : null}
      <main className="onboarding-screen signin-screen gate-in">
        <div className="signin-brief">
          <div className="signin-kicker">{who && !error ? copy.kicker : 'Secure channel'}</div>
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
            <div className="card inline-error" style={{ maxWidth: 400 }}>
              <div className="inline-error-title">{invite ? 'Could not accept that invite' : 'This invite is not valid'}</div>
              <div>{error}</div>
            </div>
          ) : null}
          {who && !error && look ? (
            <article className="invite-pass">
              <div className="invite-pass-org">
                <OrgMark org={{ logo: look.orgLogo, name: look.orgName }} className="invite-org-mark" />
                <div>
                  <div className="invite-pass-kicker">Organization</div>
                  <div className="invite-pass-name">{look.orgName}</div>
                </div>
              </div>
              <div className="invite-pass-team">
                <TeamMark
                  team={{ logo: look.teamLogo, name: look.teamName, tag: look.teamTag }}
                  className="invite-team-mark"
                />
                <div>
                  <div className="invite-pass-kicker">{look.teamTag || 'Team'}</div>
                  <div className="invite-pass-name">{look.teamName}</div>
                  {slot ? <div className="invite-pass-tag">{slot}</div> : null}
                </div>
              </div>
              <div className="invite-pass-player">
                <div>
                  <div className="invite-pass-kicker">Join as</div>
                  <div className="invite-player-tag">{who}</div>
                  {playerChips.length ? (
                    <div className="invite-player-chips">
                      {playerChips.map((chip) => <span key={chip}>{chip}</span>)}
                    </div>
                  ) : chips.length ? (
                    <div className="invite-pass-tag">{chips.join(' · ')}</div>
                  ) : null}
                </div>
              </div>
              <p className="invite-pass-welcome">{copy.body}</p>
              <p className="invite-pass-hint">
                Sign in with Discord to link this roster slot. You can change your profile later in Settings.
              </p>
            </article>
          ) : null}
          <DiscordSignIn nextPath={nextPath} />
          <div className="signin-foot">Opens Discord. You land in the app.</div>
        </div>
      </main>
    </div>
  );
}
