export default function Page() {
  return (
    <>
      <div className="pit" aria-hidden="true">
        <img className="pit-art" src="/assets/splash-background.png" alt="" />
        <span className="pit-glow" />
      </div>
      <main className="stage">
        <div className="lockup">
          <div className="lockup-mark">
            <img src="/assets/splash-logo.png" alt="Coach Intel" />
          </div>
          <div className="lockup-copy">
            <div className="wordmark-frame">
              <img className="wordmark" src="/assets/splash-wordmark.png" alt="Coach Intel" />
            </div>
            <div className="slogan-frame">
              <img className="slogan" src="/assets/splash-slogan.png" alt="Competitive Intelligence for Call of Duty" />
            </div>
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
