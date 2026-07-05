#!/usr/bin/env bash
# Build + deploy the Patungan contract to Stellar Testnet, provision the IDR-stand-in
# token SAC, initialize the round, and write NEXT_PUBLIC_* ids into frontend/.env.local.
# Never hardcode ids in source — this script is the only place they're minted (build-spec §11).
set -euo pipefail

# Fail fast with a legible message on a clean machine (instead of bash's mid-script
# "command not found" after half the steps ran).
for cmd in stellar cargo; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "error: '$cmd' is required but not on PATH — see README 'Getting started'" >&2
    exit 1
  }
done

NETWORK="testnet"
IDENTITY="${PATUNGAN_ADMIN_IDENTITY:-patungan-admin}"
CONTRACT_DIR="contracts/patungan"
ENV_FILE="frontend/.env.local"
ROUND_END_OFFSET_SECS="${ROUND_END_OFFSET_SECS:-604800}" # 7 days — plenty for demo prep + live run

cd "$(dirname "$0")/.."

# 1. Admin identity — funded testnet keypair, reused across runs.
if ! stellar keys public-key "$IDENTITY" >/dev/null 2>&1; then
  echo "==> Generating funded admin identity '$IDENTITY'"
  stellar keys generate "$IDENTITY" --network "$NETWORK" --fund
fi
ADMIN_ADDRESS=$(stellar keys public-key "$IDENTITY")
echo "==> Admin: $ADMIN_ADDRESS"

# 2. IDR-stand-in token: wrap native testnet XLM as a SAC (§4.4 — the QF math is
# decimal-agnostic, so native's 7 decimals don't affect correctness, only display).
# The native SAC is a deterministic, network-wide singleton, so a prior deploy (by
# anyone) makes `asset deploy` fail with "contract already exists" — fall back to
# looking up its id in that case.
echo "==> Deploying token SAC (wrapped native asset)"
TOKEN_ID=$(stellar contract asset deploy --asset native --source-account "$IDENTITY" --network "$NETWORK" 2>/dev/null) \
  || TOKEN_ID=$(stellar contract id asset --asset native --network "$NETWORK")
echo "==> Token: $TOKEN_ID"

# 3. Build + deploy the contract wasm.
echo "==> Building contract wasm"
stellar contract build --manifest-path "$CONTRACT_DIR/Cargo.toml"
WASM_PATH="$CONTRACT_DIR/target/wasm32v1-none/release/patungan.wasm"

echo "==> Deploying contract"
CONTRACT_ID=$(stellar contract deploy \
  --wasm "$WASM_PATH" \
  --source-account "$IDENTITY" \
  --network "$NETWORK")
echo "==> Contract: $CONTRACT_ID"

# 4. init(admin, token, round_end) so get_config is queryable immediately.
ROUND_END=$(( $(date +%s) + ROUND_END_OFFSET_SECS ))
echo "==> Initializing round (round_end=$ROUND_END)"
stellar contract invoke --id "$CONTRACT_ID" --source-account "$IDENTITY" --network "$NETWORK" -- \
  init --admin "$ADMIN_ADDRESS" --token "$TOKEN_ID" --round_end "$ROUND_END"

# 5. Write frontend/.env.local (git-ignored; §11 env contract).
mkdir -p "$(dirname "$ENV_FILE")"
cat > "$ENV_FILE" <<EOF
NEXT_PUBLIC_NETWORK=TESTNET
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
NEXT_PUBLIC_CONTRACT_ID=$CONTRACT_ID
NEXT_PUBLIC_TOKEN_ID=$TOKEN_ID
NEXT_PUBLIC_EXPLORER_BASE=https://stellar.expert/explorer/testnet
NEXT_PUBLIC_ADMIN_ADDRESS=$ADMIN_ADDRESS
EOF

echo "==> Wrote $ENV_FILE"
echo "==> Done. CONTRACT_ID=$CONTRACT_ID TOKEN_ID=$TOKEN_ID ADMIN=$ADMIN_ADDRESS"
