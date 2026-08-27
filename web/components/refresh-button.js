'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icon } from './icon';

export function RefreshButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch('/api/revalidate', { method: 'POST', cache: 'no-store' }).catch(() => null);
      router.refresh();
    } finally {
      window.setTimeout(() => setBusy(false), 700);
    }
  }

  return (
    <button
      type="button"
      className={`btn refresh-btn${busy ? ' is-busy' : ''}`}
      title="Pull the latest photos, roster, plans, and calendar from the org"
      aria-label="Refresh org data"
      onClick={run}
      disabled={busy}
    >
      <span className={`icon refresh-icon${busy ? ' is-spinning' : ''}`}>
        <Icon name="refresh" size={11} />
      </span>
      <span className="refresh-label">{busy ? 'Refreshing' : 'Refresh'}</span>
    </button>
  );
}
