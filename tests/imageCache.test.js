const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const modulePath = path.join(__dirname, '..', 'src', 'main', 'imageCache.js');

test('image URL cache shares an in-flight load and reuses the resolved image during the session', async () => {
  assert.equal(fs.existsSync(modulePath), true, 'the renderer needs a session image cache');
  const { createImageCache } = require(modulePath);
  let loads = 0;
  const cache = createImageCache(async (key) => {
    loads += 1;
    return `data:image/png;base64,${key}`;
  });

  const [first, second] = await Promise.all([cache.get('org/logos/team.png'), cache.get('org/logos/team.png')]);
  const third = await cache.get('org/logos/team.png');

  assert.equal(first, 'data:image/png;base64,org/logos/team.png');
  assert.equal(second, first);
  assert.equal(third, first);
  assert.equal(loads, 1);
});

test('image URL cache keeps a missing image result but reloads after that path is invalidated', async () => {
  assert.equal(fs.existsSync(modulePath), true, 'the renderer needs a session image cache');
  const { createImageCache } = require(modulePath);
  let value = null;
  let loads = 0;
  const cache = createImageCache(async () => {
    loads += 1;
    return value;
  });

  assert.equal(await cache.get('maps/new-map.png'), null);
  assert.equal(await cache.get('maps/new-map.png'), null);
  assert.equal(loads, 1);

  value = 'data:image/png;base64,new-map';
  cache.invalidate('maps/new-map.png');
  assert.equal(await cache.get('maps/new-map.png'), value);
  assert.equal(loads, 2);
});

test('image URL cache retries a failed read instead of preserving a transient failure', async () => {
  assert.equal(fs.existsSync(modulePath), true, 'the renderer needs a session image cache');
  const { createImageCache } = require(modulePath);
  let loads = 0;
  const cache = createImageCache(async () => {
    loads += 1;
    if (loads === 1) throw new Error('offline');
    return 'data:image/png;base64,recovered';
  });

  await assert.rejects(cache.get('org/logo.png'), /offline/);
  assert.equal(await cache.get('org/logo.png'), 'data:image/png;base64,recovered');
  assert.equal(loads, 2);
});
