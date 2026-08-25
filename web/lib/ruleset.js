import bundled from './cdl-ruleset.json';

export function bundledRuleset() {
  return bundled;
}

export function resolveRuleset(docs = []) {
  const remote = docs.find((d) => d.id === 'cdl' || d.game);
  if (remote?.maps?.length) return remote;
  return bundled;
}

export function activeMaps(ruleset) {
  return (ruleset?.maps || []).filter((m) => m.active !== false);
}

export function mapNames(ruleset) {
  return activeMaps(ruleset).map((m) => m.name);
}

export function modeNames(ruleset) {
  return ruleset?.modes || ['Hardpoint', 'Search & Destroy', 'Overload'];
}

export function poolsByMode(ruleset) {
  const modes = modeNames(ruleset);
  const maps = activeMaps(ruleset);
  const out = {};
  for (const mode of modes) {
    out[mode] = maps.filter((m) => (m.modes || []).includes(mode)).map((m) => m.name);
  }
  return out;
}
