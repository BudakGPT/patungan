#!/usr/bin/env bash
# Regenerate the TypeScript contract bindings into frontend/src/contract/ from the
# currently deployed contract (ids read from frontend/.env.local — run deploy.sh first).
# The frontend imports the bindings' TS SOURCE (frontend/src/contract/src), so no build
# step inside the bindings package is needed after regeneration.
set -euo pipefail

command -v stellar >/dev/null 2>&1 || {
  echo "error: 'stellar' is required but not on PATH — see README 'Getting started'" >&2
  exit 1
}

cd "$(dirname "$0")/.."
ENV_FILE="frontend/.env.local"

CONTRACT_ID=$(grep '^NEXT_PUBLIC_CONTRACT_ID=' "$ENV_FILE" | cut -d= -f2)
[ -n "$CONTRACT_ID" ] || { echo "error: no NEXT_PUBLIC_CONTRACT_ID in $ENV_FILE — run scripts/deploy.sh first" >&2; exit 1; }

# --contract-id fetches the on-chain wasm, so the bindings always match what is deployed
# (and the generated `networks` map carries the right id).
echo "==> Generating TS bindings for $CONTRACT_ID"
stellar contract bindings typescript \
  --output-dir frontend/src/contract \
  --contract-id "$CONTRACT_ID" \
  --network testnet \
  --overwrite

echo "==> Done. Bindings source at frontend/src/contract/src/index.ts"
