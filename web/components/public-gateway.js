import { DiscordSignIn } from './discord-sign-in';
import { Pit } from './pit';

export function PublicGateway({ error, nextPath = '/dashboard', invite = null }) {
  return (
    <div className="gate">
      <Pit />
      <main className="onboarding-screen signin-screen gate-in">
        <div className="signin-brief">
          <div className="signin-kicker">Secure channel</div>
          <div className="signin-identity">
            <div className="signin-lockup">
              <img className="signin-mark" src="/assets/splash-logo.webp" alt="Coach Intel" />
              <img className="signin-wordmark" src="/assets/splash-wordmark.webp" alt="" aria-hidden="true" />
            </div>
          </div>
          {invite ? (
            <p className="invite-note">
              Join as {invite.gamertag}
              {invite.team_name ? ` · ${invite.team_name}` : ''}
            </p>
          ) : null}
          {error ? <p className="auth-error">{error}</p> : null}
          <DiscordSignIn nextPath={nextPath} />
        </div>
      </main>
    </div>
  );
}
