import type { Env } from './env.js';
import { messageResponse } from './discord.js';
import { getTeamById, getMembersByTeamId, type CoachIntelTeam, type CoachIntelMember } from './supabase.js';

export async function handleRosterCommand(env: Env, teamId: string): Promise<Response> {
  let team: CoachIntelTeam | null;
  let members: CoachIntelMember[];
  try {
    [team, members] = await Promise.all([getTeamById(env, teamId), getMembersByTeamId(env, teamId)]);
  } catch (err) {
    console.error('roster command: Supabase lookup failed —', err instanceof Error ? err.message : String(err));
    return messageResponse('Could not reach the roster data right now — try again in a moment.', true);
  }

  if (!team) {
    return messageResponse('This server is mapped to a Coach Intel team that no longer exists.', true);
  }

  return messageResponse(formatRosterMessage(team, members), false);
}

export function formatRosterMessage(team: CoachIntelTeam, members: CoachIntelMember[]): string {
  const label = team.tag ? `${team.name} [${team.tag}]` : team.name;

  if (!members.length) {
    return `**${label}** has no roster entries yet.`;
  }

  const lines = members.map((m) => {
    const role = m.role || 'No role set';
    const subTag = m.slot && m.slot !== 'starter' ? ` (${m.slot})` : '';
    return `• **${m.gamertag}** — ${role}${subTag}`;
  });

  return `**${label} Roster**\n${lines.join('\n')}`;
}
