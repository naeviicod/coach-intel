const test = require('node:test');
const assert = require('node:assert/strict');
const {
  sharedWriteHint,
  mergeMemberLists,
  needsTeamPush,
  needsMemberPush,
  syncLocalRosterToRemote,
} = require('../src/main/rosterSync');

test('a blocked shared write tells you to run schema.sql', () => {
  const msg = sharedWriteHint(new Error('new row violates row-level security policy for table "members"'));
  assert.match(msg, /schema\.sql/);
});

test('a missing shared_docs table tells you to run schema.sql', () => {
  const msg = sharedWriteHint(new Error('Could not find the table \'public.shared_docs\' in the schema cache'));
  assert.match(msg, /schema\.sql/);
});

test('ordinary errors stay ordinary', () => {
  assert.equal(sharedWriteHint(new Error('network down')), 'network down');
});

test('a newer local bench wins over a stale cloud starter', () => {
  const merged = mergeMemberLists(
    [{ id: 'abloh', gamertag: 'Abloh', slot: 'bench', updated_at: '2026-08-26T01:20:00.000Z' }],
    [{ id: 'abloh', gamertag: 'Abloh', slot: 'starter', user_id: 'u-1', updated_at: '2026-08-26T01:00:00.000Z' }]
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].slot, 'bench');
  assert.equal(merged[0].user_id, 'u-1');
});

test('a newer cloud bench wins over a stale local starter', () => {
  const merged = mergeMemberLists(
    [{ id: 'cirdec', gamertag: 'Cirdec', slot: 'starter', updated_at: '2026-08-26T01:00:00.000Z' }],
    [{ id: 'cirdec', gamertag: 'Cirdec', slot: 'bench', updated_at: '2026-08-26T01:20:00.000Z' }]
  );
  assert.equal(merged[0].slot, 'bench');
});

test('a team that already lives in supabase is not rewritten', () => {
  assert.equal(needsTeamPush({ id: 'rome', name: 'Rome' }, { id: 'rome', name: 'Rome' }), false);
  assert.equal(needsTeamPush({ id: 'rome', name: 'Rome' }, null), true);
});

test('members only push when local is actually newer', () => {
  const local = { id: 'abloh', updated_at: '2026-08-26T12:00:00.000Z' };
  const remote = { id: 'abloh', updated_at: '2026-08-26T12:00:00.000Z' };
  assert.equal(needsMemberPush(local, remote), false);
  assert.equal(needsMemberPush({ ...local, updated_at: '2026-08-26T12:01:00.000Z' }, remote), true);
  assert.equal(needsMemberPush(local, null), true);
});

test('refresh hydrates Rome without rewriting a team that already exists', async () => {
  const calls = { saveTeam: 0, saveMember: 0 };
  const team = { id: 'rome', name: 'Rome', updated_at: '2026-08-26T12:00:00.000Z' };
  const member = { id: 'abloh', gamertag: 'Abloh', updated_at: '2026-08-26T12:00:00.000Z' };
  const result = await syncLocalRosterToRemote({
    supabase: {
      get: () => ({
        getState: async () => ({ session: { user: { id: 'u1' } } }),
        ensureProfile: async () => ({}),
        getTeams: async () => [team],
        saveTeam: async () => {
          calls.saveTeam += 1;
          throw new Error('new row violates row-level security policy for table "teams"');
        },
        getMembers: async () => [member],
        saveMember: async () => {
          calls.saveMember += 1;
          throw new Error('new row violates row-level security policy for table "members"');
        },
      }),
    },
    dataStore: {
      getTeams: async () => [team],
      getMembers: async () => [member],
      saveMember: async () => member,
    },
    docs: { syncAll: async () => ({ ok: true, errors: [] }) },
  });
  assert.equal(calls.saveTeam, 0);
  assert.equal(calls.saveMember, 0);
  assert.equal(result.ok, true);
});

test('a brand-new local team still tries to write', async () => {
  let saved = false;
  const result = await syncLocalRosterToRemote({
    supabase: {
      get: () => ({
        getState: async () => ({ session: { user: { id: 'u1' } } }),
        ensureProfile: async () => ({}),
        getTeams: async () => [],
        saveTeam: async () => {
          saved = true;
          throw new Error('new row violates row-level security policy for table "teams"');
        },
        getMembers: async () => [],
        saveMember: async () => ({}),
      }),
    },
    dataStore: {
      getTeams: async () => [{ id: 'rome', name: 'Rome' }],
      getMembers: async () => [],
      saveMember: async () => ({}),
    },
    docs: { syncAll: async () => ({ ok: true, errors: [] }) },
  });
  assert.equal(saved, true);
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /Rome: Could not write shared org data/);
});

test('refresh withholds the success toast after a write error', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../src/renderer/app.js'), 'utf8');
  assert.match(src, /if \(!silent && !failed\) toast\('Org is up to date\.'\)/);
});
