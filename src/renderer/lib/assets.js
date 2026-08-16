export function asset(rel) {
  const clean = String(rel || '')
    .replace(/^\/+/, '')
    .replace(/^assets\//, '');
  return `cci-asset://static/${clean}`;
}
