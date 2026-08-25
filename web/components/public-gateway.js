import { DiscordSignIn } from './discord-sign-in';
import { Pit } from './pit';
import { SplashLockup } from './splash-lockup';

export function PublicGateway({ error, nextPath = '/dashboard' }) {
  return (
    <div className="gate">
      <Pit />
      <main className="stage">
        <SplashLockup />
        {error ? <p className="auth-error">{error}</p> : null}
        <div className="actions">
          <DiscordSignIn nextPath={nextPath} />
        </div>
      </main>
    </div>
  );
}
