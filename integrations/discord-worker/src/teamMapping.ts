import type { Env } from './env.js';
import { getTeamIdForGuild } from './supabase.js';

// Resolves a Discord guild to its Coach Intel team via the discord_guild_links
// table (scripts/supabase/schema.sql) instead of a hand-maintained
// TEAM_GUILD_MAP secret — mapping a new server to a team is a database write,
// never a Cloudflare secret edit. Any lookup failure (unmapped guild, disabled
// link, Supabase unreachable) fails closed to null, never a guess.
export async function resolveTeamId(env: Env, guildId: string | undefined): Promise<string | null> {
  if (!guildId) return null;
  try {
    return await getTeamIdForGuild(env, guildId);
  } catch (err) {
    console.error('discord-worker: guild lookup failed —', err instanceof Error ? err.message : String(err));
    return null;
  }
}
