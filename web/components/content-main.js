'use client';

import { usePathname } from 'next/navigation';
import { isTeamHubPath } from '../lib/hub';

export function ContentMain({ children }) {
  const pathname = usePathname() || '';
  const flush = isTeamHubPath(pathname) || pathname === '/playbooks' || pathname.startsWith('/playbooks/');
  return (
    <main id="content" className={flush ? 'flush' : undefined}>
      {flush ? <div className="page-root">{children}</div> : children}
    </main>
  );
}
