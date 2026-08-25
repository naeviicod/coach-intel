export function SplashLockup() {
  return (
    <div className="lockup">
      <div className="lockup-mark">
        <img src="/assets/splash-logo.png" alt="Coach Intel logo" />
      </div>
      <div className="lockup-copy">
        <div className="wordmark-frame">
          <img className="wordmark" src="/assets/splash-wordmark.png" alt="Coach Intel" />
        </div>
        <div className="slogan-frame">
          <img
            className="slogan"
            src="/assets/splash-slogan.png"
            alt="Competitive Intelligence for Call of Duty"
          />
        </div>
      </div>
    </div>
  );
}
