'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { saveMember } from '../lib/docs';

function nextLineupSlot(slot) {
  return slot === 'bench' ? 'starter' : 'bench';
}

export function RosterSlotButton({ member, canEdit }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!canEdit || member?.slot === 'staff' || member?.slot === 'fa') return null;
  const onBench = member.slot === 'bench';

  async function toggle() {
    setBusy(true);
    setError('');
    try {
      await saveMember({ ...member, slot: nextLineupSlot(member.slot) });
      router.refresh();
    } catch (err) {
      setError(err.message || 'Could not update lineup.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="btn sm" disabled={busy} title={error || undefined} onClick={toggle}>
      {onBench ? 'Start' : 'Bench'}
    </button>
  );
}
