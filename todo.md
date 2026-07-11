# Patungan — Engineering TODO

Post-critique roadmap, quality-first (robustness, simplicity, scalability, maintainability over
development cost). Sequencing: **P1 → P2 → P3 → P4 → P5** — the safety net lands before the
indexer refactor it is meant to protect.

Context: design-critique fixes shipped in `3d2371d…6bb8024` (2026-07-11). Contract suite is
healthy (QF math, conservation, tier gates); CI builds frontend but verifies no frontend behavior.

---

## P1 · Frontend safety net

The frontend currently has no lint config and zero tests; CI only proves it compiles.

- [ ] **Configure ESLint** — `next/core-web-vitals` + `@typescript-eslint`; fix or remove the
      existing dead `eslint-disable` comments (they've never done anything). Add to CI.
- [ ] **Tailwind alpha-step lint** — CI check (custom ESLint rule or grep) rejecting
      non-multiple-of-5 opacity suffixes (`bg-white/8`, `/42`, …). This bug has shipped twice.
- [ ] **Unit tests for pure logic** — `format.ts` (IDR, compact, countdown), `lib/demo.ts`,
      `lib/errors.ts` (`mapContractError` fallback chain), QF-adjacent helpers.
- [ ] **Component tests for `ContributePanel`** — gate ladder (connect → network → tier → amount)
      and tx state machine (idle → awaiting-signature → submitting → success/error), contract
      client mocked. Include custom-amount validation (0 / empty / valid / cache patch).
- [ ] **Playwright E2E for wallet-free flows** — landing → campaign detail → results → seasons →
      404, both ID and EN locales, desktop + 390px.
- [ ] **CI: run all of the above** + `tsc --noEmit` as a fast pre-build step.

## P2 · Read-path architecture: indexer + read API

Every visitor polls the public Soroban RPC every 4s (`list_projects`, N× `round_project`,
`preview_round` — the most expensive read). Event-reconstructed features (account history, backer
ledger) depend on RPC retention, which is empirically zero right now. This is the ceiling on
scale, robustness, SSR, and SEO.

- [ ] **Design doc** (`docs/build-spec-indexer.md`): ingestion (contract events → Postgres),
      state polling (one poller, not one per browser), read API shape, cache TTLs, and the
      verification story (indexer figures must be reproducible against `preview_round` /
      explorer links so the trust pitch survives).
- [ ] **Event ingestion service** — subscribes/polls `getEvents` continuously; permanent store
      solves the retention problem for account history + backer ledger forever.
- [ ] **State poller + read API** — campaigns, rounds, tallies, QF preview served as cached JSON
      (route handlers or a small standalone service). Frontend reads switch from RPC to the API;
      **writes (Freighter signing) stay wallet → RPC untouched.**
- [ ] **QF preview computed indexer-side** from tallies (same Σ√c² math), cross-checked against
      `preview_round` in tests.
- [ ] **Convert public pages to server components / streaming** once reads are server-side —
      real first paint, SEO, resilience. Revisit react-query polling intervals (or replace with
      SSE from the indexer).
- [ ] **Fallback behavior** — if the indexer is down, degrade to direct RPC reads (current code
      path) rather than a blank page.

## P3 · Deliberate product/chain decisions

- [ ] **Per-donor matching-weight cap (whale mitigation)** — Season #0's own results page shows
      1 × Rp1jt out-matching 4 × Rp25rb (Rp27,8jt vs Rp11,1jt): correct (Σ√c)² math, fatal
      rhetoric. Decide on capping √c per donor (standard QF mitigation), implement + test in the
      contract, and document the decision either way in `docs/quadratic-funding.md`.
- [ ] **Test-data isolation** — run `scripts/e2e.ts` against an ephemeral contract
      (`deploy.sh` already mints fresh IDs), then **delete `lib/demo.ts`** and its filters.
      Display-layer concealment of test data is a deadline hack, not a policy.
- [ ] **Wallet rehydration audit** — the critique once caught the header stuck on
      "Hubungkan Wallet" while queries hung; review `lib/wallet` reconnect/rehydration path and
      cover it with tests.

## P4 · Locale integrity

Four hand-mirrored ~700-line catalogs; the type system enforces shape, not content.

- [ ] **Catalog-drift CI script** — flag values identical to the ID catalog (excluding
      intentional brand constants) and interpolation-function arity mismatches across
      `strings.{id,en,fil,vi}.ts`.
- [ ] **Locale in a cookie instead of localStorage** — server-readable, kills the ID→EN first
      paint flash without URL routing. Keep `<html lang>` in sync server-side.
- [ ] **Glossary constants** — product nouns (tier names, "dana pendamping"/"matching pool",
      season labels) defined once per catalog and referenced, so a rename can't half-land.

## P5 · Repo & polish

- [ ] **Archive process artifacts** — move `BACKLOG.md`/`-v2`, `ISSUE.md`/`-v2`, `DESIGN.md`, `PRODUCT.md`,
      `PROGRESS.md`/`-v2`, `critique.md`, `ralph/`, `graphify-out/`, `prototype-arisan/`, and other development-purposed docs into `docs/archive/` (or prune). The root should read like a product. Keep all those artifacts in gitignored
- [ ] **Pin toolchain** — `engines` in `package.json` + `.nvmrc` (Node 22 to match CI).
- [ ] **Critique L5: hero reveal on slow paints** — `mode="load"` reveals animate opacity from 0;
      slow devices see a blank hero. Animate transforms only (start visible) or gate on
      `document.fonts.ready`.
- [ ] **Critique L6 (optional)** — featured 2-column first card so a non-multiple-of-3 grid count
      always looks intentional.

---

## Explicitly not doing

- Rewriting the visual direction — the Compiled Ledger system is the asset; the discipline work
  is done and codified.
- Client-side workarounds for event retention (bigger scan windows, retry loops) — P2's ingestion
  is the correct fix; anything else papers over it.
- URL-based locale routing — the cookie approach (P4) gets the SSR benefit without reworking
  navigation.
