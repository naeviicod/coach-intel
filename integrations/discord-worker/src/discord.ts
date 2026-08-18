import nacl from 'tweetnacl';
import type { Env } from './env.js';

export const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
} as const;

export const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
} as const;

const EPHEMERAL_FLAG = 64;

// Discord signs every interaction request it sends (Ed25519, over
// timestamp + rawBody) so the endpoint can prove a request actually came
// from Discord. Discord requires exactly this check before anything else.
export async function verifyDiscordRequest(
  request: Request,
  env: Env
): Promise<{ isValid: boolean; body: string }> {
  const signature = request.headers.get('X-Signature-Ed25519');
  const timestamp = request.headers.get('X-Signature-Timestamp');
  const body = await request.text();

  if (!signature || !timestamp || !env.DISCORD_PUBLIC_KEY) {
    return { isValid: false, body };
  }

  try {
    const isValid = nacl.sign.detached.verify(
      new TextEncoder().encode(timestamp + body),
      hexToBytes(signature),
      hexToBytes(env.DISCORD_PUBLIC_KEY)
    );
    return { isValid, body };
  } catch {
    return { isValid: false, body };
  }
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  const bytes = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function messageResponse(content: string, ephemeral: boolean): Response {
  return jsonResponse({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content, flags: ephemeral ? EPHEMERAL_FLAG : 0 },
  });
}
