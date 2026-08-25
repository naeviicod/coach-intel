'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_GROUPS, SETTINGS_ITEM } from '../lib/nav';

function active(pathname, href) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DesktopNav({ teams }) {
  const pathname = usePathname();
  const firstTeam = teams[0]?.id;

  return (
    <aside className="desk-nav">
      <Link href="/dashboard" className="desk-brand" aria-label="Coach Intel">
        <img src="/assets/splash-logo.png" alt="" />
        <img src="/assets/splash-wordmark.png" alt="Coach Intel" />
      </Link>
      <div className="desk-nav-scroll">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="desk-group">
            <p className="desk-group-label">{group.label}</p>
            {group.items.map((item) => {
              const href =
                item.page === 'team-hub' && firstTeam
                  ? `/teams/${encodeURIComponent(firstTeam)}`
                  : item.href;
              return (
                <Link
                  key={item.page}
                  href={href}
                  className={`desk-link${active(pathname, item.href) || (item.page === 'team-hub' && pathname.startsWith('/teams/')) ? ' active' : ''}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
      <div className="desk-nav-foot">
        <Link
          href={SETTINGS_ITEM.href}
          className={`desk-link${active(pathname, SETTINGS_ITEM.href) ? ' active' : ''}`}
        >
          {SETTINGS_ITEM.label}
        </Link>
      </div>
    </aside>
  );
}
