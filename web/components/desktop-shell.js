import { DesktopNav } from './desktop-nav';

export function DesktopShell({ userLabel, role, teams, children }) {
  return (
    <div className="desk-shell">
      <DesktopNav teams={teams} />
      <div className="desk-main">
        <header className="desk-topbar">
          <input className="desk-search" type="search" placeholder="Search players, teams, maps, matches, intel..." readOnly />
          <span className="desk-online">Online · Synced</span>
          <div className="desk-user">
            <strong>{userLabel}</strong>
            <span>{role || 'member'}</span>
          </div>
          <form action="/auth/sign-out" method="post">
            <button type="submit" className="text-link">
              Sign out
            </button>
          </form>
        </header>
        <div className="desk-content">{children}</div>
        <footer className="desk-status">
          <span>Ruleset · Black Ops 7</span>
          <span className="desk-ok">All systems operational</span>
          <span>v1.5.4</span>
        </footer>
      </div>
    </div>
  );
}
