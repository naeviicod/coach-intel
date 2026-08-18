// Shared org/team documents (matches, strats, notes, planning, …).
// Same timeout / error shape as teams.js so IPC can reuse sharedWriteHint.

function raise(error, fallback) {
  const msg =
    (error && (error.message || error.details || error.hint)) ||
    fallback ||
    'Request failed';
  const err = new Error(msg);
  if (error && error.code) err.code = error.code;
  throw err;
}

function missingTable(error) {
  const code = error && error.code;
  const msg = String((error && (error.message || error.details)) || '');
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    /shared_docs|schema cache|could not find the table/i.test(msg)
  );
}

async function withTimeout(promise, ms, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

const WRITE_TIMEOUT_MS = 6000;
const READ_TIMEOUT_MS = 4000;

function createRecordsService({ client }) {
  function requireClient() {
    if (!client) throw new Error('Supabase is not configured yet — see src/main/supabase/config.js');
    return client;
  }

  async function listDocs(kind, teamId) {
    const c = requireClient();
    const query = c.from('shared_docs').select('*').eq('kind', kind).eq('team_id', teamId || '');
    const { data, error } = await withTimeout(query, READ_TIMEOUT_MS, 'Loading shared records');
    if (missingTable(error)) return [];
    if (error) raise(error);
    return data || [];
  }

  async function listAllDocs() {
    const c = requireClient();
    const { data, error } = await withTimeout(
      c.from('shared_docs').select('*'),
      READ_TIMEOUT_MS,
      'Loading shared records'
    );
    if (missingTable(error)) return [];
    if (error) raise(error);
    return data || [];
  }

  async function upsertDoc(kind, teamId, id, payload) {
    const c = requireClient();
    const now = new Date().toISOString();
    const row = {
      kind,
      team_id: teamId || '',
      id: String(id),
      payload: payload && typeof payload === 'object' ? payload : {},
      updated_at: (payload && payload.updated_at) || now,
      deleted_at: null,
    };
    const { error } = await withTimeout(
      c.from('shared_docs').upsert(row, { onConflict: 'kind,team_id,id' }),
      WRITE_TIMEOUT_MS,
      'Saving shared record'
    );
    if (error) raise(error, 'Could not save shared org data.');
    return row;
  }

  async function tombstoneDoc(kind, teamId, id) {
    const c = requireClient();
    const now = new Date().toISOString();
    const { error } = await withTimeout(
      c.from('shared_docs').upsert(
        {
          kind,
          team_id: teamId || '',
          id: String(id),
          payload: {},
          updated_at: now,
          deleted_at: now,
        },
        { onConflict: 'kind,team_id,id' }
      ),
      WRITE_TIMEOUT_MS,
      'Deleting shared record'
    );
    if (error) raise(error, 'Could not delete shared org data.');
    return true;
  }

  return { listDocs, listAllDocs, upsertDoc, tombstoneDoc };
}

module.exports = { createRecordsService, missingTable };
