import Link from 'next/link';
import { BrandLockup } from './brand-lockup';

export function AppShell({ userLabel, teams, children }) {
  return (
    <div className="app-shell">
      <aside className="app-nav">
        <Link href="/dashboard" className="app-brand" aria-label="Coach Intel">
          <BrandLockup compact />
        </Link>
        <nav>
          <Link href="/dashboard">Dashboard</Link>
          <p className="nav-label">Teams</p>
          {teams.length === 0 ? (
            <p className="nav-empty">No teams yet</p>
          ) : (
            teams.map((team) => (
              <Link key={team.id} href={`/teams/${encodeURIComponent(team.id)}`}>
                {team.tag ? `${team.tag} · ${team.name}` : team.name}
              </Link>
            ))
          )}
        </nav>
        <div className="app-nav-foot">
          <p className="nav-user">{userLabel}</p>
          <form action="/auth/sign-out" method="post">
            <button type="submit" className="text-link">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="app-main">{children}</main>
    </div>
  );
}
