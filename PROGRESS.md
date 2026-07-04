# Patungan — Build Progress (mutable loop log)

> The build agent updates this file every iteration — it is **the only file the loop writes to**
> (besides code). Loop protocol: [`ISSUE.md`](ISSUE.md). Task list: [`BACKLOG.md`](BACKLOG.md).
> Frozen spec: [`docs/build-spec.md`](docs/build-spec.md). Format per task: check the box,
> append the commit hash, and add a one-line note for any decision/workaround/blocker. Put
> active BLOCKERs at the very top.

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

---

## Ledger status (mirrors BACKLOG.md — check boxes here, not there)

### Phase 0 — Scaffolding
- [x] 0.1 PROGRESS.md + .gitignore — done during scaffold (also: README.md, justfile, module
  dirs with .gitkeep, docs/ + prototype-arisan/ copied in). _(scaffold, pre-loop)_
- [x] 0.2 Toolchain confirmed — `stellar 27.0.0`, `cargo 1.96.1` (Rust), `node v22.11.0`. All
  print; nothing gated. _(61a88bd)_

### Phase 1 — Contract (THE GATE)
- [x] 1.1 Fork arisan → contracts/patungan; builds — copied arisan crate verbatim (bar renames)
  to `contracts/patungan/`; crate renamed `patungan`, struct `Arisan`→`Patungan`. `#![no_std]`
  kept, deps match arisan (soroban-sdk 22.0.0). `cargo build` green (patungan v0.1.0 compiles).
  Standalone crate (own `[profile.release]`), no root workspace. _(9b98bff)_
- [x] 1.2 Types + DataKey + Error enum — replaced the arisan rotating-savings type layer
  with the frozen §4 surface: `Config`(admin/token/round_end/status/pool), `RoundStatus`
  {Open,Finalized}, `ProjectState` (§4.1); `DataKey` {Config, ProjectIds, Project, Donors,
  Contribution, Verified} (§4.2); `#[contracterror] enum Error` with all 12 variants (§4.5).
  Arisan `init`/`contribute`/`payout` + their tests removed — the real §4.3 entrypoints land in
  1.4–1.6, new tests in 1.3/1.4/1.7. `#[contractimpl]` is intentionally empty for now.
  `cargo build` green. _(f265e9b)_
- [x] 1.3 qf.rs: isqrt + compute_matches (+ remainder rule) — tested — pure chain-free
  `qf.rs`: `isqrt` (Newton, power-of-two over-estimate seed so `x+n/x` never overflows even at
  `u128::MAX`), `project_weight` (`(Σ isqrt(cumulative_d))²`, sqrt-per-donor-total-once §5.2),
  `compute_matches` (floor `pool·w/total`, largest-weight remainder rule §5.3, `NothingToMatch`
  on total_weight==0). Checked arithmetic throughout (§5.5). Wired into `lib.rs` via `mod qf;`
  (file was authored by a prior crashed iteration but never declared → not compiled; that was
  the reconcile). 8 unit tests green incl. whale-vs-crowd pool conservation + remainder-to-
  largest. `cargo test qf` → 8 passed. _(5df136a)_
- [x] 1.4 init / register_verified / register_project / fund_pool — §4.3 setup entrypoints
  land, all returning `Result<_, Error>` (no arisan-style panics). `init` (first caller
  authorizes as admin; opens round, pool=0, empty `ProjectIds`; re-init→`AlreadyInitialized`),
  `register_verified` (admin, idempotent set of `Verified(who)`), `register_project` (admin,
  `DuplicateProject` guard, zeroed tallies, appended to `ProjectIds`), `fund_pool` (ANYONE +
  `from.require_auth()`; `amount>0`→else `InvalidAmount`; `Open`→else `RoundNotOpen`; reused
  arisan `token::Client::transfer` escrow into the contract; `pool+=amount`). Admin gate =
  `config.admin.require_auth()` via `require_admin` helper (signatures carry no caller arg per
  §4.3, so unauthorized callers are stopped by the auth framework — surfacing as an invoke
  error, not `Error::NotAdmin`, which stays in the §4.5 set for the frontend message map).
  `src/test.rs` created (home for 1.5–1.7 too): 7 tests — full setup path asserts token escrow
  + stored state, idempotent re-verify, and rejections for AlreadyInitialized / DuplicateProject
  / InvalidAmount(0 and −1) / RoundNotOpen (status forced Finalized in storage since `finalize`
  is 1.6) / missing-admin-auth. `cargo test` → 15 passed (8 qf + 7 setup), no warnings. _(c8f0c83)_
- [x] 1.5 contribute (cumulative per-donor tagging + rejections) — §4.3 round entrypoint:
  `contribute(donor, project_id, amount)` with `donor.require_auth()`, all returning
  `Result<_, Error>`. Reject order: `amount<=0`→`InvalidAmount`; `status!=Open`→`RoundClosed`;
  `now>round_end`→`RoundClosed` (both closed conditions map to `RoundClosed` per §4.5/B2, distinct
  from `fund_pool`'s `RoundNotOpen`); donor not in `Verified` registry→`NotVerified`; unknown
  `Project(id)`→`UnknownProject`. On success: reused arisan `token::Client::transfer` escrow
  donor→contract, then **cumulative per-donor** tagging (§5.2) — `Contribution(project_id,donor)
  += amount`; a donor is NEW iff `prior==0` (safe since every contribution is `>0`, so a returning
  donor always has `prior>0`), and only then is it pushed to `Donors(project_id)` and
  `donor_count += 1`; `direct += amount` always. Tests (8 new, in `test.rs`): happy-path escrow +
  direct/donor_count/Donors, **`same_donor_twice`** proving cumulative sum + single count (§5.2
  crux), donor-across-two-projects counted in each (§5.6), and rejections for NotVerified /
  UnknownProject / InvalidAmount(0,−1) / RoundClosed(Finalized) / RoundClosed(past round_end via
  `env.ledger().set_timestamp`). `cargo test` → 23 passed (8 qf + 15 integration), no warnings.
  _(6154d2c)_
- [x] 1.6 finalize / disburse / views incl. preview_matches — §4.3 finalisation + read views.
  `finalize` (admin; `AlreadyFinalized` if `status!=Open`; runs the QF split on live state,
  writes each `ProjectState.matched`, flips `status=Finalized`; `NothingToMatch` short-circuits
  BEFORE any write so a no-contribution round stays untouched + Open, §5.6). `disburse(id)`
  (admin; `NotFinalized`/`UnknownProject`/`AlreadyDisbursed` guards; transfers `direct+matched`
  contract→`payout` via the reused arisan transfer idiom; sets `disbursed`, so re-run is a
  rejected no-op §10). Views `get_config`/`list_projects`/`get_project`/`is_verified`/
  `preview_matches`. **Determinism (§10):** a single private `compute_matches_now` helper is the
  ONE QF path — `finalize` persists it, `preview_matches` returns it — so they always agree; test
  `finalize_writes_matches_and_preview_agrees` asserts preview==stored matched[] and `Σ==pool`.
  8 new tests (finalize writes+preview-agrees, finalize-twice, NothingToMatch-stays-Open,
  disburse pays direct+matched & drains escrow, disburse before-finalize/twice/unknown, views).
  `cargo test` → 31 passed (8 qf + 23 integration), no warnings. _(a858037)_
- [ ] 1.7 Full cargo test green (§5.7 golden + §5.6 edge cases)

### Phase 2 — Deploy & bindings
- [ ] 2.1 deploy.sh → testnet, writes CONTRACT_ID + TOKEN_ID
- [ ] 2.2 TS bindings generated into frontend/src/contract/

### Phase 3 — Seed script
- [ ] 3.1 seed.ts (idempotent, rate-limit-tolerant, prints summary)

### Phase 4 — Frontend foundation
- [ ] 4.1 Next.js (App Router)+TS+Tailwind scaffold; providers + config + formatIDR
- [ ] 4.2 rpc + react-query + freighter + WalletButton + network guard
- [ ] 4.3 Contract client + read hooks + 4 UI states

### Phase 5 — Contributor flow
- [ ] 5.1 Landing A1 + A2 (projected match)
- [ ] 5.2 ProjectDetail A3 + ContributeModal B2/B3

### Phase 6 — Operator
- [ ] 6.1 /operator C1 gate + C2 fund + C3 finalize (+C4/C5)

### Phase 7 — Reveal
- [ ] 7.1 /results D1 + D2 match-curve + D3 caption

### Phase 8 — Trust polish
- [ ] 8.1 VerifiedBadge + ExplorerLinks + strings.ts sweep

### Phase 9 — End-to-end
- [ ] 9.1 §9 demo script passes end-to-end on testnet
- [ ] 9.2 README run/deploy/seed/demo; clean-checkout build
