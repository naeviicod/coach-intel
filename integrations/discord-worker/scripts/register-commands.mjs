// One-time (or per-update) script that registers /roster with Discord. Runs
// locally against Discord's REST API — never touches the deployed Worker and
// never runs as part of `wrangler deploy`. Uses Discord's bulk-overwrite PUT
// endpoint, which replaces the whole command set for that scope, so re-running
// this is always idempotent — it never creates duplicate commands.
//
// Guild-scoped (recommended while testing — shows up in that server within
// seconds instead of waiting up to an hour for a global rollout):
//   DISCORD_APPLICATION_ID=... DISCORD_BOT_TOKEN=... DISCORD_GUILD_ID=... \
//     npm run register-commands
//
// Global (recommended once this is production-ready — visible in every guild
// the bot is in; omit DISCORD_GUILD_ID):
//   DISCORD_APPLICATION_ID=... DISCORD_BOT_TOKEN=... npm run register-commands

const { DISCORD_APPLICATION_ID, DISCORD_BOT_TOKEN, DISCORD_GUILD_ID } = process.env;

if (!DISCORD_APPLICATION_ID || !DISCORD_BOT_TOKEN) {
  console.error('Missing required env vars: DISCORD_APPLICATION_ID, DISCORD_BOT_TOKEN');
  console.error('(add DISCORD_GUILD_ID too for fast guild-scoped registration; omit it to register globally)');
  process.exit(1);
}

const commands = [
  {
    name: 'roster',
    description: "Show this team's current Coach Intel roster",
    type: 1,
  },
];

const url = DISCORD_GUILD_ID
  ? `https://discord.com/api/v10/applications/${DISCORD_APPLICATION_ID}/guilds/${DISCORD_GUILD_ID}/commands`
  : `https://discord.com/api/v10/applications/${DISCORD_APPLICATION_ID}/commands`;

const res = await fetch(url, {
  method: 'PUT',
  headers: {
    authorization: `Bot ${DISCORD_BOT_TOKEN}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify(commands),
});

if (!res.ok) {
  console.error(`Discord API error ${res.status}: ${await res.text()}`);
  process.exit(1);
}

const registered = await res.json();
const scope = DISCORD_GUILD_ID ? `guild ${DISCORD_GUILD_ID}` : 'globally (all guilds, may take up to an hour to appear)';
console.log(`Registered ${registered.length} command(s) ${scope}:`);
for (const cmd of registered) {
  console.log(`  /${cmd.name} — ${cmd.description}`);
}
