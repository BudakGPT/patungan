# Patungan — Build Spec: Frontend (§6 architecture, §7 features, frontend §10 rules)

> **Part of the split build spec** (see [`README.md`](README.md)). Read this **with**
> [`overview.md`](overview.md) (frozen §4 contract API + §11 env + §12 DoD). The QF math
> internals live in [`contract.md`](contract.md) — you rarely need them here, except the
> §5.2 note referenced in the optimistic-update rule below.

---

## 6. Frontend architecture

### 6.1 Routes
| Route | File (App Router) | Access | Purpose |
|---|---|---|---|
| `/` | `app/page.tsx` | public | Round overview + project list with live tallies. |
| `/project/:id` | `app/project/[id]/page.tsx` | public | Story + tally + Contribute action. `id` read via `useParams()`. |
| `/results` | `app/results/page.tsx` | public | Direct vs matched + match-curve reveal. |
| `/operator` | `app/operator/page.tsx` | gated to admin wallet | fund_pool, finalize, disburse, seed status. |

Navigation uses `next/link` and `next/navigation` (`useRouter`, `useParams`) — not react-router.

### 6.2 State & data
- Providers live in `app/providers.tsx` (`'use client'`): a single `QueryClientProvider` and
  the `WalletProvider` context, rendered by `app/layout.tsx`. Create the `QueryClient` inside
  the client component (via `useState(() => new QueryClient())`) so it isn't shared across
  requests.
- All reads go through react-query hooks that call contract **views** over Soroban RPC and
  `refetchInterval: 4000` (so tallies update live during the demo).
- Wallet state (address, network, connected) in a `useWallet` hook backed by
  `@stellar/freighter-api`.
- Writes (`contribute`, `fund_pool`, `finalize`, `disburse`) build a tx with stellar-sdk,
  request signature via Freighter, submit via RPC, then invalidate the relevant queries.
- **Optimistic update on `contribute` success (required, not optional).** When the tx confirms,
  don't wait for the ≤4s poll — patch the affected project's cached tally immediately via
  `queryClient.setQueryData`:
  - **`direct` += amount** — always safe (monotonic, exact).
  - **`donor_count` +1 only if this wallet is a *first-time* donor** to that project. The
    contract tags contributions **cumulatively per donor** (§5.2), so a repeat contributor must
    **not** bump the count. If first-time status isn't known cheaply at that moment, patch
    `direct` only and let the poll reconcile `donor_count` within 4s.
  - **Do NOT optimistically recompute `matched`.** Match ∝ (Σ√contribution)² is non-linear
    across *all* donors (§5.2), so a local guess would render a wrong headline number and
    undercut the "QF is honest math" reveal. Leave `matched`/projected-match at its last polled
    value (optionally a subtle "memperbarui…" hint) until the next poll, or refresh it live by
    re-reading the contract's `preview_matches` view — never by local arithmetic.
  - Still call `invalidateQueries` after the patch so authoritative chain data replaces the
    optimistic value on the next tick; roll back the patch on the rare post-success divergence.
- **No global store framework** beyond react-query + a small wallet context.

### 6.3 Global UI states (every data-driven view MUST implement all four)
1. **Loading** — skeleton/spinner; never a blank white screen.
2. **Empty** — e.g. no projects yet → friendly "Belum ada proyek" state.
3. **Error** — RPC/contract error → readable message (map `Error` variants, §4.5) + retry.
4. **Success** — the data.

### 6.4 Transaction UX states (every write button MUST implement all)
`idle → awaiting-signature (Freighter open) → submitting → success (toast + ExplorerLink) →
error (reason + retry)`. Buttons disable while a tx is in flight. Never fire a second tx
while one is pending.

---

## 7. Feature specs (per epic: story · description · acceptance criteria · edge cases · UI states)

Priority: **M**=Must (demo impossible without), **S**=Should, **C**=Could.

### Epic A — Round & Project Discovery (Landing)

**A1 · Round summary banner** · M
- *Story:* As a visitor I see the pool, the sponsor, and round status, so I grasp "a
  province is matching diaspora money."
- *Description:* Top of `/`. Reads `get_config`. Shows: pool via `formatIDR`, sponsor name
  (from `strings.ts`, e.g. "Pemprov Jawa Timur"), status badge (Open/Finalized), and a
  human round-end (from `round_end`).
- *Acceptance:* values come from the contract (change on chain → change on screen after
  poll); status badge reflects `RoundStatus`.
- *Edge cases:* not initialised yet → show "Round belum dibuka" empty state; `pool == 0` →
  show "Menunggu sponsor" rather than "Rp0".
- *UI states:* all four (§6.3).

**A2 · Project list with live tallies + projected match** · M
- *Story:* As a visitor I see each project's direct raised, backer count, and *projected*
  matched share, so the whale-vs-crowd gap is visible before finalisation.
- *Description:* Grid of `ProjectCard` from `list_projects` + `preview_matches`. Each card:
  emoji, title, `direct` (formatIDR), `donor_count` ("X pendukung"), projected match bar,
  link to detail.
- *Acceptance:* projected match sums across cards ≈ pool while Open; after finalize the same
  cards show final `matched`; a new contribution (via B2) changes a card within one poll.
- *Edge cases:* project with 0 donors → "0 pendukung", projected match Rp0, no divide-by-zero;
  `preview_matches` returns `NothingToMatch`-equivalent (empty) → cards show "—" for match.
- *UI states:* all four.

**A3 · Project detail** · M
- *Story:* As a visitor I open a project to read its story and current tally, so I can
  decide to chip in.
- *Description:* `/project/:id` from `get_project`. Shows emoji, title, story (from
  `strings.ts` keyed by id — projects are seeded, so copy can live in strings), `direct`,
  `donor_count`, projected match, and the **Contribute** button (opens B2).
- *Acceptance:* unknown `:id` → not-found state with link home. Contribute button disabled &
  labelled "Round ditutup" when status ≠ Open.
- *UI states:* all four; plus not-found.

### Epic B — Contribute (the one live moment)

**B1 · Connect Freighter** · M
- *Story:* As a contributor I connect my Stellar wallet so I can contribute as myself on
  testnet.
- *Description:* `WalletButton` in the header. Uses freighter-api to detect install,
  connect, read public key + network. Shows truncated address + network pill; supports
  disconnect.
- *Acceptance:* Freighter not installed → CTA linking to install, not a crash. Wrong network
  (not Testnet) → red pill + block writes (E2). Reconnect persists across route changes.
- *Edge cases:* user rejects connect → return to idle, no error toast spam; account not
  funded on testnet → surfaced on first write, not on connect.
- *UI states:* not-installed / disconnected / connecting / connected / wrong-network.

**B2 · Chip in to a project** · M
- *Story:* As a contributor I give a small preset amount in one tap and sign it, so my
  contribution is recorded on-chain tagged to that project.
- *Description:* `ContributeModal` with presets `Rp10rb / 50rb / 100rb` (raw `10_000 /
  50_000 / 100_000`) + confirm. Builds & submits `contribute(donor, project_id, amount)`.
  Full tx UX (§6.4). On success: toast with `ExplorerLink`, close, invalidate project + list
  + preview queries.
- *Acceptance:* the single live demo contribution goes through and moves the target
  project's `donor_count`/`direct` within one poll; verify link opens the real tx on Stellar
  Expert (testnet).
- *Edge cases (each maps to an `Error` variant → specific message):*
  - donor not in verified registry → `NotVerified` → "Alamat belum terverifikasi" (should not
    happen for the seeded protagonist; show clearly if it does).
  - status = Finalized or `now > round_end` → `RoundClosed` → disable + explain.
  - insufficient token balance / trustline missing → surface the RPC/token error plainly.
  - user rejects signature → back to idle.
  - double-submit → blocked while pending.
- *UI states:* §6.4 full set.

**B3 · Contribution reflected live** · M
- *Story:* As a contributor I immediately see my chip-in move the project's numbers, so I
  feel my Rp50rb pulling matching money.
- *Description:* After B2 success, the touched project's card **updates instantly via an
  optimistic cache patch** (§6.2 — `direct` += amount now; `donor_count` +1 only if first-time
  donor; `matched` left to the poll/`preview_matches`, never local math), then reconciles with
  chain data on the next poll (≤4s). The optimistic patch is **required**, so the contributor
  never sees a 4-second dead zone after their own signature.
- *Acceptance:* `direct` jumps immediately on success (before any poll); backer count +1 only
  for a new donor; the projected-match bar refreshes from `preview_matches` within one poll and
  is never shown a locally-guessed value.

### Epic C — Operator Console (Sponsor + Admin, gated)

**C1 · Gated access** · M
- *Story:* As the operator I see the console only when the admin wallet is connected, so
  judges see it's privileged.
- *Description:* `/operator` compares connected public key to `get_config().admin`. Non-admin
  → "Halaman khusus operator" gate, no controls rendered.
- *Acceptance:* controls invisible/inert unless connected wallet == admin.

**C2 · Fund the matching pool** · S
- *Story:* As the sponsor I deposit the matching pool so the round has money to match.
- *Description:* Amount input (default `100_000_000`) → `fund_pool(admin, amount)`; updates
  A1 pool. Usually pre-seeded, but keep the live button for authenticity.
- *Edge cases:* status = Finalized → blocked (`RoundNotOpen`); amount ≤ 0 → blocked client-side.

**C3 · Finalise the round** · M
- *Story:* As the admin I click one "Finalise" button that closes the round and triggers the
  match computation, so the reveal fires on cue.
- *Description:* Confirm dialog ("Tidak bisa dibatalkan") → `finalize()`. On success route to
  `/results` and toast with ExplorerLink.
- *Acceptance:* status flips to Finalized; `matched` values populate; button disables
  afterward.
- *Edge cases:* already finalized → `AlreadyFinalized` disabled state; `NothingToMatch`
  (no contributions) → explain, stay Open.

**C4 · Disburse** · S
- *Story:* As the admin I disburse to projects so the demo shows money leaving the contract.
- *Description:* Per-project "Disburse" buttons (or "Disburse all") → `disburse(id)` each.
  Shows disbursed state.
- *Edge cases:* status ≠ Finalized → blocked; already disbursed → disabled; partial failure
  in "all" → report which succeeded.

**C5 · Seed status readout** · C
- *Story:* As the operator I confirm the seeded scenario is loaded before going live.
- *Description:* Read-only panel: per project donor_count + direct, and a green/red check vs
  the expected demo scenario (§8).

### Epic D — Results & the Reveal (the money shot)

**D1 · Direct vs matched per project** · M
- *Story:* As a visitor I see each project's direct and matched side by side after finalise,
  so I see the crowd's project win the pool.
- *Description:* `/results` from `list_projects`. Per project: direct (formatIDR), matched
  (formatIDR), total, donor_count. Sorted by total desc.
- *Acceptance:* numbers equal the contract's stored `matched`; `Σ matched == pool`.
- *Edge cases:* visited before finalize → show "Round belum difinalisasi" with live projected
  numbers instead of a broken/empty screen.

**D2 · Match-curve reveal animation** · M
- *Story:* As a visitor I watch the matching pool visibly flow toward the many-backer
  project, so the counterintuitive result lands in ~10 seconds.
- *Description:* `MatchCurve` (framer-motion). Each project = a stacked horizontal bar
  (direct segment + animated matched segment). On mount/finalize, matched segments animate
  from 0 → final width; the crowd project's matched segment dwarfs the whale's. Include the
  whale-vs-crowd labels ("1 donatur" vs "X donatur").
- *Acceptance:* animation runs on entering `/results` post-finalize; the crowd project's
  matched bar is visually dominant; re-mount replays cleanly.
- *Edge cases:* zero-donor project → zero-width matched segment, still labelled; reduced-motion
  preference → show final state without animation (accessibility).

**D3 · Plain-Bahasa verdict caption** · S
- *Story:* As a non-crypto judge I read one line that captures the whole idea.
- *Description:* Prominent caption on `/results`: *"Dana padanan mengikuti jumlah orang,
  bukan jumlah uang."* + the 10-second hook line. From `strings.ts`.

### Epic E — Wallet & Identity (cross-cutting)

**E1 · Verified-PMI badge** · S
- *Story:* As a contributor I see a "✓ Terverifikasi" badge when my address is registered, so
  the Sybil-resistance story is visible and pre-empts the judge's #1 attack.
- *Description:* `VerifiedBadge` reads `is_verified(address)`; shown next to the connected
  address and in the contribute modal.
- *Edge cases:* unverified connected wallet → neutral "Belum terverifikasi" (not alarming);
  contribute still blocked server-side by `NotVerified`.

**E2 · Network guard** · S
- *Story:* As a user I'm warned if I'm on the wrong network so the live tx doesn't silently
  fail on stage.
- *Description:* If Freighter network ≠ Testnet, show a persistent banner and disable all
  write buttons.

### Epic F — Transparency surface (cheap, scores "why on-chain")

**F1 · Explorer links on every action** · S
- *Story:* As a skeptical judge I can verify every action is genuinely on-chain.
- *Description:* `ExplorerLink` component → `https://stellar.expert/explorer/testnet/tx/<hash>`
  for each successful contribute/fund/finalize/disburse, and a contract link on the footer:
  `.../contract/<CONTRACT_ID>`.

---

## 10. Non-functional requirements — frontend half
_(The full §10 list is split by concern; the contract half is in [`contract.md`](contract.md).)_

- **RPC failure / timeout:** every read hook surfaces an error state with retry; the app
  never white-screens. A transient RPC error must not crash the reveal.
- **Stale reads during a tx:** after any write, invalidate affected queries; don't show
  pre-tx numbers as if final. (See the §6.2 optimistic-update rule.)
- **Clock/round_end:** the UI disables `contribute` when `now > round_end` to avoid a doomed
  signature (the contract enforces it too).
- **Reduced motion:** respect `prefers-reduced-motion` in D2.
- **Mobile-ish / projector:** the demo is shown on a projector; layout must be legible at
  1280×720 and not require horizontal scroll. (Full mobile polish is out of scope.)
- **Bahasa-first copy** lives in `strings.ts`; no hardcoded UI strings in components.
