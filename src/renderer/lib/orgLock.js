export function orgIsProvisioned(org) {
  if (!org) return false;
  if (org.provisioned || org.locked) return true;
  if (Array.isArray(org.teamIds) && org.teamIds.length) return true;
  const name = String(org.name || '').trim();
  if (name && name !== 'My Organization') return true;
  return Boolean(org.updated_at);
}

export function shouldRunOnboarding({ org, teams, signedIn } = {}) {
  if (signedIn) return false;
  if (orgIsProvisioned(org)) return false;
  if (Array.isArray(teams) && teams.length) return false;
  return true;
}

export function shouldRunUnlinked({ org, teams, signedIn } = {}) {
  if (!signedIn) return false;
  if (Array.isArray(teams) && teams.length) return false;
  if (orgIsProvisioned(org)) return false;
  return true;
}
