# Patungan — Code Critique

> Review of the repo as of `5fe7e28` (Phases 0–5 complete, 6–9 pending).
> Each finding: **what's wrong → why it matters → recommended fix**, ordered by severity.
> Severity is calibrated to the actual goal: a flawless live hackathon demo + a repo judges can clone and run.
>
> **Fix pass 2026-07-06:** every finding below is marked with its outcome. All code findings
> are **[DONE]** (contract redeployed with the hardened build + reseeded; 36 tests green;
> clean frontend build; real `finalize`+`disburse` landed on-chain). H3 stays **[OPEN]** only
> for the parts that *are* the remaining backlog (operator console 6.1 + results page 7.1).

---

## What's solid (for contrast, and so it doesn't get "fixed")

- `qf.rs` is genuinely good: pure/chain-free, overflow-safe Newton isqrt with the power-of-two seed trick, checked arithmetic, exact pool conservation via the remainder rule, and 8 focused unit tests including `isqrt(u128::MAX)`.
- One canonical `compute_matches_now` shared by `finalize` and `preview_matches` — the two can't disagree by construction.
- 34 tests including the §5.7 golden whale-vs-crowd scenario and the full §5.6 edge set; auth, idempotency, and cumulative-donor tagging are all covered.
- Seed script is idempotent and resumable, drives pool funding off live chain state, and handles friendbot 429s and `TRY_AGAIN_LATER` correctly (rebuilding the tx per retry, not reusing a stale sequence number).
- The decisions log in PROGRESS.md is real engineering hygiene — every spec deviation is recorded with a reason.

---

## 🔴 Critical — fix before demo day

### [DONE] C1. A clean clone does not build: the TS bindings `dist/` is gitignored but everything imports it

> ✅ **Resolution:** all imports (4 frontend files + `seed.ts`) now point at the bindings' TS
> source `@/contract/src` / `frontend/src/contract/src/index.ts` — Next/tsx compile it, no
> dist needed. Verified: `next build` passes and a tsx import smoke-test resolves. CI's
> clean-checkout build guards against regression.

- **Where:** `.gitignore` (`dist/`), vs `frontend/src/lib/hooks.ts:4`, `frontend/src/lib/contract.ts:1`, `ContributeModal.tsx:6`, `ProjectCard.tsx:4`, and `scripts/seed.ts:10` — all import `.../contract/dist/index.js`. `git ls-files` confirms only `src/contract/src/index.ts` + configs are committed.
- **Why it matters:** A judge (or you, on a different machine) cloning the repo gets a frontend that fails `npm run build` and a seed script that can't run. Task 9.2 ("clean-checkout build") is guaranteed to fail as-is, and this is the kind of thing discovered 30 minutes before submission.
- **Fix (pick one):**
  1. Import from the TS source instead: change imports to `@/contract/src` (or re-export via `frontend/src/contract/index.ts`) and let Next compile it — simplest, no build step.
  2. Or add a `prebuild`/`postinstall` script in `frontend/package.json` that runs `npm ci && npm run build` inside `src/contract/`.
  3. Or force-commit `frontend/src/contract/dist/` (`git add -f`) since it's generated-but-required.
  Then actually do a scratch-directory `git clone && npm ci && npm run build` to prove it.

### [DONE] C2. `finalize` may not fit in one Soroban transaction with the seeded 56 donors — and it has never been executed on-chain

> ✅ **Resolution:** implemented fix #2 (the correct one): `contribute` maintains a running
> `SumSqrt(project)` aggregate, so `finalize`/`preview_matches` read O(projects) ledger
> entries — crowd-size-independent by construction. Empirically verified: a real
> `finalize` **and** `disburse` landed on-chain on a throwaway deployment of the new wasm
> (contract `CDZQ…F742`, status → `Finalized`, `matched` == pool, payout transferred).
> Demo contract redeployed as `CATB…CTL3` and reseeded.

- **Where:** `contracts/patungan/src/lib.rs:384` (`compute_matches_now`) reading `Donors(id)` + one `Contribution(id, donor)` entry per donor.
- **Why it matters:** With the seeded scenario (50 crowd + 5 mid + 1 whale), a real `finalize` tx must read ~63 ledger entries (56 contributions + 3 donor vecs + 3 projects + instance). Soroban enforces per-tx ledger-entry read limits (40 at protocol-20 launch; raised since, but this footprint is in the same order of magnitude). Crucially, `preview_matches` succeeding proves nothing — it only ever runs as a *simulation*; `finalize` is the first time this code path must land as a submitted transaction, and it is the climax of your demo (the QF reveal).
- **Fix:**
  1. **Now, not in Phase 9:** deploy a throwaway contract, run the full seed, and submit a real `finalize` (via `stellar contract invoke`). If it lands, note the resource usage and move on.
  2. If it exceeds limits: cheapest mitigation is `SEED_CROWD_N=25`-ish (the whale-vs-crowd story survives); the *correct* fix is maintaining a running `sum_sqrt` per project in `contribute` (subtract `isqrt(prior)`, add `isqrt(prior + amount)`) so `finalize` reads 3 aggregates instead of 56 entries — this also fixes the O(donors) scalability ceiling (see M4).

### [DONE] C3. The presenter's live wallet is never verified — the on-stage chip-in will fail with `NotVerified`

> ✅ **Resolution:** `seed.ts` now takes `DEMO_WALLET=G...` and idempotently
> `register_verified`s it on every run, and warns loudly when unset; README documents it in
> Getting started. **One action left for you:** run `DEMO_WALLET=<your Freighter address>
> just seed` (or tell me the address and I'll register it) — I can't know your wallet.

- **Where:** `contribute` requires the donor in the `Verified` registry (`lib.rs:224-231`); `scripts/seed.ts` verifies only the generated throwaway donors. Nothing in the repo registers the Freighter wallet you'll demo with, and the operator console (6.1) that could do it live doesn't exist yet.
- **Why it matters:** The single interactive moment of the demo — "now I chip in from my own wallet" — errors out in front of the judges (and, per C4, with a raw English error blob instead of the Bahasa message).
- **Fix:** Add an optional `DEMO_WALLET` env to `seed.ts` that calls `register_verified` on it (idempotent, so safe on every run), and put "seed ran + demo wallet verified + one rehearsal contribution succeeded" on a written pre-demo checklist. The 6.1 operator console should also include a verify-address form as the on-stage fallback.

### [DONE] C4. Contract errors that fail at *simulation* time bypass the Bahasa error map — users see raw SDK error strings

> ✅ **Resolution:** `mapError` now (1) matches bare variant names from on-chain results,
> (2) extracts `Error(Contract, #N)` from thrown simulation strings and translates via the
> bindings' `Errors[N].message`, and (3) falls back to the generic Bahasa message (raw
> details go to `console.error`, never the UI).

- **Where:** `ContributeModal.tsx:24-31` (`mapError`) and `:66-68`. The `sent.result.isErr()` branch only fires for errors from a tx that reached the ledger. But most contract rejections (`NotVerified`, `RoundClosed`, `UnknownProject`…) fail during the simulation inside `contractClient.contribute()` / `signAndSend()`, which **throws** — landing in the `catch` with a message like `"Transaction simulation failed: ... Error(Contract, #3)"`. That string matches no key in `strings.contribute.errors`, so `mapError` falls through to returning `raw` — a multi-line English/XDR blob rendered in the UI.
- **Why it matters:** Every realistic failure mode in the live demo produces unreadable output instead of the copy you wrote for exactly these cases.
- **Fix:** In `mapError`, extract the code with `/Error\(Contract, #(\d+)\)/`, look it up in the generated `Errors[code].message` (the bindings already map `3 → "NotVerified"` etc.), then map through `strings.contribute.errors`. And change the final fallback from `raw` to `strings.contribute.errors.generic` — never render raw internals (log them to console instead).

---

## 🟠 High

### [DONE] H1. A single transient RPC failure blanks the whole UI even though data is cached

> ✅ **Resolution:** `QueryState` and `RoundBanner` now render whenever `data !== undefined`
> (with a small amber "menampilkan data terakhir" notice while errored); the full error
> panel is reserved for errored-with-nothing-cached.

- **Where:** `QueryState.tsx:21` and `RoundBanner.tsx:17` render the error branch on `query.isError`.
- **Why it matters:** All hooks poll every 4s against public testnet RPC. In react-query v5, a *failed background refetch* (after retries) flips `status` to `error` while `data` is still present — so one RPC hiccup mid-presentation replaces the fully-rendered project grid with "Terjadi kesalahan". Public testnet RPC hiccups are not hypothetical.
- **Fix:** Render data whenever `query.data !== undefined` (optionally with a small "data mungkin usang / stale" chip when `isError`); reserve the full error panel for `isError && data === undefined`. ~5 lines in `QueryState`, mirrored in `RoundBanner`.

### [DONE] H2. Wallet state goes stale after connect — the E2 network guard can be silently defeated

> ✅ **Resolution:** `WalletProvider` runs freighter-api's `WatchWalletChanges` (3s poll)
> while connected — network/account switches update `canWrite` and `NetworkBanner` live,
> and a revoked access drops the connection.

- **Where:** `frontend/src/lib/wallet.tsx` reads address/network once at mount and once at `connect()`; nothing watches for changes.
- **Why it matters:** E2's whole job is "wrong network must be impossible to miss before a live tx". But if the user switches Freighter to Mainnet (or another account) *after* connecting, `canWrite` stays `true`, `NetworkBanner` stays hidden, and the app signs with a stale address on the wrong network. The tx would fail (wrong passphrase), but the guard you built specifically for this is blind to it.
- **Fix:** Use `WatchWalletChanges` from `@stellar/freighter-api` v6 (or a cheap 3–5s poll of `getNetwork()`/`getAddress()`) inside `WalletProvider` to keep `address`/`network` live.

### [OPEN — reorder done, pages remain backlog] H3. The unbuilt phases *are* the product's argument — schedule risk, not code risk

> 🔶 **Resolution (partial):** the recommended reorder happened — the C2 end-to-end
> finalize test ran FIRST and reshaped the contract before 6.1/7.1 get built on top. The
> terminal fallback is proven (`stellar contract invoke … finalize` works — that exact
> command finalized the throwaway round). The operator console (6.1) and results page
> (7.1) are the next backlog tasks, not critique fixes.

- **Where:** `frontend/app/operator/page.tsx` and `results/page.tsx` are title-only stubs; Phases 6–9 unchecked in PROGRESS.md.
- **Why it matters:** Everything shipped so far is setup. The pitch — "the crowd beats the whale" — only lands via the operator's finalize button (6.1) and the results reveal chart (7.1). Meanwhile the C2 verification is parked in Phase 9, *after* the pages that depend on it.
- **Fix:** Reorder: run the C2 end-to-end finalize test **first** (it can invalidate contract/seed decisions), then 6.1 → 7.1, and treat 8.1 polish as cuttable. Keep a rehearsed fallback: finalize via `stellar contract invoke` from a terminal if the operator console slips.

---

## 🟡 Medium

### Contract

- **[DONE — documented] M1. `init` is front-runnable.** *Resolution: took the recommended cheap route — an honest entry in README "Known limitations" (a `__constructor` refactor wasn't worth destabilizing the frozen §4 surface mid-hackathon).* Deploy and `init` are two separate txs (`scripts/deploy.sh:39-49`); anyone watching the network could call `init` first and own the contract. Negligible on testnet, but it's the first thing a Soroban-literate judge will spot. *Fix:* use soroban-sdk 22's `__constructor` so admin is set atomically at deploy — or, cheaper, one honest line in the README's limitations section.
- **[DONE] M2. No events are emitted.** *Resolution: `(fund, from)`, `(contrib, id, donor)`, `(match, id)`, `(final)`, `(payout, id)` now published on every state change; verified live (the throwaway finalize printed its `final` event on-chain) + a unit test.* `contribute`/`fund_pool`/`finalize`/`disburse` leave no `env.events().publish()` trail — activity is invisible on explorers (undercutting your own E-epic "trust" story) and the frontend is forced into 4s polling. *Fix:* publish minimal events (topic + project id + amount). Doesn't touch the frozen fn signatures.
- **[DONE] M3. Unchecked arithmetic is inconsistent with the stated error policy.** *Resolution: `pool`, `direct`, `donor_count`, the per-donor cumulative, and the disburse sum are all `checked_*` → `InvalidAmount` now.* `qf.rs` scrupulously uses checked math → legible `Error`, but `config.pool += amount` (`lib.rs:193`), `project.direct += amount` (`:262`), and `donor_count += 1` trap opaquely on overflow (release profile has `overflow-checks = true`, so they abort rather than wrap — safe, but illegible). *Fix:* `checked_add(...).ok_or(Error::InvalidAmount)?` for consistency.
- **[DONE] M4. `finalize` is O(total donors) in one tx — a hard scalability ceiling.** *Resolution: fixed with C2 via the running `SumSqrt` aggregate — the QF split is O(projects); design noted in README.* Root cause of C2. Fine for the demo, but the pitch claims a funding platform. *Fix:* the running `sum_sqrt` aggregate from C2's fix #2; at minimum, own it in the README ("demo-scale; production maintains incremental weights").
- **[DONE — documented] M5. Escrowed funds have no exit besides `disburse`.** *Resolution: documented in README "Known limitations" as recommended; behavior unchanged (the frozen spec specifies only the status check).* If a round is never finalized (or a project never disbursed), tokens are stuck in the contract forever; `fund_pool` also stays open past `round_end` (only `status` is checked, `lib.rs:188`, unlike `contribute`). *Fix:* acceptable for the hackathon — document it; a production note would add an admin `cancel`/refund path and mirror the `round_end` check in `fund_pool`.
- **[DONE — documented] M6. No TTL management.** *Resolution: documented in README "Known limitations"; the fresh redeploy also reset all TTLs well past demo day.* Persistent/instance entries expire eventually; nothing calls `extend_ttl`. Testnet defaults comfortably outlive the hackathon — just don't let the demo contract sit for weeks and then trust old state.

### Frontend

- **[DONE] M7. `useProject` fires with `NaN` and takes seconds to show "not found".** *Resolution: `useProject(id, enabled)` gates on `isValidId` and retries once — not-found renders fast, NaN never hits the wire.* `project/[id]/page.tsx:14` computes `Number(params.id)` and calls `useProject(id)` unconditionally; for `/project/abc` the query encodes `NaN` and for a genuinely unknown id the contract panic is retried 3× with backoff by react-query before `isError` — several seconds of "Memuat…" before "Proyek tidak ditemukan". *Fix:* pass `enabled: isValidId` into the query, and set `retry: 1` (or detect the panic/`MissingValue` shape and skip retries) for `useProject`.
- **[DONE] M8. Partial seed failures exit 0.** *Resolution: skips are counted across cohorts; any skip prints `==> INCOMPLETE` and sets `process.exitCode = 1` (still resumable).* `seed.ts:140` skips a donor friendbot couldn't fund, prints a warn, and the run still "succeeds" — a half-seeded demo scenario looks like a green run. *Fix:* count skips and `process.exitCode = 1` with a loud summary line when any donor was skipped.
- **[DONE] M9. `ContributeModal` has no dialog semantics.** *Resolution: `role="dialog"`, `aria-modal`, `aria-labelledby`, Escape + backdrop-click close (blocked while a tx is in flight), initial focus on the panel.* No `role="dialog"`/`aria-modal`, no Escape handling, no focus trap, backdrop click doesn't close (`ContributeModal.tsx:98`). Cheap wins judges do notice. *Fix:* the ~10-line version: `role="dialog" aria-modal="true"`, `onKeyDown` Escape → `onClose` (when not `pending`), autofocus the first button.

---

## ⚪ Low / polish

- **[DONE] L1. Dead code:** *(both deleted)* `frontend/src/lib/rpc.ts` (`server` is imported nowhere) and `freighter.ts#signTransactionXdr` (the modal uses `freighterApi.signTransaction` directly). Delete both — dead paths in a judged repo read as leftovers.
- **[DONE] L2. `tsconfig` target ES2017 forced the `BigInt(0)` workaround.** *(target is ES2020; literals are `0n`/`10_000n`; runtime `BigInt(amount)` conversions rightly remain)* Bump `target` to `ES2020` and use `0n`/`10_000n` literals; removes a whole class of awkwardness (`page.tsx:17`, `ProjectCard.tsx:20-21`).
- **[DONE] L3. ProjectDetail mislabels the button while the round query is loading.** *(unknown round state renders the normal label disabled; only a KNOWN `Finalized` round says "Round ditutup")* `isOpen` is `false` when `round.data` is `undefined` (`project/[id]/page.tsx:56`), so the CTA briefly renders disabled "Round ditutup" on every load. *Fix:* treat "unknown" as its own state (disabled + "Memuat…" or just the normal label disabled).
- **[DONE] L4. `deploy.sh` doesn't check prerequisites.** *(deploy.sh and the new bindings.sh fail fast with a README pointer when `stellar`/`cargo` are missing)* A missing `stellar` CLI dies with a bash "command not found" mid-script. A 3-line `command -v stellar || die` with a friendly message helps clean-machine graders. Same idea for `npx tsx` in the seed docs.
- **[DONE] L5. `connect()` swallows real Freighter errors.** *(genuine failures set `connectError`, shown beside the wallet button; user rejections stay silent per B1)* `wallet.tsx:62-73` intentionally ignores *rejection* (per B1), but genuine errors (`access.error`) are also dropped with zero feedback. Distinguish them; show `strings.errorGeneric` for the latter.
- **[DONE] L6. No CI.** *(`.github/workflows/ci.yml`: `cargo test` + clean-checkout `next build` on every push/PR)* For a repo built by an autonomous loop, a 15-line GitHub Action running `cargo test` + `npm run build` is cheap insurance against a regression landing silently between iterations.

---

## Suggested order of attack — status

1. ~~**C2** — prove `finalize` lands on-chain~~ ✅ done first, as recommended — and it reshaped the contract (SumSqrt aggregate) before 6.1/7.1 build on top.
2. ~~**C1** — bindings import path~~ ✅ done; CI guards the clean-checkout build.
3. ~~**C3 + C4** — demo-wallet verification + error-code mapping~~ ✅ done (C3 needs your `DEMO_WALLET=G...` on the next seed run).
4. ~~**H1, H2** — stale-data rendering + wallet watching~~ ✅ done.
5. **Phase 6.1 → 7.1** — the operator console and the reveal page — ⏭ NEXT (the remaining backlog); the terminal-invoke finalize fallback is already proven.
6. ~~**M-tier / L-tier**~~ ✅ all done or documented (see markers above).
