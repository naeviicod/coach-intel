#!/usr/bin/env bash
# Interactive, foolproof way to (re)set the Worker's SUPABASE_SERVICE_ROLE_KEY.
# Prompts for the key (hidden input), strips any accidental whitespace/newline
# from the paste, and pipes it straight into `wrangler secret put` via stdin —
# no interactive wrangler prompt to fumble, no key left in shell history.
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

read -r -s -p "Supabase secret key — sb_secret_... (input hidden, paste and press Enter): " KEY
echo
KEY="$(printf '%s' "$KEY" | tr -d '[:space:]')"

if [ -z "$KEY" ]; then
  echo "Nothing pasted — aborted, no change made."
  exit 1
fi

cd "$DIR"
printf '%s' "$KEY" | npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY

echo
echo "Done. Try /roster in Discord again now."
