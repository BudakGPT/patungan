# Patungan monorepo — common tasks.  Run `just <task>`.  (Install: https://github.com/casey/just)
# Recipes assume you run from the repo root.

set shell := ["bash", "-cu"]

# List available tasks
default:
    @just --list

# ---- Contract (Rust / Soroban) ----

# Run the contract test suite (QF math + multi-round + conservation + tier gates)
contract-test:
    cd contracts/patungan && cargo test

# Build the contract wasm
contract-build:
    cd contracts/patungan && stellar contract build

# ---- Deploy / data ----

# Deploy contract + token SAC to testnet (fresh id); writes ids + roles into frontend/.env.local
deploy:
    bash scripts/deploy.sh

# Regenerate the TypeScript contract bindings into frontend/src/contract/
bindings:
    bash scripts/bindings.sh

# Seed the product world (tiers, curated campaigns, a finalized + an open round)
seed:
    npx tsx scripts/seed.ts

# Run the end-to-end smoke test against the currently deployed contract
e2e:
    npx tsx scripts/e2e.ts

# ---- Frontend (Next.js + React + TS) ----

# Install frontend deps
install:
    cd frontend && npm install

# Run the dev server
dev:
    cd frontend && npm run dev

# Production build (type-check + bundle)
build:
    cd frontend && npm run build
