import type { Env } from './env.js';

export interface CoachIntelTeam {
  id: string;
  name: string;
  tag: string | null;
}

export interface CoachIntelMember {
  gamertag: string;
  name: string | null;
  role: string | null;
  slot: string;
  title: string | null;
}

async function supabaseGet<T>(env: Env, path: string): Promise<T> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase request failed (${res.status}): ${path}`);
  }
  return (await res.json()) as T;
}

export async function getTeamById(env: Env, teamId: string): Promise<CoachIntelTeam | null> {
  const rows = await supabaseGet<CoachIntelTeam[]>(
    env,
    `teams?id=eq.${encodeURIComponent(teamId)}&select=id,name,tag&limit=1`
  );
  return rows[0] ?? null;
}

export async function getMembersByTeamId(env: Env, teamId: string): Promise<CoachIntelMember[]> {
  return supabaseGet<CoachIntelMember[]>(
    env,
    `members?team_id=eq.${encodeURIComponent(teamId)}&select=gamertag,name,role,slot,title&order=slot.asc,gamertag.asc`
  );
}

interface DiscordGuildLink {
  team_id: string;
}

export async function getTeamIdForGuild(env: Env, guildId: string): Promise<string | null> {
  const rows = await supabaseGet<DiscordGuildLink[]>(
    env,
    `discord_guild_links?guild_id=eq.${encodeURIComponent(guildId)}&enabled=eq.true&select=team_id&limit=1`
  );
  return rows[0]?.team_id ?? null;
}
