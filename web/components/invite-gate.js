import { DiscordSignIn } from './discord-sign-in';
import { BrandLockup } from './brand-lockup';
import { Pit } from './pit';
import { inviteCopy } from '../lib/invite';

export function InviteGate({ error, nextPath = '/dashboard', invite = null }) {
  const copy = invite
    ? inviteCopy(invite)
    : error
      ? {
          kicker: 'Join Coach Intel',
          title: 'This invite is not valid',
          body: error,
          detail: 'Ask the org for a new personal join link.',
        }
      : inviteCopy(null);

  return (
    <div className="gate invite-gate">
      <Pit />
      <main className="stage invite-stage">
        <BrandLockup compact />
        <div className="invite-card">
          {copy.kicker && copy.kicker !== 'Coach Intel' ? <p className="invite-kicker">{copy.kicker}</p> : null}
          <h1>{copy.title}</h1>
          <p className="invite-body">{copy.body}</p>
          {copy.detail ? <p className="invite-meta">{copy.detail}</p> : null}
          {error && invite ? <p className="auth-error">{error}</p> : null}
          <div className="actions">
            <DiscordSignIn nextPath={nextPath} />
          </div>
        </div>
      </main>
    </div>
  );
}
