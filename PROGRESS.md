# Patungan — Build Progress (mutable loop log)

> The build agent updates this file every iteration — it is **the only file the loop writes to**
> (besides code), and it is **re-read in full every iteration, so keep it lean.** Loop protocol:
> [`ISSUE.md`](ISSUE.md). Task list: [`BACKLOG.md`](BACKLOG.md). Frozen spec (split by concern):
> [`docs/build-spec/`](docs/build-spec/) — start at its `README.md`. Per task: check the box +
> append the short commit hash + **≤2 lines** of note (only a gotcha a future iteration needs).
> Put the detailed narrative in the **commit message**, not here. Active 🚧 BLOCKERs at the top.

## 🚧 Blockers (top priority — clear these first)
_None yet._

## 🧭 Decisions log (choices made where the spec was silent)
- 2026-07-04 — **Monorepo** at repo root `patungan/` (contract + frontend + scripts), one git
  repo. **No server backend** — frontend reads chain directly via Soroban RPC.
- 2026-07-04 — **Name = Patungan** (briefly "WeFund", reverted; generic + collides with
  Wefunder). The `docs/` are the source of truth; hackathon repo `apac-stellar-hackathon/` is
  a read-only context archive.
- 2026-07-04 — `prototype-arisan/` copied into repo root as the **fork source** for the
  contract (task 1.1). It is reuse scaffolding, not shipped as the product.
- 2026-07-04 — Demo model = **seeded crowd + one live chip-in**; **Sponsor role folded into
  the Operator console**; seed crowd **N=50** default (not 100) for testnet rate limits.
- 2026-07-04 — **Frontend framework = Next.js 14 (App Router)**, switched from Vite + React at
  the user's direction. No SSR/server benefit (data is client-side wallet + live Soroban RPC),
  so it's used purely as the SPA framework: every wallet/RPC component is `'use client'`, env
  is `NEXT_PUBLIC_*` in `frontend/.env.local`, routing is file-based `app/`, no react-router.
  (Recorded per §2 "do not substitute without recording a decision.")
- 2026-07-05 — **QF overflow surfaces `Error::InvalidAmount`** (task 1.3). §4.5's frozen error
  set has no dedicated `Overflow` variant, and §5.5 proves the products stay ≤ ~4·10²⁰ ≪
  `i128::MAX` so overflow is unreachable in practice; where checked arithmetic could still fail
  (`checked_add`/`checked_mul` in `qf.rs`) we return `InvalidAmount` ("numbers out of range")
  rather than `panic!`, keeping the failure legible off-chain and staying within the frozen §4.5
  variant set.
- 2026-07-05 — **QF split bridges storage→`qf` slices via `alloc` (task 1.6).** `qf::project_weight`/
  `compute_matches` take `&[i128]`/`&[u128]`; `finalize`/`preview_matches` must feed them per-donor
  totals read from soroban storage `Vec`s. Under `#![no_std]` that needs a transient heap `Vec`, so
  `extern crate alloc;` (soroban-sdk installs a wasm global allocator) — kept `qf.rs` pure/untouched
  rather than reshaping its tested slice API. `preview_matches` (frozen `-> Vec`, no `Result`) maps
  the `NothingToMatch` error to an **empty vec** so the frontend renders "—" pre-contribution (§A2).
- 2026-07-04 — **Optimistic UI on `contribute` success is required** (was optional in B3): patch
  `direct` (+amount) and `donor_count` (+1 only for first-time donors) via
  `queryClient.setQueryData` on tx success, then invalidate to reconcile. `matched` is **never**
  computed locally (QF is non-linear, §5.2) — it refreshes from the poll / `preview_matches`.
- 2026-07-05 — **IDR-stand-in token = wrapped native testnet XLM** (task 2.1), not a custom
  issued asset. §4.4 says the QF math is decimal-agnostic regardless of the SAC's decimals, and
  §8/§9 never require a custom issuer; wrapping native avoids issuer-account + trustline setup
  for every seeded donor (§8's 50 crowd keypairs need funding either way via friendbot).
- 2026-07-06 — **Critique-driven hardening (see `critique.md`), contract redeployed.** (a) New
  `DataKey::SumSqrt(u32)`: `contribute` maintains a running Σ√(per-donor cumulative), so
  `finalize`/`preview_matches` read O(projects) entries — a 56-donor finalize no longer risks
  the per-tx ledger-read footprint (verified: real finalize+disburse landed on a throwaway
  deploy). (b) Events on fund/contrib/match/final/payout. (c) Checked arithmetic on all tallies.
  (d) Frontend/seed import the bindings' **TS source** (`src/contract/src`), never git-ignored
  `dist/` — clean clones build. (e) `seed.ts` takes `DEMO_WALLET` to verify the presenter's
  Freighter address. New CONTRACT_ID in `frontend/.env.local`; reseed from kept keypairs.

---

## Ledger status (mirrors BACKLOG.md — check boxes here, not there)

### Phase 0 — Scaffolding
- [x] 0.1 PROGRESS.md + .gitignore + scaffold (README, justfile, module dirs, docs/ +
  prototype-arisan/). _(scaffold, pre-loop)_
- [x] 0.2 Toolchain confirmed — stellar 27.0.0, cargo 1.96.1, node v22.11.0. _(61a88bd)_

### Phase 1 — Contract (THE GATE) — ✅ all green, gate closed
> Full narrative for each is in the commit body; notes below keep only downstream-relevant gotchas.
- [x] 1.1 Fork arisan → contracts/patungan; builds. **Standalone crate** (own
  `[profile.release]`, no root workspace); struct `Arisan`→`Patungan`, soroban-sdk 22.0.0. _(9b98bff)_
- [x] 1.2 Types + DataKey + Error enum — frozen §4 surface; all 12 §4.5 variants. _(f265e9b)_
- [x] 1.3 qf.rs isqrt + compute_matches + remainder — pure/chain-free, checked arith (§5.5),
  sqrt-per-donor-total-once (§5.2), wired via `mod qf`. _(5df136a)_
- [x] 1.4 init/register_verified/register_project/fund_pool (§4.3 setup). **Gotcha for the
  frontend:** the admin gate is `require_auth()`, so unauthorized calls surface as a Soroban
  **invoke error, not `Error::NotAdmin`** (that variant stays in §4.5 for the message map). _(c8f0c83)_
- [x] 1.5 contribute — cumulative per-donor tagging (§5.2), new-donor iff `prior==0`. Both
  closed conditions → `RoundClosed` (distinct from fund_pool's `RoundNotOpen`). _(6154d2c)_
- [x] 1.6 finalize/disburse/views + preview_matches — one private `compute_matches_now` path
  (finalize persists it, preview returns it → always agree, §10). `preview_matches` maps
  `NothingToMatch`→**empty vec** for the UI. _(a858037)_
- [x] 1.7 Full suite green — §5.7 golden (crowd wins, `Σ matched==pool`) + all §5.6 edges.
  **34 tests pass. Phase 1 GATE closed.** _(cda264a)_

### Phase 2 — Deploy & bindings
- [x] 2.1 deploy.sh → testnet, writes CONTRACT_ID + TOKEN_ID. **Toolchain gotcha:** stellar-cli
  27 builds for `wasm32v1-none`, which needs `rustup target add wasm32v1-none` +
  `soroban-sdk` `features = ["alloc"]` (else "no global memory allocator" — our manual
  `extern crate alloc` alone doesn't wire one up for that target). _(6c2e555)_
- [x] 2.2 TS bindings generated into frontend/src/contract/ — **Gotcha:** frontend root has
  no package.json yet (4.1 not done), so verify ran as `npm install && npm run build` *inside*
  `frontend/src/contract/` (its own generated tsconfig), not `cd frontend && tsc`. _(e7e5981)_

### Phase 3 — Seed script
- [x] 3.1 seed.ts — scenario live: School 50 donors/830k direct, Well 1 whale/1M direct,
  projected matches #0=92.6M vs #2=2.3M (crowd wins). **Gotcha:** testnet tx submission can
  throw `SendFailed`/`TRY_AGAIN_LATER` transiently (distinct from friendbot 429s) — added
  `invokeWithRetry` around every `signAndSend()`, rebuilding the tx each attempt since a stale
  assembled tx's sequence number may already be consumed. _(82f07e0)_

### Phase 4 — Frontend foundation
- [x] 4.1 Next.js (App Router)+TS+Tailwind scaffold; providers + config + formatIDR. **Found
  pre-built from a prior uncommitted iteration** — verified `npm run build`/`npm run dev`
  both pass (4 routes, HTTP 200) before committing. _(bdc9daa)_
- [x] 4.2 rpc.ts (Soroban `rpc.Server`) + `lib/freighter.ts` + `useWallet` (`lib/wallet.tsx`)
  + `WalletButton` + `NetworkBanner` (E2) wired into `Header`/`providers.tsx`. **Gotcha:**
  `freighter-api` v6's `getAddress()` errors if the origin was never granted access — call
  `isAllowed()` first and only read the address when it's true, else silently stay idle. _(d27d9e3)_
- [x] 4.3 Contract client + read hooks + 4 UI states. **Found pre-built from a prior
  uncommitted iteration**; added missing `refetchInterval: 4000` (§6.2) to all 4 hooks,
  verified live against deployed testnet contract (School 830000/50 donors dominates
  preview_matches as expected) before committing. _(5b6c33d)_

### Phase 5 — Contributor flow
- [x] 5.1 Landing A1 + A2 — `RoundBanner` (pool/sponsor/status/round-end) + `ProjectCard`
  (projected-match bar via `preview_matches`). Verified against live testnet: School 92.6M /
  Garden 5.1M / Well 2.3M match, summing exactly to the 100M pool. _(c298ce0)_
- [x] 5.2 ProjectDetail A3 + ContributeModal B2/B3 — presets 10k/50k/100k, full tx UX,
  optimistic `direct`/`donor_count` patch via `contributionTracker.ts` session-scoped
  first-donor heuristic, `matched` never recomputed locally. _(f1f0ad7)_

### Phase 6 — Operator
- [x] 6.1 /operator C1 gate + C2 fund + C3 finalize + C4 disburse. **Gotcha:** didn't run
  finalize against the live demo contract to verify (would end the presenter's Open round
  prematurely) — verified gate logic against read-only `get_config` (admin matches
  `NEXT_PUBLIC_ADMIN_ADDRESS`, status still `Open`) + `npm run build`/dev-server SSR loading
  state, matching 5.2's precedent for write paths needing a real signature. _(pending commit)_

### Phase 7 — Reveal
- [ ] 7.1 /results D1 + D2 match-curve + D3 caption

### Phase 8 — Trust polish
- [ ] 8.1 VerifiedBadge + ExplorerLinks + strings.ts sweep

### Phase 9 — End-to-end
- [ ] 9.1 §9 demo script passes end-to-end on testnet
- [ ] 9.2 README run/deploy/seed/demo; clean-checkout build
