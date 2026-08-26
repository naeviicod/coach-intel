'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveMember } from '../lib/docs';

function destTeams(teams, fromId) {
  return (teams || []).filter((team) => team.id !== fromId);
}

async function moveMembers(rows, toTeamId, slot) {
  const dest = String(toTeamId || '').trim();
  if (!dest) throw new Error('Pick a team to transfer to.');
  const nextSlot = slot && slot !== 'keep' ? slot : null;
  for (const member of rows) {
    await saveMember({
      ...member,
      team_id: dest,
      slot: nextSlot || member.slot,
    });
  }
}

export function RosterCheck({ member, canTransfer }) {
  if (!canTransfer) return null;
  return (
    <input
      type="checkbox"
      className="roster-check"
      data-member-id={member.id}
      aria-label={`Select ${member.gamertag || member.name || 'member'}`}
    />
  );
}

export function TransferMember({ member, teams, canTransfer }) {
  const dests = destTeams(teams, member.team_id);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!canTransfer) return null;

  async function go(dest) {
    if (!dest) {
      setError('Add another team first, then you can transfer members.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await moveMembers([member], dest, 'keep');
      router.refresh();
    } catch (err) {
      setError(err.message || 'Could not transfer that member.');
    } finally {
      setBusy(false);
    }
  }

  if (!dests.length) {
    return (
      <button type="button" className="btn sm" onClick={() => go('')} title={error || undefined}>Transfer</button>
    );
  }

  if (dests.length === 1) {
    return (
      <button type="button" className="btn sm" disabled={busy} onClick={() => go(dests[0].id)} title={error || undefined}>
        {busy ? 'Moving…' : 'Transfer'}
      </button>
    );
  }

  return (
    <>
      <select
        className="btn sm"
        defaultValue=""
        disabled={busy}
        aria-label={`Transfer ${member.gamertag || member.name || 'member'}`}
        onChange={(e) => {
          const dest = e.target.value;
          e.target.value = '';
          if (dest) go(dest);
        }}
      >
        <option value="">{busy ? 'Moving…' : 'Transfer'}</option>
        {dests.map((team) => (
          <option key={team.id} value={team.id}>{team.name}</option>
        ))}
      </select>
    </>
  );
}

export function TransferBar({ teamId, teams, members, compact = false }) {
  const dests = destTeams(teams, teamId);
  const router = useRouter();
  const [dest, setDest] = useState(dests[0]?.id || '');
  const [slot, setSlot] = useState('keep');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function transfer() {
    setError('');
    if (!dests.length) {
      setError('Add another team first, then you can transfer members.');
      return;
    }
    const card = document.querySelector(`[data-roster-team="${teamId}"]`);
    const picked = [...(card?.querySelectorAll('.roster-check:checked') || [])]
      .map((node) => String(node.getAttribute('data-member-id') || ''))
      .filter(Boolean);
    const rows = (members || []).filter((member) => picked.includes(member.id));
    if (!rows.length) {
      setError('Select one or more members to transfer.');
      return;
    }
    setBusy(true);
    try {
      await moveMembers(rows, dest || dests[0].id, slot);
      router.refresh();
    } catch (err) {
      setError(err.message || 'Could not transfer those members.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`roster-transfer-bar${compact ? ' compact' : ''}`}>
      {compact || !dests.length ? null : (
        <>
          <label className="field-hint" htmlFor={`transfer-dest-${teamId}`}>Move to</label>
          <select
            id={`transfer-dest-${teamId}`}
            value={dest}
            onChange={(e) => setDest(e.target.value)}
          >
            {dests.map((team) => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>
          <select value={slot} onChange={(e) => setSlot(e.target.value)} aria-label="Lineup on arrival">
            <option value="keep">Keep slot</option>
            <option value="starter">Starter</option>
            <option value="bench">Bench</option>
            <option value="fa">Free Agent</option>
            <option value="staff">Staff</option>
          </select>
        </>
      )}
      <button type="button" className="btn primary" disabled={busy} onClick={transfer}>
        {busy ? 'Moving…' : 'Transfer selected'}
      </button>
      {error ? <div className="field-hint" style={{ color: '#ff8d8d' }}>{error}</div> : null}
    </div>
  );
}
