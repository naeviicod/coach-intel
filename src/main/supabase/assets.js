// Cloud backup for uploaded images (member photos, team/org logos, map art).
// Local files stay the fast path on the machine that uploaded them; this is
// what lets a second signed-in machine — a fresh install, a teammate's laptop —
// actually see the same picture instead of only the relative-path string that
// points to it (that string already syncs fine through teams.logo/members.photo).

const BUCKET = 'org-assets';

function createAssetsService({ client }) {
  function requireClient() {
    if (!client) throw new Error('Supabase is not configured yet — see src/main/supabase/config.js');
    return client;
  }

  async function upload(relative, buffer, contentType) {
    const c = requireClient();
    const { error } = await c.storage.from(BUCKET).upload(relative, buffer, {
      contentType: contentType || 'application/octet-stream',
      upsert: true,
    });
    if (error) throw error;
    return true;
  }

  async function download(relative) {
    const c = requireClient();
    const { data, error } = await c.storage.from(BUCKET).download(relative);
    if (error) return null;
    return Buffer.from(await data.arrayBuffer());
  }

  return { upload, download };
}

module.exports = { createAssetsService, BUCKET };
