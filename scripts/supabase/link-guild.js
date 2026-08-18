#!/usr/bin/env node
// Maps a Discord guild to a Coach Intel team in the discord_guild_links table
// (scripts/supabase/schema.sql) — this is what the Discord Worker's /roster
// command reads instead of the old TEAM_GUILD_MAP secret, so adding or
// changing a mapping is a database write, never a Cloudflare secret edit.
// Safe to re-run: upserts by guild_id.
//
// Needs the service role key, not the publishable one — this bypasses Row
// Level Security for a one-time trusted write. The app itself never uses this
// key; get it from the Supabase dashboard under Settings -> API -> service_role.
//
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/supabase/link-guild.js <discordGuildId> <teamId>
//
// <teamId> is the Coach Intel team's id column (visible in the app, or via
// `select id, name from teams;` in the Supabase SQL editor).

const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL } = require('../../src/main/supabase/config');

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const [guildId, teamId] = process.argv.slice(2);

if (!SERVICE_ROLE_KEY || !guildId || !teamId) {
  console.error('Usage: SUPABASE_SERVICE_ROLE_KEY=... node scripts/supabase/link-guild.js <discordGuildId> <teamId>');
  process.exit(1);
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s — check your network/SUPABASE_URL`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function main() {
  console.log(`Looking up team "${teamId}"...`);
  const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: team, error: teamError } = await withTimeout(
    client.from('teams').select('id, name').eq('id', teamId).maybeSingle(),
    10000,
    'Team lookup'
  );
  if (teamError) {
    console.error('Could not look up that team:', teamError.message);
    process.exit(1);
  }
  if (!team) {
    console.error(`No team with id "${teamId}" exists. Run: select id, name from teams; in the Supabase SQL editor.`);
    process.exit(1);
  }

  console.log(`Found "${team.name}" — writing the guild link...`);
  const { error } = await withTimeout(
    client.from('discord_guild_links').upsert({ guild_id: guildId, team_id: teamId, enabled: true }, { onConflict: 'guild_id' }),
    10000,
    'Guild link write'
  );
  if (error) {
    console.error('Link failed:', error.message);
    process.exit(1);
  }

  console.log(`Discord guild ${guildId} is now mapped to "${team.name}" (${teamId}).`);
  console.log('The /roster command will resolve for that guild immediately — no Worker deploy needed.');
}

main().catch((err) => {
  console.error('Link failed:', err.message || err);
  process.exit(1);
});
