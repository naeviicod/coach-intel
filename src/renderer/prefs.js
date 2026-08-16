// Local UI preferences.
//
// Coach Intel is a single-user offline desktop app and had no renderer-side
// preference store: org/team/member data all lives in JSON via `window.cci`,
// which is shared org content rather than per-user chrome state. Rather than
// stand up a new IPC + file persistence layer just to remember which way a
// panel is facing, UI chrome state goes to localStorage, which is already
// available and survives restarts.

const KEY = 'cci.ui';

let cache = null;

function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    cache = {};
  }
  return cache;
}

export function getPref(name, fallback = null) {
  const value = load()[name];
  return value === undefined ? fallback : value;
}

export function setPref(name, value) {
  const store = load();
  store[name] = value;
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Storage can be unavailable or full; preferences are non-critical, so the
    // in-memory cache still keeps the setting for the rest of the session.
  }
}
