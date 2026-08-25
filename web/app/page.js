export default function Page() {
  return (
    <>
      <div className="pit" aria-hidden="true" />
      <main className="stage">
        <div className="lockup">
          <span className="ci-lockup" role="img" aria-label="Coach Intel">
            <img className="ci-lockup-base" src="/assets/logo-mark-base.png" alt="" />
            <span className="ci-lockup-accent" aria-hidden="true" />
          </span>
          <div className="lockup-copy">
            <img className="wordmark" src="/assets/wordmark.png" alt="Coach Intel" />
            <img className="slogan" src="/assets/slogan.png" alt="Competitive Intelligence for Call of Duty" />
          </div>
        </div>
        <p className="line">Know More. Win More.</p>
        <div className="actions">
          <a className="btn btn-primary" href="coachintel://">
            Open Coach Intel
          </a>
        </div>
        <p className="hint">
          Opens the app already installed on this computer.
          If nothing happens, install Coach Intel and try again.
        </p>
        <a className="ecs" href="https://www.championshipseries.eu/">
          European Championship Series
        </a>
      </main>
    </>
  );
}
