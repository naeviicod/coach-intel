'use client';

import { useState } from 'react';

export function CopyJoinAlias() {
  const [label, setLabel] = useState('Copy join link');
  const url = 'https://coach.championshipseries.eu/join';

  async function copy() {
    await navigator.clipboard.writeText(url);
    setLabel('Copied');
    window.setTimeout(() => setLabel('Copy join link'), 1600);
  }

  return (
    <button type="button" className="text-link" onClick={copy}>
      {label}
    </button>
  );
}
