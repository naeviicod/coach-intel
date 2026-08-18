#!/usr/bin/env bash
# Interactive wrapper for register-commands.mjs — prompts for the bot token so
# it's never typed into a long command line or left in shell history.
# Usage: scripts/register-commands.sh <discordApplicationId> [discordGuildId]
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DISCORD_APPLICATION_ID="$1"
DISCORD_GUILD_ID="$2"

if [ -z "$DISCORD_APPLICATION_ID" ]; then
  echo "Usage: scripts/register-commands.sh <discordApplicationId> [discordGuildId]"
  exit 1
fi

read -r -s -p "Discord bot token (input hidden, paste and press Enter): " DISCORD_BOT_TOKEN
echo
export DISCORD_APPLICATION_ID DISCORD_GUILD_ID DISCORD_BOT_TOKEN

cd "$DIR" && npm run register-commands
