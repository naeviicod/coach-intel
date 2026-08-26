const test = require('node:test');
const assert = require('node:assert/strict');
const { sharedWriteHint, mergeMemberLists } = require('../src/main/rosterSync');

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
