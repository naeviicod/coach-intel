import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTeamId } from '../src/teamMapping.js';
import type { Env } from '../src/env.js';

function makeEnv(): Env {
  return {
    DISCORD_APPLICATION_ID: 'app-id',
    DISCORD_PUBLIC_KEY: '00'.repeat(32),
    DISCORD_BOT_TOKEN: 'bot-token',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  };
}

function stubFetch(handler: (url: string) => Response) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: unknown) => handler(String(input))) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

test('resolveTeamId returns the mapped team for an authorized guild', async () => {
  const restore = stubFetch((url) => {
    assert.match(url, /\/rest\/v1\/discord_guild_links\?guild_id=eq\.guild-1&enabled=eq\.true/);
    return new Response(JSON.stringify([{ team_id: 'team-abc' }]), { status: 200 });
  });
  try {
    assert.equal(await resolveTeamId(makeEnv(), 'guild-1'), 'team-abc');
  } finally {
    restore();
  }
});

test('resolveTeamId returns null for an unmapped guild', async () => {
  const restore = stubFetch(() => new Response(JSON.stringify([]), { status: 200 }));
  try {
    assert.equal(await resolveTeamId(makeEnv(), 'guild-2'), null);
  } finally {
    restore();
  }
});

test('resolveTeamId returns null when guild_id is missing', async () => {
  assert.equal(await resolveTeamId(makeEnv(), undefined), null);
});

test('resolveTeamId fails closed when Supabase is unreachable', async () => {
  const restore = stubFetch(() => {
    throw new Error('network down');
  });
  try {
    assert.equal(await resolveTeamId(makeEnv(), 'guild-1'), null);
  } finally {
    restore();
  }
});

test('resolveTeamId fails closed on a non-2xx Supabase response', async () => {
  const restore = stubFetch(() => new Response('error', { status: 500 }));
  try {
    assert.equal(await resolveTeamId(makeEnv(), 'guild-1'), null);
  } finally {
    restore();
  }
});

test('a disabled link is excluded by the query itself, not client-side filtering', async () => {
  const restore = stubFetch((url) => {
    assert.match(url, /enabled=eq\.true/);
    return new Response(JSON.stringify([]), { status: 200 });
  });
  try {
    assert.equal(await resolveTeamId(makeEnv(), 'guild-disabled'), null);
  } finally {
    restore();
  }
});
