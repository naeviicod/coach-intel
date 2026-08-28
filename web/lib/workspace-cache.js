const TTL_MS = 20_000;

function store() {
  const g = globalThis;
  if (!g.__ciWorkspaceCache || !g.__ciWorkspaceCache.byUser) {
    g.__ciWorkspaceCache = {
      byUser: new Map(),
      docs: null,
      docsAt: 0,
      docsInflight: null,
    };
  }
  return g.__ciWorkspaceCache;
}

export function invalidateWorkspaceCache() {
  const slot = store();
  slot.byUser = new Map();
  slot.docs = null;
  slot.docsAt = 0;
  slot.docsInflight = null;
}

function emptyTeamList(roster) {
  return Array.isArray(roster?.teams) && roster.teams.length === 0;
}

export async function rememberRoster(userId, loader) {
  if (typeof userId === 'function') {
    loader = userId;
    userId = 'anon';
  }
  const slot = store();
  const key = String(userId || 'anon');
  const hit = slot.byUser.get(key);
  if (hit?.inflight) return hit.inflight;
  if (hit?.value && Date.now() - hit.at < TTL_MS) return hit.value;

  const inflight = (async () => {
    try {
      const value = await loader();
      // An empty team list is often a failed/unauthenticated fetch, not a real
      // org with zero teams. Caching it made /teams show "0 teams" until the
      // next write (or the 20s TTL) — clicking + Add Team looked like it
      // "restored" Rome because the following request finally hit Supabase.
      if (emptyTeamList(value) && key !== 'anon') {
        slot.byUser.delete(key);
        return value;
      }
      slot.byUser.set(key, { at: Date.now(), value, inflight: null });
      return value;
    } catch (err) {
      slot.byUser.delete(key);
      throw err;
    }
  })();
  slot.byUser.set(key, { at: hit?.at || 0, value: hit?.value || null, inflight });
  return inflight;
}

export async function rememberDocs(loader) {
  const slot = store();
  if (slot.docsInflight) return slot.docsInflight;
  if (slot.docs && Date.now() - slot.docsAt < TTL_MS) return slot.docs;
  const inflight = (async () => {
    try {
      const docs = await loader();
      slot.docs = docs;
      slot.docsAt = Date.now();
      slot.docsInflight = null;
      return docs;
    } catch (err) {
      slot.docsInflight = null;
      throw err;
    }
  })();
  slot.docsInflight = inflight;
  return inflight;
}
