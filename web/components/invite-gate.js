import { DiscordSignIn } from './discord-sign-in';
import { Pit } from './pit';
import { SplashLockup } from './splash-lockup';
import { accessRoleLabel } from '../lib/invite';

export function InviteGate({ error, nextPath = '/dashboard', invite = null }) {
  return (
    <div className="gate">
      <Pit />
      <main className="stage">
        <SplashLockup />
        <div className="invite-card">
          <p className="invite-kicker">{invite ? 'You are invited' : 'Join Coach Intel'}</p>
          <h1>{invite ? invite.gamertag : 'Sign in to the org'}</h1>
          <p className="invite-meta">
            {invite
              ? [invite.team_name, accessRoleLabel(invite.access_role)].filter(Boolean).join(' · ')
              : 'Use the same Discord account the org already knows. No desktop app required.'}
          </p>
          {error ? <p className="auth-error">{error}</p> : null}
          <div className="actions">
            <DiscordSignIn nextPath={nextPath} />
          </div>
        </div>
      </main>
    </div>
  );
}
