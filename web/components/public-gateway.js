import { DiscordSignIn } from './discord-sign-in';
import { Pit } from './pit';
import { SplashLockup } from './splash-lockup';

export function PublicGateway({ error, nextPath = '/dashboard', invite = null }) {
  return (
    <div className="gate">
      <Pit />
      <main className="stage signin-brief">
        <div className="signin-kicker">Secure channel</div>
        <SplashLockup />
        {invite ? (
          <p className="invite-note">
            Join as {invite.gamertag}
            {invite.team_name ? ` · ${invite.team_name}` : ''}
          </p>
        ) : null}
        {error ? <p className="auth-error">{error}</p> : null}
        <div className="actions">
          <DiscordSignIn nextPath={nextPath} />
        </div>
        <div className="signin-foot">Opens Discord. You land in the app.</div>
      </main>
    </div>
  );
}
