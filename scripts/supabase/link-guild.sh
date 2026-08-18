#!/usr/bin/env bash
# Interactive wrapper for link-guild.js — prompts for the service-role key so
# it's never typed into a long command line (and never lands in shell
# history). Usage: scripts/supabase/link-guild.sh <discordGuildId> <teamId>
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

read -r -s -p "Supabase service_role key (input hidden, paste and press Enter): " SUPABASE_SERVICE_ROLE_KEY
echo
export SUPABASE_SERVICE_ROLE_KEY

node "$DIR/link-guild.js" "$1" "$2"
