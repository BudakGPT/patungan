# APAC Stellar Hackathon — Decision Handoff

> **⏱️ Status: historical decision trail.** The "decision still open" language below reflects
> 2026-06-28. Since then the project (collective-remittance + quadratic
> matching, Payment & Consumer track) — see [`prd.md`](prd.md) §15 for the committed decisions.
> This doc is preserved for the reasoning and the ideas that were ruled out (so we don't loop back).

> Working notes from the idea/track exploration. Captures where the decision
> stands, what was ruled out and why, and what's left to decide.
> Last updated: 2026-06-28.

## TL;DR
- Scope narrowed to **APAC Stellar only** (AIC/COMPFEST parked for now).
- **Arisan-on-chain was explored, prototyped, then shelved** — adoption gap (rural,
  non-digital users) is fatal. Good product call to drop it.
- New direction: **build for freelancers** — a user the builder *is*, so product
  instinct is built-in and the "user can't actually use crypto" objection disappears.
- **Decision still open** between two finalists (escrow vs. collab splitter). Nothing
  committed yet.

---

## Hard constraints (don't relitigate)
- **Deadline: 2026-07-15** (~17 days). Demo Day 07-18, Grand Finale 07-24.
- **Builder: solo, generalist, NEW to Rust/Soroban.** No Rust/Stellar toolchain
  installed yet (Node is). Toolchain setup is day-0 work for *any* track.
- **3 tracks, $20K each, one per team** → track choice is purely a
  *probability-of-winning* call, not a prize call.
- **Deliverables:** project description, public GitHub repo, README, demo video, pitch deck.
- Every Stellar track requires a **Soroban contract in Rust** — so "can I ship a Rust
  contract solo in 17 days" is the real risk, independent of track/idea.

## The decision lens (how we're judging ideas)
1. **On-chain necessity** — does it *need* a contract, or is it "a UI on a database"? (judges' #1 test)
2. **Buildability solo in 17 days** — deployed testnet contract + working demo, not a mockup.
3. **Demo legibility** — can a judge get it in 30 seconds?
4. **APAC judge resonance** — does the problem visibly matter here?
5. **Reachable user** — *the person who benefits must actually be able to use the app.*
   (This is the filter that killed Arisan and that freelancer ideas pass cleanly.)

---

## Track read (quick reference)
| Track | On-chain need | Competition | Social story | Demo | Notes |
|---|---|---|---|---|---|
| **T1 Local Finance** | Strong | Medium | Strongest | High | Best mission-fit; watch oracle/RWA traps |
| **T2 DeFi/Composability** | Strong | **High** | Weakest | Low | Only if you're a DeFi specialist |
| **T3 Payment/Consumer** | **Weak by default** | High | Strong | **Highest** | Must give the contract a real job (escrow/split/stream) |

Freelancer ideas below live in **T3** (or T1 for the splitter).

---

## What was ruled out (and why — so we don't loop back)
- **Arisan / ROSCA on-chain** — shelved. Beneficiaries (rural, informal, non-digital)
  can't realistically use a wallet/stablecoin. Also a saturated hackathon genre.
  - *Partial rescue noted but not pursued:* "online arisan fraud" reframes the user as
    digitally-native and already-scammed — stronger, but still a tired genre.
- **Migrant-worker remittance** — strong on its merits (digital user, acute pain), but
  builder said it doesn't suit them personally. Dropped for fit, not quality.

## Current direction: build for freelancers
Rationale: builder *is* the user → instant product instinct, and the adoption wall vanishes
(freelancers are already digital and already moving money).

### Finalists (decision open)
1. **Milestone escrow for freelance gigs** ⭐ *recommended lead*
   - Client locks full fee in a Soroban contract; releases per milestone on approval;
     contract holds funds if client ghosts.
   - On-chain necessity **HIGH**; demo excellent; contract is a direct evolution of the
     Arisan slice already written. Risk: must design dispute/approval path non-naïvely.
2. **Collab payment splitter** 🎯 *"arisan-flavored" without the adoption problem*
   - One client payment auto-splits by pre-agreed shares to a crew of freelancers.
   - Same "group money, fair rules, no organizer" feel that appealed about arisan.
   - On-chain necessity medium-high; very buildable.

### Also on the table (lower priority)
- **Stablecoin invoicing** (simplest; needs extra teeth to justify the chain).
- **Streaming retainer payments** (coolest demo, high on-chain need, slightly more complex).
- **Freelancer income-smoothing pool** (most arisan-like emotionally, but reintroduces
  arisan's trust/fairness problems — ranked lowest).

---

## Assets already produced
- `prototype-arisan/` — **the Arisan slice (shelved idea, but reusable).**
  - `contracts/arisan/src/lib.rs` — real Soroban contract: escrow on `contribute`,
    queue-enforced `payout`, full rotation, 2 passing tests.
  - `demo/index.html` — self-contained visual of the flow (no toolchain).
  - `prototype-arisan/README.md` — toolchain install + `cargo test` + testnet deploy/invoke runbook.
  - **Still valuable:** the deposit→conditional-release pattern is ~60% of the milestone
    escrow idea. Don't delete — fork it.

## Open questions / next decisions
1. **Pick the finalist:** milestone escrow (#1) vs. collab splitter (#3)?
2. Grill the chosen idea for holes *before* building (recommended), or go straight to a
   real on-chain slice?
3. Install the Rust/Stellar toolchain early — it gates everything and is currently absent.

## Worth remembering
- Builder has sharp product instinct (killed a weak idea unprompted) — lean on it; don't
  pitch ideas with a hollow "social impact" veneer.
- A pretty mockup can make the *weakest* idea look best — judge ideas by on-chain
  necessity + reachable user, not by how the demo looks.
- Sunk cost is not a reason: the Arisan prototype existing is not a reason to ship Arisan.
