export function BrandLockup({ compact = false }) {
  return (
    <span className={compact ? 'brand-lockup brand-lockup-compact' : 'brand-lockup'}>
      <img className="brand-mark" src="/assets/splash-logo.png" alt="" />
      <span className="brand-copy">
        <img className="brand-wordmark" src="/assets/splash-wordmark.png" alt="Coach Intel" />
      </span>
    </span>
  );
}
