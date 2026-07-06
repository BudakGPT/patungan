# Patungan — collective remittance + quadratic matching on Stellar

> *"Gotong royong, on-chain."* — the Indonesian diaspora pools small contributions toward
> village projects, and a sponsor's matching pool is split by **Quadratic Funding** so the
> project backed by *the most people* wins the biggest match, not the one backed by one whale.
>
> **Status:** ✅ complete — contract (36 tests green) + frontend (`next build` clean) + deploy/
> seed scripts, all live on Stellar **Testnet**. See [`PROGRESS.md`](PROGRESS.md) for the build log.
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

Prerequisites: `rustup` + `wasm32v1-none` target (`rustup target add wasm32v1-none`),
`stellar-cli` ≥ 27, Node 18+.

```bash
# contract
just contract-test          # cargo test (the QF math + whale-vs-crowd golden test)
just deploy                 # build wasm, deploy to testnet, write ids into frontend/.env.local
just bindings               # regenerate frontend/src/contract/ bindings from the deployed contract

# demo data — DEMO_WALLET is the Freighter address you'll contribute from on stage;
# it MUST be verified or the live contribution is rejected (NotVerified).
DEMO_WALLET=G... just seed  # seed the demo scenario on testnet (idempotent, resumable)

# frontend — imports the bindings' TS source directly; no extra bindings build step needed
cd frontend && npm install
just dev                    # Next.js dev server
```

(If you don't have [`just`](https://github.com/casey/just), open the `justfile` and run the
underlying commands directly.)

### Environment

`scripts/deploy.sh` writes `frontend/.env.local` for you (git-ignored — never committed). It
holds the Testnet wiring the client reads via `process.env.NEXT_PUBLIC_*`:

```
NEXT_PUBLIC_NETWORK=TESTNET
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
NEXT_PUBLIC_CONTRACT_ID=<written by deploy.sh>
NEXT_PUBLIC_TOKEN_ID=<the IDR-stand-in SAC address>
NEXT_PUBLIC_EXPLORER_BASE=https://stellar.expert/explorer/testnet
NEXT_PUBLIC_ADMIN_ADDRESS=<the operator public key>
```

## Running the demo

The whole product is one ~10-second reveal: a matching pool splits so the project backed by
*the most people* wins the biggest match, not the one backed by one whale. After `just deploy`
+ `just seed` + `just dev`, walk the seven steps below (the app's end-to-end acceptance flow):

1. **Landing `/`** — pool shows *Rp100.000.000 · Pemprov Jawa Timur*, status **Open**, three
   projects with live tallies: School ~50 pendukung, Well 1 donatur, both ~Rp1jt terkumpul.
2. **Open School** (`/project/0`) and read the story.
3. **Connect Freighter** as the protagonist — the `DEMO_WALLET` you seeded, a pre-verified PMI
   address. The **✓ Terverifikasi** badge appears.
4. **Chip in Rp50rb** to School → sign in Freighter → success toast + Stellar Expert link;
   School's *pendukung* count ticks up live (optimistic, then reconciled from chain).
5. **Go to `/operator`** as the admin wallet (`NEXT_PUBLIC_ADMIN_ADDRESS`) → click **Finalise**
   → confirm. *(Finalise is one-way — do it live during the reveal, not in rehearsal.)*
6. **`/results`** — the match-curve animates: School's matched bar dwarfs Well's, and the
   caption lands: *"Dana padanan mengikuti jumlah orang, bukan jumlah uang."*
7. *(optional)* **Disburse** from the operator console → each project shows paid out, with
   explorer links proving the on-chain transfer.

The presenter wallet **must be verified** before step 4, or the contribution is rejected
(`NotVerified`); pass it as `DEMO_WALLET=G...` to `just seed`, which registers it.

## Known limitations (hackathon scope — deliberate, not oversights)

- **`init` is not front-run-proof.** Deploy and `init` are two transactions; in a hostile
  environment someone could `init` first and own the contract. `scripts/deploy.sh` runs them
  back-to-back on testnet; production would set the admin atomically in a constructor.
- **No refund/cancel path.** Escrowed funds only leave via `disburse` after `finalize`. If a
  round were never finalized, contributions and pool would stay locked. `fund_pool` also
  checks only round *status*, not `round_end` — a sponsor can still top up after the deadline
  until finalize.
- **Storage TTL is unmanaged.** Persistent entries live well past the hackathon window on
  testnet defaults, but nothing calls `extend_ttl` — a months-idle deployment would need
  re-seeding (or TTL bumps) before reuse.
- **QF weights are aggregated incrementally on-chain** (`contribute` maintains a running
  Σ√cumulative per project), so `finalize`/`preview_matches` read O(projects) ledger entries
  — the tx footprint is crowd-size-independent by construction.

## Docs

The design/planning docs (`docs/`, `BACKLOG.md`, `ISSUE.md`, `prototype-arisan/`) are **local
build scaffolding, deliberately git-ignored** — they are not part of a fresh clone. If you have
the full working repo they're the source of truth:

- `docs/build-spec/` — **the build spec** (frozen; what to build and how to verify it), split by
  concern; start at its `README.md`.
- `docs/prd.md` — the product PRD (problem, mechanism, scope, decisions).
- `docs/quadratic-funding.md` — the QF mechanism deep-dive.
- `docs/pitch-deck-outline.md` — the pitch narrative.
