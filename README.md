# Patungan — quadratic-matched giving for curated social-impact causes, on Stellar

> *"Gotong royong, on-chain."* — contributors pool small donations toward causes they choose,
> and a sponsor's matching pool is split by **Quadratic Funding** so the cause backed by
> *the most people* wins the biggest match, not the one backed by one whale.
>
> **Status:** ✅ complete — contract (32 tests green, incl. multi-round QF + money conservation
> + tier-gating) + frontend (`next build` clean, 9 routes) + deploy/bindings/seed/e2e scripts,
> all live on Stellar **Testnet**.
>
> APAC Stellar Hackathon · Payment & Consumer Applications · Stellar **Testnet**.

## What this is

Two modules, glued at deploy time:

| Module | Path | Stack | Role |
|---|---|---|---|
| **Contract** (the backend) | [`contracts/patungan/`](contracts/) | Rust / Soroban | Holds pools, records tagged contributions, runs the QF match per round, disburses. |
| **Frontend** (the client) | [`frontend/`](frontend/) | Next.js 14 (App Router) + React + TS | Wallet connect, discovery, campaign self-serve, operator console, seasons archive, verification. Client-rendered (`'use client'`) — no SSR. |
| **Scripts** (the glue) | [`scripts/`](scripts/) | Bash + Node/TS | `deploy.sh` (deploy + write IDs), `seed.ts` (seed data), `e2e.ts` (smoke test). |

There is **no server and no database** — the frontend reads chain state directly over Soroban
RPC. The only coupling between the two modules is the generated TypeScript bindings
(`frontend/src/contract/`) plus the contract/token IDs written into `frontend/.env.local`.
The only two things that live off-chain at all are **image bytes** (IPFS, CID stored on-chain)
and **KYC PII** (the anchor; only the resulting tier attestation is on-chain) — see
[Cost ledger](#cost-ledger-0-on-testnet).

## How it works

- **Categories, not any-cause.** `DevelopingRegions`, `DisasterRelief`, `EducationHealth`.
  Campaigns are submitted, then approved by a **curator** before they're visible or matched.
- **Two money flows, two cadences.** Direct donations (contributor → campaign) are
  always-open. Matching (sponsor pool → QF split) settles per **round**; a round freezes the
  in-window contribution pattern and splits *that round's* pool. Only one round is `Open` at a
  time.
- **Tiered verification.** `Verification(addr) → {None, Basic, Institution}`, written by an
  **attester**. Contributors need `Basic`; sponsors funding a pool need `Institution`. KYC PII
  never touches the chain — only the resulting tier does.
- **Self-serve roles.** ① Sponsor (open/fund/finalize rounds) → ② Contributor (browse, verify,
  give) → ③ Campaign owner (submit a campaign, claim its match).

## Layout

```
patungan/
├─ contracts/patungan/     # Soroban contract (Rust)
├─ frontend/               # Next.js 14 App Router app (React + TS)
├─ scripts/                # deploy.sh, seed.ts, e2e.ts
└─ justfile                # common tasks
```

## Routes

| Route | Role | What it does |
|---|---|---|
| `/` | anyone | Discovery — category filter, search, sort, the current round's banner |
| `/campaign/[id]` | anyone → contributor | Campaign detail + inline contribute (gated: connect → Testnet → verified ≥ Basic) |
| `/campaign/new` | campaign owner | Self-serve submission (title/story/category/image → IPFS) |
| `/operator` | sponsor / curator / attester | Open/fund/finalize a round, approve/reject campaigns, simulate-attest a tier |
| `/dashboard` | campaign owner | Owned campaigns, per-round match status, claim / claim-unmatched |
| `/seasons` | anyone | Archive of past (finalized) rounds |
| `/results?round=` | anyone | A single round's QF reveal (direct vs. matched, ranked) |
| `/account` | contributor | Own contribution history, reconstructed from on-chain `contrib` events |
| `/verify` | anyone | SEP-10 anchor auth → SEP-12 KYC (or the documented simulated-attest fallback) → `TierBadge` |

## Getting started

Prerequisites: `rustup` + `wasm32v1-none` target (`rustup target add wasm32v1-none`),
`stellar-cli` ≥ 27, Node 18+.

```bash
just contract-test          # cargo test — 32 tests (multi-round QF, conservation, tier gates)
just deploy                 # build wasm, deploy a fresh contract id, init roles, write .env.local
just bindings               # regenerate frontend/src/contract/ from the deployed id
just seed                   # seed categories/campaigns + a finalized round (seasons) + an open round
cd frontend && npm install  # frontend deps (bindings import TS source directly, no extra build)
just dev                    # Next.js dev server — visit the routes above
just e2e                    # optional: full submit→approve→verify→contribute→finalize→claim smoke test
```

(If you don't have [`just`](https://github.com/casey/just), open the `justfile` and run the
underlying commands directly.)

`deploy.sh` is always a **fresh deploy** (no in-place upgrade), and writes roles alongside the
usual ids. Attester + curator default to the admin identity on testnet
(`PATUNGAN_ATTESTER_IDENTITY` / `PATUNGAN_CURATOR_IDENTITY` split them if you want distinct keys).
`seed` and `e2e` are idempotent/resumable via git-ignored state files.

## Environment

`scripts/deploy.sh` writes `frontend/.env.local` for you (git-ignored — never committed),
holding the Testnet wiring the client reads via `process.env.NEXT_PUBLIC_*`, plus the attester
and curator addresses. Two more integrations are opt-in and configured by hand:

```
# --- written by deploy.sh ---
NEXT_PUBLIC_NETWORK=TESTNET
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
NEXT_PUBLIC_CONTRACT_ID=<fresh contract id>
NEXT_PUBLIC_TOKEN_ID=<the IDR-stand-in SAC address>
NEXT_PUBLIC_EXPLORER_BASE=https://stellar.expert/explorer/testnet
NEXT_PUBLIC_ADMIN_ADDRESS=<the operator public key>
NEXT_PUBLIC_ATTESTER_ADDRESS=<attester public key>
NEXT_PUBLIC_CURATOR_ADDRESS=<curator public key>

# --- IPFS image pinning — needed for real /campaign/new uploads ---
NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs/
NEXT_PUBLIC_PINATA_JWT=<a scoped/short-lived Pinata upload JWT — client-visible, keep it scoped>

# --- testnet anchor — needed for real SEP-10/SEP-12 on /verify ---
NEXT_PUBLIC_ANCHOR_HOME_DOMAIN=<anchor's domain, for stellar.toml discovery>
NEXT_PUBLIC_ANCHOR_AUTH_ENDPOINT=<optional explicit SEP-10 WEB_AUTH_ENDPOINT override>
```

Without the IPFS/anchor vars, the app still builds and runs: `/campaign/new` surfaces a clear
"not configured" error instead of uploading, and `/verify` falls back to the labeled
**simulated attest** (the attester key sets the tier directly — the honest testnet stand-in for
"the anchor attested this human").

## Cost ledger ($0 on testnet)

| Piece | Provider | Testnet cost |
|---|---|---|
| Image pin | Pinata (1 GB free) / Filebase (5 GB free) | $0 |
| Anchor / KYC | SDF reference anchor, or the simulated-attest fallback above | $0 |
| Contract + RPC | Stellar Testnet | $0 |

Money only enters the picture on a real **mainnet** launch (licensed KYC/anchor per
verification, paid storage/DB at scale) — explicitly out of scope here.

## Known limitations (deliberate, not oversights)

- **SEP-12 is simulated unless you wire a real anchor.** No reference anchor is configured by
  default (`NEXT_PUBLIC_ANCHOR_HOME_DOMAIN` unset) — `/verify` degrades to the operator-attest
  path, clearly labeled in the UI. Point it at an SDF reference anchor to exercise the real flow.
- **IPFS credential is client-visible.** `NEXT_PUBLIC_PINATA_JWT` ships to the browser; use a
  scoped/short-lived upload-only key, not an account-wide secret.
- **Discovery/search runs over Soroban RPC directly** (no index) — fine at hackathon campaign
  counts; a free read-index (Supabase/D1) is the escape hatch if it doesn't scale, but is not
  built here.
- **One `Open` round at a time**, contract-enforced — a sponsor must finalize or cancel the
  current round before opening the next.
