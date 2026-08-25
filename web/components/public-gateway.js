import Link from 'next/link';
import { BrandLockup } from './brand-lockup';

export function PublicGateway() {
  return (
    <div className="gateway">
      <div className="pit" aria-hidden="true">
        <img className="pit-art" src="/assets/splash-background.png" alt="" />
        <span className="pit-veil" />
      </div>

      <header className="gateway-header">
        <Link href="/" className="gateway-brand" aria-label="Coach Intel">
          <BrandLockup compact />
        </Link>
        <nav className="gateway-nav" aria-label="Account">
          <Link href="/sign-in" className="btn btn-ghost">
            Sign in
          </Link>
          <Link href="/sign-in" className="btn btn-primary">
            Continue with Discord
          </Link>
        </nav>
      </header>

      <section className="gateway-content">
        <div className="gateway-copy">
          <p className="eyebrow">Competitive intelligence · Call of Duty</p>
          <h1>
            <span>Know more.</span>
            <span>Win more.</span>
          </h1>
          <p className="lead">
            Coach Intel is the org intelligence layer for competitive teams — roster, prep,
            and the same cloud data you already use on the desktop.
          </p>
          <dl className="facts">
            <div>
              <dt>Access</dt>
              <dd>Discord sign-in</dd>
            </div>
            <div>
              <dt>Data</dt>
              <dd>Shared org roster</dd>
            </div>
            <div>
              <dt>Platform</dt>
              <dd>Web and desktop</dd>
            </div>
          </dl>
          <div className="gateway-actions">
            <Link href="/sign-in" className="btn btn-primary">
              Sign in
            </Link>
            <a className="text-link" href="https://www.championshipseries.eu/">
              European Championship Series
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
