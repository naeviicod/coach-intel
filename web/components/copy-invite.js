'use client';

import { useState } from 'react';

export function CopyInvite({ teamId, memberId, accessRole, linked }) {
  const [label, setLabel] = useState(linked ? 'Copy new invite' : 'Copy invite');
  const [email, setEmail] = useState('');

  async function copy() {
    setLabel('Copying…');
    const response = await fetch('/api/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId, memberId, accessRole, email }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.url) {
      setLabel(data.error || 'Could not copy');
      return;
    }
    await navigator.clipboard.writeText(data.url);
    setLabel('Copied');
    window.setTimeout(() => setLabel(linked ? 'Copy new invite' : 'Copy invite'), 1600);
  }

  return (
    <span className="copy-invite">
      <input
        type="email"
        className="copy-invite-email"
        placeholder="email (optional)"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="off"
      />
      <button type="button" className="btn sm" onClick={copy}>
        {label}
      </button>
    </span>
  );
}
