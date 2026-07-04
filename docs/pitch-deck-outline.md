# Pitch Deck Outline — Patungan

> Slide-by-slide outline for the APAC Stellar Hackathon pitch (round-one = **Indonesian
> panel**). Built from `prd.md`. Follows the council's locked framing
> order: **PMI protagonist → transparency → the quadratic-match reveal → funder/Dana Desa
> → tech/Stellar → roadmap.**
>
> **Format target:** ~12 slides, ~4–5 minutes spoken (Demo Day / 5-min Grand Finale).
> **Language:** deliver in **Bahasa Indonesia** for round one; keep slide text bilingual or
> Bahasa-first. **Golden rule:** *file as remittance, but the quadratic match is the hero.*

---

## The spine (memorize this — every slide serves it)
> *A PMI sends Rp50rb to her village. So do 200 neighbours. The government matches the
> crowd 3:1 — and a smart contract proves nobody rigged the split. Breadth beats wealth.*

**One-line pitch:** *"Patungan — gotong royong, on-chain: the village that rallies the
most people wins the biggest match, not the village with one rich donor."*

---

## Slide-by-slide

### 1 — Title / cold open  ·  ~15s
- **On slide:** Logo "Patungan" + tagline *"Gotong royong, on-chain."* + the hook:
  *"Rp50 ribu dari 200 orang mengalahkan Rp10 juta dari 1 orang."*
- **Say:** the hook, verbatim, then "Let me show you why that's true — and why it matters
  for every Indonesian village."
- **Design:** one big sentence, village photo, nothing else. No bullet lists.

### 2 — The protagonist (make it human)  ·  ~30s
- **On slide:** A named PMI — e.g. *"Siti, a caregiver in Hong Kong, from a village in
  East Java."* One photo, one face.
- **Say:** Siti sends money home every month — for her family. But her village's school
  roof has leaked for three years. She'd chip in for it. So would hundreds of others
  abroad. **There's no way for them to do it together, and trust where the money goes.**
- **Rubric:** Real-world fit (25%). *This is the emotional spine — lead here, per council.*

### 3 — The problem (the gap)  ·  ~30s
- **On slide:** Two broken paths:
  1. *Atomized remittances* — billions sent, but only for one family at a time.
  2. *Allocation distrust* — when institutions DO fund villages, who decides, and is it
     fair? (the Dana Desa transparency question)
- **Say:** Remittances are huge (~$14.5B/yr) but private and consumption-bound. And
  community-fund allocation in Indonesia carries a real trust problem. Patungan fixes both.
- **Design:** two icons, minimal text.

### 4 — The insight (solution in one line)  ·  ~20s
- **On slide:** *"Dana padanan mengikuti jumlah ORANG, bukan jumlah UANG."* (The match
  follows the number of **people**, not the amount of **money**.)
- **Say:** This is Quadratic Funding. It's the whole idea. Now watch what it does.
- **Rubric:** Innovation (20%) — plant the flag here.

### 5 — THE REVEAL (the money shot)  ·  ~40s  ⭐
- **On slide:** the worked-example table (animate it building):
  | Project | Raised | Backers | **Match** | **Total** |
  |---|---|---|---|---|
  | 🏫 School roof | Rp1 jt | **100 people** | ~Rp90 jt | **~Rp91 jt** |
  | 🌱 Garden | Rp1 jt | 10 people | ~Rp9 jt | ~Rp10 jt |
  | 💧 Well | Rp1 jt | **1 donor** | ~Rp0,9 jt | ~Rp1,9 jt |
- **Say:** All three raised *exactly the same* Rp1 juta directly. But the school — backed
  by 100 people — takes Rp91 juta from the pool. **The crowd decided, not the rich donor.**
- **Design:** this is your single most important slide. Animate the match column landing.
  This is also the live demo's climax (Slide 10).
- **Rubric:** Innovation (20%) + the "wow".

### 6 — How it works  ·  ~30s
- **On slide:** the 4-phase flow (from PRD §8): Sponsor funds pool → people chip in
  (on-chain) → contract runs `(Σ√c)²` → payout = direct + match.
- **Say:** A sponsor seeds a matching pool. People contribute in small amounts. A Soroban
  smart contract records every contribution publicly, runs the math, and disburses.
- **Design:** simple left-to-right pipeline diagram.

### 7 — Why it can't be rigged (the moat + Sybil)  ·  ~30s
- **On slide:** *"The contract is the referee."* + *"Verified contributors → no fake
  crowds."*
- **Say:** The match depends on *how many real people* gave. So the contract witnesses
  every contribution on-chain (no hidden or invented donors), and a verified-participant
  registry stops one person faking 200. **Off-chain, this fairness is impossible — that's
  why it's on Stellar, not in a spreadsheet.**
- **Rubric:** Technical (25%) + answers the #1 grilling question pre-emptively.

### 8 — Why Stellar  ·  ~20s
- **On slide:** *"Near-zero fees → Rp10rb contributions are viable on-chain. Fast
  settlement. IDR anchors for cash in/out."*
- **Say:** QF needs thousands of tiny contributions. On Ethereum, gas eats a Rp10rb gift.
  Stellar's fees are fractions of a cent — QF needs exactly what Stellar is best at.
- **Rubric:** Technical / deep Stellar usage (25%).

### 9 — The funder model (viability)  ·  ~35s
- **On slide:** *"Government matches the diaspora 3:1"* with the chain: **Province (Dana
  Desa) + BP2MI + BRI**. Precedent badge: *"Mexico 3×1 — ran 20 years."*
- **Say:** Who funds the pool? Governments already do — Indonesia moves **Rp71 trillion/yr**
  through Dana Desa across 75,000 villages. A province commits a slice to match what its
  overseas workers raise, 3:1. BP2MI legitimizes; BRI moves the money. This isn't a
  daydream — Mexico ran exactly this for two decades.
- **Rubric:** Viability & GTM (10%) — the question judges ask first; answer it confidently.

### 10 — Live demo  ·  ~45s
- **Do:** show the whale-vs-crowd scenario on testnet → one big donor on Project A, 50
  small contributors on Project B → finalise → **match visibly flows to B.**
- **Say:** narrate the reveal landing. Keep it to the one moment.
- **Note:** the judged artifact is a **recorded demo video** — record it clean; the live
  run is a bonus. Never depend on a live anchor (it's stretch-only).

### 11 — Traction / scale / market  ·  ~20s
- **On slide:** the §2.4 numbers: ~$14.5B remittances (2023), ~297k new PMI placements
  (2024), top origin provinces, Rp71T Dana Desa.
- **Say:** start with one province corridor, expand across the 5 top-sending provinces,
  then APAC diaspora corridors.

### 12 — Tech, team & roadmap (close)  ·  ~25s
- **On slide:** Soroban contract (live on testnet) · 3-person team · roadmap: SEP-12 KYC,
  real IDR anchor, mainnet pilot → **Stellar Community Fund grant ($150K)**.
- **Say:** It runs today on testnet. Next: a real anchor and a provincial pilot. Close on
  the spine line: *"Breadth beats wealth — and the contract makes it provable."*
- **The ask:** name it (pilot partner intro / the prize / SCF grant).

---

## Timing budget (~4:30)
| Slides | Block | Time |
|---|---|---|
| 1–4 | Hook + human problem + insight | ~1:35 |
| 5–8 | The reveal + how/why it works | ~2:00 |
| 9 | Funder/viability | ~0:35 |
| 10 | Demo | ~0:45 |
| 11–12 | Scale + close/ask | ~0:45 |

> Over budget? Cut Slide 11 first (fold one stat into the close), then Slide 3 (merge into
> Slide 2). **Never cut Slides 5, 7, or 9** — reveal, moat, and funder are load-bearing.

## Rubric coverage check
- **Technical/Stellar 25%** → Slides 7, 8, 10, 12
- **Real-world APAC fit 25%** → Slides 2, 3, 9, 11
- **Innovation 20%** → Slides 4, 5
- **Viability 10%** → Slides 9, 12
- **UX 5%** → Slide 10 (simple flow, Bahasa UI)
- **Team 5%** → Slide 12

## Do / don't
- ✅ Open on Siti, not on architecture. Lead human.
- ✅ Make Slide 5 (the reveal) the visual peak; rehearse the animation.
- ✅ Say "remittance" early (track-fit floor), then make the match the hero.
- ✅ Pitch in Bahasa for round one; have the deck readable bilingually.
- ❌ Don't pitch "cheaper transfers" — that's the commodity trap.
- ❌ Don't bury the match as "a feature."
- ❌ Don't lead with zakat/Islamic-giving (keep it as an optional rail if asked).
- ❌ Don't depend on a live anchor or live testnet in the room — use the recorded demo.

## Sibling docs
`prd.md` (full spec) · `quadratic-funding.md` (mechanism) ·
`../README.md` (rules, rubric, deck reference links).
