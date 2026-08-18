import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatRosterMessage } from '../src/roster.js';
import type { CoachIntelTeam, CoachIntelMember } from '../src/supabase.js';

test('formatRosterMessage lists every member with role and slot', () => {
  const team: CoachIntelTeam = { id: 't1', name: 'Naevii', tag: 'NAE' };
  const members: CoachIntelMember[] = [
    { gamertag: 'Ion', name: null, role: 'Slayer', slot: 'starter', title: null },
    { gamertag: 'Sub1', name: null, role: 'Flex', slot: 'substitute', title: null },
  ];

  const message = formatRosterMessage(team, members);
  assert.match(message, /\*\*Naevii \[NAE\] Roster\*\*/);
  assert.match(message, /Ion\*\* — Slayer/);
  assert.match(message, /Sub1\*\* — Flex \(substitute\)/);
});

test('formatRosterMessage falls back cleanly when a member has no role set', () => {
  const team: CoachIntelTeam = { id: 't1', name: 'Naevii', tag: null };
  const members: CoachIntelMember[] = [{ gamertag: 'Ion', name: null, role: null, slot: 'starter', title: null }];

  const message = formatRosterMessage(team, members);
  assert.match(message, /Ion\*\* — No role set/);
});

test('formatRosterMessage returns a clean message for an empty roster', () => {
  const team: CoachIntelTeam = { id: 't1', name: 'Naevii', tag: null };
  const message = formatRosterMessage(team, []);
  assert.equal(message, '**Naevii** has no roster entries yet.');
});
