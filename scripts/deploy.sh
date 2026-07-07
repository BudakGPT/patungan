#!/usr/bin/env bash
# Build + deploy the Patungan contract to Stellar Testnet, provision the IDR-stand-in
# token SAC, init(admin, token, attester, curator), and write NEXT_PUBLIC_* ids into
# frontend/.env.local. Always a FRESH deploy (new id — no in-place upgrade). Never hardcode
# ids in source — this is the only place they're minted.
set -euo pipefail

# Fail fast with a legible message on a clean machine.
for cmd in stellar cargo; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "error: '$cmd' is required but not on PATH — see README 'Getting started'" >&2
    exit 1
  }
done

NETWORK="testnet"
IDENTITY="${PATUNGAN_ADMIN_IDENTITY:-patungan-admin}"
# Attester + curator default to the admin identity: on testnet the operator holds all three
# roles (attester = operator's key; production swaps it for the anchor's). Set
# PATUNGAN_ATTESTER_IDENTITY / PATUNGAN_CURATOR_IDENTITY to separate them.
ATTESTER_IDENTITY="${PATUNGAN_ATTESTER_IDENTITY:-$IDENTITY}"
CURATOR_IDENTITY="${PATUNGAN_CURATOR_IDENTITY:-$IDENTITY}"
CONTRACT_DIR="contracts/patungan"
ENV_FILE="frontend/.env.local"

cd "$(dirname "$0")/.."

# 1. Identities — funded testnet keypairs, reused across runs.
ensure_identity() {
  local name="$1"
  if ! stellar keys public-key "$name" >/dev/null 2>&1; then
    echo "==> Generating funded identity '$name'"
    stellar keys generate "$name" --network "$NETWORK" --fund
  fi
}
ensure_identity "$IDENTITY"
ensure_identity "$ATTESTER_IDENTITY"
ensure_identity "$CURATOR_IDENTITY"
ADMIN_ADDRESS=$(stellar keys public-key "$IDENTITY")
ATTESTER_ADDRESS=$(stellar keys public-key "$ATTESTER_IDENTITY")
CURATOR_ADDRESS=$(stellar keys public-key "$CURATOR_IDENTITY")
echo "==> Admin:    $ADMIN_ADDRESS"
echo "==> Attester: $ATTESTER_ADDRESS"
echo "==> Curator:  $CURATOR_ADDRESS"

# 2. IDR-stand-in token: wrap native testnet XLM as a SAC. The native SAC is a
# deterministic, network-wide singleton, so a prior deploy makes `asset deploy` fail with
# "contract already exists" — fall back to looking up its id.
echo "==> Deploying token SAC (wrapped native asset)"
TOKEN_ID=$(stellar contract asset deploy --asset native --source-account "$IDENTITY" --network "$NETWORK" 2>/dev/null) \
  || TOKEN_ID=$(stellar contract id asset --asset native --network "$NETWORK")
echo "==> Token: $TOKEN_ID"

# 3. Build + deploy the contract wasm (fresh id).
echo "==> Building contract wasm"
stellar contract build --manifest-path "$CONTRACT_DIR/Cargo.toml"
WASM_PATH="$CONTRACT_DIR/target/wasm32v1-none/release/patungan.wasm"

echo "==> Deploying contract (fresh id)"
CONTRACT_ID=$(stellar contract deploy \
  --wasm "$WASM_PATH" \
  --source-account "$IDENTITY" \
  --network "$NETWORK")
echo "==> Contract: $CONTRACT_ID"

# 4. init(admin, token, attester, curator) so get_config is queryable immediately.
echo "==> Initializing (admin, token, attester, curator)"
stellar contract invoke --id "$CONTRACT_ID" --source-account "$IDENTITY" --network "$NETWORK" -- \
  init \
  --admin "$ADMIN_ADDRESS" \
  --token "$TOKEN_ID" \
  --attester "$ATTESTER_ADDRESS" \
  --curator "$CURATOR_ADDRESS"

# 5. Write frontend/.env.local (git-ignored).
mkdir -p "$(dirname "$ENV_FILE")"
cat > "$ENV_FILE" <<EOF
NEXT_PUBLIC_NETWORK=TESTNET
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
NEXT_PUBLIC_CONTRACT_ID=$CONTRACT_ID
NEXT_PUBLIC_TOKEN_ID=$TOKEN_ID
NEXT_PUBLIC_EXPLORER_BASE=https://stellar.expert/explorer/testnet
NEXT_PUBLIC_ADMIN_ADDRESS=$ADMIN_ADDRESS
NEXT_PUBLIC_ATTESTER_ADDRESS=$ATTESTER_ADDRESS
NEXT_PUBLIC_CURATOR_ADDRESS=$CURATOR_ADDRESS
EOF

echo "==> Wrote $ENV_FILE"
echo "==> Done. CONTRACT_ID=$CONTRACT_ID TOKEN_ID=$TOKEN_ID"
echo "==> Roles: admin=$ADMIN_ADDRESS attester=$ATTESTER_ADDRESS curator=$CURATOR_ADDRESS"
