# Patungan — collective remittance + quadratic matching on Stellar

> *"Gotong royong, on-chain."* — the Indonesian diaspora pools small contributions toward
> village projects, and a sponsor's matching pool is split by **Quadratic Funding** so the
> project backed by *the most people* wins the biggest match, not the one backed by one whale.
>
> **Status:** 🚧 in build. Monorepo scaffold. See [`docs/build-prd.md`](docs/build-prd.md) for
> the full build spec and [`PROGRESS.md`](PROGRESS.md) for live progress.
>
> APAC Stellar Hackathon · Payment & Consumer Applications · Stellar **Testnet**.

## What this is

Two modules, glued at deploy time:

| Module | Path | Stack | Role |
|---|---|---|---|
| **Contract** (the backend) | [`contracts/patungan/`](contracts/) | Rust / Soroban | Holds the pool, records tagged contributions, runs the QF match, disburses. |
| **Frontend** (the client) | [`frontend/`](frontend/) | Next.js 14 (App Router) + React + TS | Wallet connect, browse/contribute, operator console, the match-curve reveal. Client-rendered (`'use client'`) — no SSR. |
| **Scripts** (the glue) | [`scripts/`](scripts/) | Bash + Node/TS | `deploy.sh` (deploy + write IDs) and `seed.ts` (seed the demo scenario). |

There is **no server and no database** — the frontend reads chain state directly over Soroban
RPC. The only coupling between the two modules is the generated TypeScript bindings
(`frontend/src/contract/`) plus the contract/token IDs written into `frontend/.env.local`.

The Rust contract is forked from [`prototype-arisan/`](prototype-arisan/) (a working
deposit→escrow→release slice with passing tests) — that's ~60% of the engine.

## Layout

```
patungan/
├─ contracts/patungan/     # Soroban contract (Rust)  — forked from prototype-arisan
├─ frontend/               # Next.js 14 App Router app (React + TS)
├─ scripts/                # deploy.sh, seed.ts
├─ prototype-arisan/       # reuse base (fork source; not shipped as product)
├─ docs/                   # build-prd.md (spec), prd.md (product), + context
├─ PROGRESS.md             # mutable build log
└─ justfile                # common tasks
```

## Getting started

Prerequisites: `rustup` + `wasm32-unknown-unknown` target, `stellar-cli`, Node 18+. The
toolchain runbook lives in [`prototype-arisan/README.md`](prototype-arisan/README.md).

```bash
# contract
just contract-test          # cargo test (the QF math + whale-vs-crowd golden test)
just deploy                 # build wasm, deploy to testnet, write ids into frontend/.env.local

# demo data
just seed                   # seed the demo scenario on testnet

# frontend
cd frontend && npm install
just dev                    # vite dev server
```

(If you don't have [`just`](https://github.com/casey/just), open the `justfile` and run the
underlying commands directly.)

## Docs

- [`docs/build-prd.md`](docs/build-prd.md) — **the build spec** (frozen; the source of truth
  for what to build and how to verify it).
- [`docs/prd.md`](docs/prd.md) — the product PRD (problem, mechanism, scope, decisions).
- [`docs/quadratic-funding.md`](docs/quadratic-funding.md) — the QF mechanism deep-dive.
- [`docs/pitch-deck-outline.md`](docs/pitch-deck-outline.md) — the pitch narrative.
