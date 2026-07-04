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
  Standalone crate (own `[profile.release]`), no root workspace. _(6b3ff2e)_
- [ ] 1.2 Types + DataKey + Error enum
- [ ] 1.3 qf.rs: isqrt + compute_matches (+ remainder rule) — tested
- [ ] 1.4 init / register_verified / register_project / fund_pool
- [ ] 1.5 contribute (cumulative per-donor tagging + rejections)
- [ ] 1.6 finalize / disburse / views incl. preview_matches
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
