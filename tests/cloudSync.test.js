const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeRecords, hasLocalRecords } = require('../src/main/cloudSync');

test('a newer remote match replaces this machine’s copy', () => {
  const local = [{ match_id: 'm1', updated_at: '2026-01-01T00:00:00.000Z', players: [{ kd: 1 }] }];
  const remote = [
    {
      id: 'm1',
      updated_at: '2026-06-01T00:00:00.000Z',
      payload: { match_id: 'm1', updated_at: '2026-06-01T00:00:00.000Z', players: [{ kd: 2.4 }] },
    },
  ];
  const merged = mergeRecords(local, remote, 'match_id');
  assert.equal(merged.toApply[0].players[0].kd, 2.4);
  assert.equal(merged.toPush.length, 0);
});

test('a match that only exists on this Mac is pushed to the shared org', () => {
  const local = [{ match_id: 'm2', updated_at: '2026-02-01T00:00:00.000Z' }];
  const merged = mergeRecords(local, [], 'match_id');
  assert.equal(merged.toPush[0].match_id, 'm2');
});

test('a remote delete removes a stale local match', () => {
  const local = [{ match_id: 'm3', updated_at: '2026-01-01T00:00:00.000Z' }];
  const remote = [{ id: 'm3', deleted_at: '2026-03-01T00:00:00.000Z', updated_at: '2026-03-01T00:00:00.000Z', payload: {} }];
  const merged = mergeRecords(local, remote, 'match_id');
  assert.deepEqual(merged.toDelete, ['m3']);
});

test('this Mac keeps a match it edited after the remote delete', () => {
  const local = [{ match_id: 'm4', updated_at: '2026-04-01T00:00:00.000Z' }];
  const remote = [{ id: 'm4', deleted_at: '2026-03-01T00:00:00.000Z', updated_at: '2026-03-01T00:00:00.000Z', payload: {} }];
  const merged = mergeRecords(local, remote, 'match_id');
  assert.equal(merged.toDelete.length, 0);
  assert.equal(merged.toPush[0].match_id, 'm4');
});

test('hydrate can skip the network when this Mac already has records', () => {
  assert.equal(hasLocalRecords([{ match_id: 'm1' }]), true);
  assert.equal(hasLocalRecords([]), false);
  assert.equal(hasLocalRecords(null), false);
});
