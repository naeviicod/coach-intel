#!/usr/bin/env node
// One-time migration: pushes the local roster from
// data/org/teams/**/{team-profile.json,members/*.json} into Supabase's teams
// and members tables (scripts/supabase/schema.sql). Upserts by id, so it's
// safe to re-run — nothing is deleted, local files are untouched.
//
// Needs the service role key, not the publishable one — this bypasses Row
// Level Security for a one-time trusted write. The app itself never uses this
// key; get it from the Supabase dashboard under Settings -> API -> service_role,
// and don't put it anywhere except this one command:
//
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/supabase/migrate-teams.js

const fs = require('fs/promises');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL } = require('../../src/main/supabase/config');

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY (Supabase dashboard -> Settings -> API -> service_role) and re-run:');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=... node scripts/supabase/migrate-teams.js');
  process.exit(1);
}

const DATA_ROOT = path.join(__dirname, '..', '..', 'data');
const TEAMS_DIR = path.join(DATA_ROOT, 'org', 'teams');

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function main() {
  const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let teamIds = [];
  try {
    teamIds = (await fs.readdir(TEAMS_DIR, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    console.log('No local teams found under data/org/teams — nothing to migrate.');
    return;
  }

  for (const teamId of teamIds) {
    const teamDir = path.join(TEAMS_DIR, teamId);
    const profile = await readJson(path.join(teamDir, 'team-profile.json'));
    if (!profile) continue;

    const { error: teamError } = await client
      .from('teams')
      .upsert({ id: teamId, name: profile.name, tag: profile.tag || null, logo: profile.logo || null });
    if (teamError) {
      console.error(`Team ${teamId} failed:`, teamError.message);
      continue;
    }
    console.log(`Team ${teamId} (${profile.name}) migrated.`);

    const membersDir = path.join(teamDir, 'members');
    let memberFiles = [];
    try {
      memberFiles = (await fs.readdir(membersDir)).filter((f) => f.endsWith('.json'));
    } catch {
      memberFiles = [];
    }

    for (const file of memberFiles) {
      const memberId = path.basename(file, '.json');
      const member = await readJson(path.join(membersDir, file));
      if (!member) continue;
      const { error: memberError } = await client.from('members').upsert({
        id: memberId,
        team_id: teamId,
        gamertag: member.gamertag,
        name: member.name || member.gamertag,
        role: member.role || 'Flex',
        aliases: member.aliases || [],
        photo: member.photo || null,
      });
      if (memberError) console.error(`  Member ${memberId} failed:`, memberError.message);
      else console.log(`  Member ${memberId} (${member.gamertag}) migrated.`);
    }
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
