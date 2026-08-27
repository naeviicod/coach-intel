function cacheKey(value) {
  return String(value || '').trim();
}

function createImageCache(load) {
  const entries = new Map();

  return {
    get(value) {
      const key = cacheKey(value);
      if (!key) return Promise.resolve(null);
      if (entries.has(key)) return entries.get(key);

      const pending = Promise.resolve().then(() => load(key));
      entries.set(key, pending);
      pending.catch(() => entries.delete(key));
      return pending;
    },

    invalidate(value) {
      entries.delete(cacheKey(value));
    },

    clear() {
      entries.clear();
    },
  };
}

module.exports = { createImageCache };
