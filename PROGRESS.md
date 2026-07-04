# Patungan — Build Progress (mutable loop log)

> The build agent updates this file every iteration. Spec is `docs/build-prd.md` (immutable).
> Format per task: check the box, append the commit hash, and add a one-line note for any
> decision/workaround/blocker. Put active BLOCKERs at the very top.

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

---

## Ledger status (mirrors build-prd.md §13)

### Phase 0 — Scaffolding
- [x] 0.1 PROGRESS.md + .gitignore — done during scaffold (also: README.md, justfile, module
  dirs with .gitkeep, docs/ + prototype-arisan/ copied in). _(scaffold, pre-loop)_
- [ ] 0.2 Toolchain confirmed (stellar/cargo/node)

### Phase 1 — Contract (THE GATE)
- [ ] 1.1 Fork arisan → contracts/patungan; builds
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
- [ ] 4.1 Vite+React+TS+Tailwind+router scaffold; config + formatIDR
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
