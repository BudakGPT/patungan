# Patungan monorepo — common tasks.  Run `just <task>`.  (Install: https://github.com/casey/just)
# Recipes assume you run from the repo root. Contract lives in contracts/patungan once forked.

set shell := ["bash", "-cu"]

# List available tasks
default:
    @just --list

# ---- Contract (Rust / Soroban) ----

# Run the contract unit tests (QF math + whale-vs-crowd golden test)
contract-test:
    cd contracts/patungan && cargo test

# Build the contract wasm
contract-build:
    cd contracts/patungan && stellar contract build

# Deploy contract + token SAC to testnet; writes ids into frontend/.env
deploy:
    bash scripts/deploy.sh

# Regenerate the TypeScript contract bindings into frontend/src/contract/
bindings:
    bash scripts/bindings.sh

# ---- Demo data ----

# Seed the demo scenario (crowd vs whale) on testnet
seed:
    npx tsx scripts/seed.ts

# ---- Frontend (Vite + React + TS) ----

# Install frontend deps
install:
    cd frontend && npm install

# Run the dev server
dev:
    cd frontend && npm run dev

# Production build (type-check + bundle)
build:
    cd frontend && npm run build
