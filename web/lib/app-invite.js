import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { getOrg, listAllMembers, listTeams } from './data.js';
import { suggestedAccessRole } from './invite.js';

export function orgDisplayName(org) {
  return String(org?.name || org?.tag || '').trim();
}

export function buildInviteFromApp({ org, teams = [], members = [], who, email, accessRole } = {}) {
  const named = String(who || '').trim();
  const team = teams[0] || null;
  const member =
    members.find((row) => String(row.gamertag || '').toLowerCase() === named.toLowerCase())
    || members.find((row) => String(row.name || '').toLowerCase() === named.toLowerCase())
    || (named ? null : members[0])
    || null;
  const gamertag = String(member?.gamertag || named || '').trim();
  const teamId = member?.team_id;
  const home = teams.find((row) => row.id === teamId) || team;
  return {
    org_name: orgDisplayName(org) || 'the organization',
    team_name: String(home?.name || '').trim(),
    gamertag,
    member_name: String(member?.name || '').trim(),
    access_role: accessRole || suggestedAccessRole(member || { title: 'Player' }),
    invitee_email: String(email || '').trim(),
    accent: String(org?.accent || home?.accent || '').trim() || null,
    play_role: String(member?.role || '').trim(),
    slot: String(member?.slot || '').trim() || (member ? 'starter' : ''),
  };
}

function localOrgDir() {
  if (process.env.CCI_DATA_ROOT) return path.join(process.env.CCI_DATA_ROOT, 'org');
  return path.join(os.homedir(), 'Library', 'Application Support', 'Coach Intel', 'data', 'org');
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

async function loadLocalApp() {
  const root = localOrgDir();
  const org = await readJson(path.join(root, 'org-profile.json'));
  const teams = [];
  const members = [];
  let dirs = [];
  try {
    dirs = await fs.readdir(path.join(root, 'teams'), { withFileTypes: true });
  } catch {
    return { org, teams, members };
  }
  for (const dir of dirs.filter((entry) => entry.isDirectory())) {
    const profile = await readJson(path.join(root, 'teams', dir.name, 'team-profile.json'));
    if (profile?.name) teams.push({ id: dir.name, name: profile.name, tag: profile.tag, accent: profile.accent });
    let files = [];
    try {
      files = await fs.readdir(path.join(root, 'teams', dir.name, 'members'));
    } catch {
      continue;
    }
    for (const file of files.filter((name) => name.endsWith('.json'))) {
      const member = await readJson(path.join(root, 'teams', dir.name, 'members', file));
      if (member) members.push({ ...member, team_id: dir.name });
    }
  }
  return { org, teams, members };
}

export async function loadInviteFromApp(supabase, extras = {}) {
  let org = supabase ? await getOrg(supabase).catch(() => null) : null;
  let teams = supabase ? await listTeams(supabase).catch(() => []) : [];
  let members = supabase ? await listAllMembers(supabase).catch(() => []) : [];
  if (!orgDisplayName(org) || !teams.length) {
    const local = await loadLocalApp();
    if (!orgDisplayName(org) && orgDisplayName(local.org)) org = local.org;
    if (!teams.length && local.teams.length) teams = local.teams;
    if (!members.length && local.members.length) members = local.members;
  }
  return buildInviteFromApp({ org, teams, members, ...extras });
}
