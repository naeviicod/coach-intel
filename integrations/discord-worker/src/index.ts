import type { Env } from './env.js';
import {
  InteractionType,
  InteractionResponseType,
  verifyDiscordRequest,
  jsonResponse,
  messageResponse,
} from './discord.js';
import { resolveTeamId } from './teamMapping.js';
import { handleRosterCommand } from './roster.js';

interface DiscordInteraction {
  type: number;
  guild_id?: string;
  data?: { name?: string };
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/') {
      return new Response('Coach Intel Discord Worker is running.', { status: 200 });
    }
    if (request.method !== 'POST') {
      return new Response('Not found', { status: 404 });
    }
    if (!env.DISCORD_PUBLIC_KEY) {
      console.error('discord-worker: DISCORD_PUBLIC_KEY is not configured');
      return new Response('Server misconfigured', { status: 500 });
    }

    const { isValid, body } = await verifyDiscordRequest(request, env);
    if (!isValid) {
      return new Response('Invalid request signature', { status: 401 });
    }

    let interaction: DiscordInteraction;
    try {
      interaction = JSON.parse(body);
    } catch {
      return new Response('Invalid JSON body', { status: 400 });
    }

    // Discord PINGs the endpoint URL once when it's saved in the developer
    // portal, and periodically after — this must be answered before any
    // guild/team authorization logic runs, since a PING carries no guild_id.
    if (interaction.type === InteractionType.PING) {
      return jsonResponse({ type: InteractionResponseType.PONG });
    }

    if (interaction.type !== InteractionType.APPLICATION_COMMAND) {
      return messageResponse('Unsupported interaction type.', true);
    }

    const teamId = await resolveTeamId(env, interaction.guild_id);
    if (!teamId) {
      return messageResponse(
        "This Discord server isn't authorized for Coach Intel. Ask your admin to add it to the roster mapping.",
        true
      );
    }

    const commandName = interaction.data?.name;
    switch (commandName) {
      case 'roster':
        return handleRosterCommand(env, teamId);
      default:
        return messageResponse(`Unknown command: /${commandName ?? '?'}`, true);
    }
  },
};
