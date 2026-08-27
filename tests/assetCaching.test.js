const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('web asset proxy marks signed image redirects as private browser-cacheable responses', () => {
  const route = read('web/app/api/assets/[...path]/route.js');
  assert.match(route, /ASSET_CACHE_CONTROL/);
  assert.match(route, /headers\.set\('Cache-Control', ASSET_CACHE_CONTROL\)/);
  assert.match(route, /headers\.set\('Vary', 'Cookie'\)/);
  assert.match(route, /createSignedUrl\(key, 60 \* 60 \* 6\)/);
});

test('web and desktop static artwork can be reused instead of being revalidated on every view', () => {
  const nextConfig = read('web/next.config.js');
  const assetProtocol = read('src/main/assetProtocol.js');

  assert.match(nextConfig, /source:\s*'\/assets\/:path\*'/);
  assert.match(nextConfig, /max-age=3600/);
  assert.match(assetProtocol, /cache-control': 'public, max-age=3600, stale-while-revalidate=86400'/);
});
