import { test } from 'node:test';
import assert from 'node:assert/strict';
import nacl, { type SignKeyPair } from 'tweetnacl';
import { verifyDiscordRequest } from '../src/discord.js';
import type { Env } from '../src/env.js';

function makeEnv(publicKeyHex: string): Env {
  return {
    DISCORD_APPLICATION_ID: 'app-id',
    DISCORD_PUBLIC_KEY: publicKeyHex,
    DISCORD_BOT_TOKEN: 'bot-token',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  };
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function signedRequest(keyPair: SignKeyPair, timestamp: string, body: string) {
  const signature = nacl.sign.detached(new TextEncoder().encode(timestamp + body), keyPair.secretKey);
  return new Request('https://worker.example/', {
    method: 'POST',
    headers: {
      'X-Signature-Ed25519': toHex(signature),
      'X-Signature-Timestamp': timestamp,
    },
    body,
  });
}

test('verifyDiscordRequest accepts a validly signed request', async () => {
  const keyPair = nacl.sign.keyPair();
  const body = JSON.stringify({ type: 1 });
  const request = signedRequest(keyPair, '1700000000', body);

  const result = await verifyDiscordRequest(request, makeEnv(toHex(keyPair.publicKey)));
  assert.equal(result.isValid, true);
  assert.equal(result.body, body);
});

test('verifyDiscordRequest rejects a body that does not match the signature', async () => {
  const keyPair = nacl.sign.keyPair();
  const signed = signedRequest(keyPair, '1700000000', JSON.stringify({ type: 1 }));
  const tampered = new Request('https://worker.example/', {
    method: 'POST',
    headers: {
      'X-Signature-Ed25519': signed.headers.get('X-Signature-Ed25519')!,
      'X-Signature-Timestamp': signed.headers.get('X-Signature-Timestamp')!,
    },
    body: JSON.stringify({ type: 2 }),
  });

  const result = await verifyDiscordRequest(tampered, makeEnv(toHex(keyPair.publicKey)));
  assert.equal(result.isValid, false);
});

test('verifyDiscordRequest rejects a signature from the wrong key', async () => {
  const signer = nacl.sign.keyPair();
  const otherKey = nacl.sign.keyPair();
  const body = JSON.stringify({ type: 1 });
  const request = signedRequest(signer, '1700000000', body);

  const result = await verifyDiscordRequest(request, makeEnv(toHex(otherKey.publicKey)));
  assert.equal(result.isValid, false);
});

test('verifyDiscordRequest rejects missing signature headers', async () => {
  const request = new Request('https://worker.example/', { method: 'POST', body: '{}' });
  const result = await verifyDiscordRequest(request, makeEnv('00'.repeat(32)));
  assert.equal(result.isValid, false);
});
