const TTL_MS = 20_000;

function store() {
  const g = globalThis;
  if (!g.__ciWorkspaceCache) {
    g.__ciWorkspaceCache = { at: 0, roster: null, docs: null };
  }
  return g.__ciWorkspaceCache;
}

export function invalidateWorkspaceCache() {
  const slot = store();
  slot.at = 0;
  slot.roster = null;
  slot.docs = null;
}

export async function rememberRoster(loader) {
  const slot = store();
  if (slot.roster && Date.now() - slot.at < TTL_MS) return slot.roster;
  const roster = await loader();
  slot.roster = roster;
  slot.at = Date.now();
  return roster;
}

export async function rememberDocs(loader) {
  const slot = store();
  if (slot.docs && Date.now() - slot.at < TTL_MS) return slot.docs;
  const docs = await loader();
  slot.docs = docs;
  slot.at = Date.now();
  return docs;
}
