const test = require('node:test');
const assert = require('node:assert/strict');
const { sharedWriteHint } = require('../src/main/rosterSync');

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
