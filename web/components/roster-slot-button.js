'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveMember } from '../lib/docs';

function nextLineupSlot(slot) {
  return slot === 'bench' ? 'starter' : 'bench';
}

function groupTitle(slot) {
  return slot === 'bench' ? 'Backup / Bench' : 'Starting lineup';
}

function paintSlot(row, onBench) {
  const pill = row?.querySelector('[data-slot-pill]');
  if (!pill) return;
  pill.hidden = !onBench;
  pill.textContent = onBench ? 'Bench' : '';
}

function bumpMeta(card, fromSlot, toSlot) {
  const titles = [...(card?.querySelectorAll('.card-head .card-title') || [])];
  const bump = (title, delta) => {
    const meta = titles.find((node) => node.textContent === title)?.closest('.card-head')?.querySelector('.card-meta');
    if (!meta) return;
    meta.textContent = String(Math.max(0, Number(meta.textContent || 0) + delta));
  };
  bump(groupTitle(fromSlot), -1);
  bump(groupTitle(toSlot), 1);
}

function moveRowToGroup(row, slot) {
  const block = row.closest('.roster-block') || row;
  const card = block.closest('.card');
  if (!card) return;
  const head = [...card.querySelectorAll('.card-head .card-title')]
    .find((node) => node.textContent === groupTitle(slot))
    ?.closest('.card-head');
  if (!head) return;
  let insertAfter = head;
  let next = head.nextElementSibling;
  if (next?.classList.contains('field-hint')) {
    next.hidden = true;
    next = next.nextElementSibling;
  }
  while (next && (next.classList.contains('roster-row') || next.classList.contains('roster-block'))) {
    insertAfter = next;
    next = next.nextElementSibling;
  }
  insertAfter.after(block);
}

export function RosterSlotButton({ member, canEdit }) {
  const router = useRouter();
  const btnRef = useRef(null);
  const [slot, setSlot] = useState(member.slot);
  const [error, setError] = useState('');
  if (!canEdit || member?.slot === 'staff' || member?.slot === 'fa') return null;
  const onBench = slot === 'bench';

  function toggle() {
    const previous = slot;
    const next = nextLineupSlot(previous);
    const row = btnRef.current?.closest('.roster-row');
    setSlot(next);
    setError('');
    paintSlot(row, next === 'bench');
    moveRowToGroup(row, next);
    bumpMeta(row?.closest('.card'), previous, next);
    saveMember({ ...member, slot: next })
      .then(() => router.refresh())
      .catch((err) => {
        setSlot(previous);
        paintSlot(row, previous === 'bench');
        moveRowToGroup(row, previous);
        bumpMeta(row?.closest('.card'), next, previous);
        setError(err.message || 'Could not update lineup.');
      });
  }

  return (
    <button
      ref={btnRef}
      type="button"
      className="btn sm"
      data-slot-toggle="1"
      title={error || undefined}
      onClick={toggle}
    >
      {onBench ? 'Start' : 'Bench'}
    </button>
  );
}
