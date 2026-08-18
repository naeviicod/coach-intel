const fs = require('fs');
const path = require('path');
const { protocol } = require('electron');

const ASSETS = path.join(__dirname, '..', 'renderer', 'assets');

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

function registerAssetScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'cci-asset',
      privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
    },
  ]);
}

function resolveAsset(rel) {
  const inside = path.join(ASSETS, rel);
  const unpacked = inside.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`);
  if (unpacked !== inside && fs.existsSync(unpacked)) return unpacked;
  return inside;
}

function handleAssetProtocol() {
  protocol.handle('cci-asset', async (request) => {
    let rel = '';
    try {
      const url = new URL(request.url);
      const raw = url.host === 'static' ? url.pathname : `${url.host}${url.pathname}`;
      rel = decodeURIComponent(raw.replace(/^\/+/, ''));
    } catch {
      rel = String(request.url || '').replace(/^cci-asset:\/\//, '');
    }
    if (!rel || rel.includes('..') || path.isAbsolute(rel)) {
      return new Response('Not found', { status: 404 });
    }
    const file = resolveAsset(rel);
    try {
      const data = await fs.promises.readFile(file);
      const mime = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
      return new Response(data, {
        headers: { 'content-type': mime, 'cache-control': 'no-cache' },
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}

module.exports = { registerAssetScheme, handleAssetProtocol };
