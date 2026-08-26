'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { canAccessPage, canEdit, isPlayer, landingPath } from '../lib/access';
import { pageFromPath } from '../lib/nav';

export function PageGuard({ role }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    document.body.classList.toggle('access-readonly', !canEdit(role));
    const page = pageFromPath(pathname);
    if (!page || canAccessPage(role, page)) return;
    const dest = isPlayer(role) ? landingPath(role) : '/dashboard';
    if (pathname !== dest) router.replace(dest);
  }, [pathname, role, router]);

  return null;
}
