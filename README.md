<p align="center">
    <img src="frontend/public/assets/patungan-logo.png" alt="Patungan Logo" width="200"/>
</p>

# **Patungan**

Di banyak tempat, **gotong royong** sudah menjadi budaya — saling *urunan* untuk tujuan bersama.  
Tapi bagaimana kalau semangat itu bisa diperkuat oleh teknologi? Bukan sekadar **donasi biasa**, tapi sistem yang memastikan **suara rakyat kecil lebih didengar** dari pada dompet satu orang kaya.

---

**Patungan** menghadirkan **Quadratic Funding** di atas **Stellar blockchain** —  
sebuah mekanisme di mana kontribusi kecil dari *banyak orang* mendapat **matching yang jauh lebih besar** dibandingkan satu donasi besar dari satu pihak.

> *"Gotong royong, on-chain."*

Tujuannya sederhana: mengubah **donasi sosial** menjadi **platform terdesentralisasi** yang transparan, adil, dan bisa diakses siapa saja untuk:

- 💰 **Berkontribusi** ke kampanye sosial pilihan (*Developing Regions, Disaster Relief, Education & Health*)
- ⚖️ **Menyaksikan keadilan** — cause yang didukung *paling banyak orang* mendapat matching terbesar, bukan yang didukung satu whale
- 🔗 **Memverifikasi semua transaksi** langsung di blockchain — **tanpa server, tanpa database**

> **Status:** ✅ Complete — Smart contract (32 tests green, incl. multi-round QF + money conservation + tier-gating) + frontend (Next.js, 9 routes) + deploy/bindings/seed/e2e scripts — all live on Stellar **Testnet**.
>
> 🏆 **APAC Stellar Hackathon** · Payment & Consumer Applications · Stellar **Testnet**

## Deployment
<p align="center">
    <a href="https://patungan-stellar.vercel.app/" target="_blank">
        <br/>
        <b>🌐 Patungan — Live on Vercel</b>
        <br/>
    </a>
    <sub>Hosted on Vercel · Stellar Testnet</sub>
</p>

<p align="center">
    <a href="https://patungan-stellar.vercel.app/">
        <img src="https://img.shields.io/badge/🚀_Live_Demo-patungan--stellar.vercel.app-blue?style=for-the-badge" alt="Live Demo"/>
    </a>
    &nbsp;
    <a href="https://youtube.com" target="_blank">
        <img src="https://img.shields.io/badge/▶_Demo_Video-YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white" alt="Demo Video"/>
    </a>
</p>

## Smart Contract
<p align="left">
    <img src="https://img.shields.io/badge/Contract_ID-CBEWV5XLRNWKB2CRBJYHCJ54FQJMUCU5S2CWL7S7RHCXBTWMZ2NWU4SO-purple?style=flat-square&logo=stellar&logoColor=white" alt="Contract ID"/>
</p>

```
CBEWV5XLRNWKB2CRBJYHCJ54FQJMUCU5S2CWL7S7RHCXBTWMZ2NWU4SO
```

## Contributor
<table>
    <tr>
        <td align="center">
            <a href="https://github.com/KareemMalik">
                <img src="https://avatars.githubusercontent.com/u/179297121?v=4" width="80px;" alt="Malik Alifan Kareem"/>
                <br /><sub><b>Malik Alifan Kareem</b></sub>
                <br /><sub>Project Manager</sub>
            </a>
        </td>
        <td align="center">
            <a href="https://github.com/helvenix">
                <img src="https://avatars.githubusercontent.com/u/109453997?v=4" width="80px;" alt="Helven Marcia"/>
                <br /><sub><b>Helven Marcia</b></sub>
                <br /><sub>Fullstack Developer</sub>
            </a>
        </td>
        <td align="center">
            <a href="https://github.com/haekalhdn">
                <img src="https://avatars.githubusercontent.com/u/178357458?v=4" width="80px;" alt="Haekal Handrian"/>
                <br /><sub><b>Haekal Handrian</b></sub>
                <br /><sub>Fullstack Developer</sub>
            </a>
        </td>
        <td align="center">
            <a href="https://github.com/erikwilbert">
                <img src="https://avatars.githubusercontent.com/u/198186768?v=4" width="80px;" alt="Erik Wilbert"/>
                <br /><sub><b>Erik Wilbert</b></sub>
                <br /><sub>Fullstack Developer</sub>
            </a>
        </td>
    </tr>
</table>

## Architecture Overview

Dua modul, disatukan saat deploy:

<table>
  <tr>
    <th style="width:180px; text-align:left;">Module</th>
    <th style="text-align:left;">Path</th>
    <th style="text-align:left;">Stack</th>
    <th style="text-align:left;">Role</th>
  </tr>
  <tr>
    <td><b>Contract</b></td>
    <td><code>contracts/patungan/</code></td>
    <td>Rust / Soroban</td>
    <td>Holds pools, records tagged contributions, runs the QF match per round, disburses</td>
  </tr>
  <tr>
    <td><b>Frontend</b></td>
    <td><code>frontend/</code></td>
    <td>Next.js 14 + React + TS</td>
    <td>Wallet connect, discovery, campaign self-serve, operator console, seasons archive, verification</td>
  </tr>
  <tr>
    <td><b>Scripts</b></td>
    <td><code>scripts/</code></td>
    <td>Bash + Node/TS</td>
    <td><code>deploy.sh</code> (deploy + write IDs), <code>seed.ts</code> (seed data), <code>e2e.ts</code> (smoke test)</td>
  </tr>
</table>

> **No server, no database** — the frontend reads chain state directly over Soroban RPC.  
> The only coupling between the two modules is the generated TypeScript bindings (`frontend/src/contract/`) plus the contract/token IDs written into `frontend/.env.local`.

## How It Works

- 🏷️ **Categories, not any-cause.** `DevelopingRegions`, `DisasterRelief`, `EducationHealth`.
  Campaigns are submitted, then approved by a **curator** before they're visible or matched.
- 💸 **Two money flows, two cadences.** Direct donations (contributor → campaign) are
  always-open. Matching (sponsor pool → QF split) settles per **round**; a round freezes the
  in-window contribution pattern and splits *that round's* pool. Only one round is `Open` at a
  time.
- 🔐 **Tiered verification.** `Verification(addr) → {None, Basic, Institution}`, written by an
  **attester**. Contributors need `Basic`; sponsors funding a pool need `Institution`. KYC PII
  never touches the chain — only the resulting tier does.
- 🧑‍💼 **Self-serve roles.** ① Sponsor (open/fund/finalize rounds) → ② Contributor (browse, verify,
  give) → ③ Campaign owner (submit a campaign, claim its match).

## **User Roles**

### 🧭 **Guest**
- Hanya bisa mengakses halaman dengan mode *read-only* — browsing kampanye dan melihat hasil QF

### 👤 **Contributor (Basic Verified)**
- Bisa **berkontribusi** ke kampanye yang sudah di-approve
- Harus sudah melewati **verifikasi tier Basic** (via SEP-12 atau simulated attest)

### 🏢 **Sponsor (Institution Verified)**
- Bisa **membuka round baru**, **mendanai matching pool**, dan **finalize round**
- Memerlukan **verifikasi tier Institution**

### 📋 **Campaign Owner**
- Bisa **submit kampanye baru** (*self-serve via /campaign/new*)
- Bisa **claim matched funds** setelah round di-finalize

### 🛠️ **Admin / Curator / Attester**
- Curator: **approve/reject kampanye** yang disubmit
- Attester: **set verification tier** untuk user
- Memiliki **akses ke Operator Console** (`/operator`)

## Routes

<table>
  <tr>
    <th style="width:200px; text-align:left;">Route</th>
    <th style="text-align:left;">Role</th>
    <th style="text-align:left;">What it does</th>
  </tr>
  <tr>
    <td><code>/</code></td>
    <td>Anyone</td>
    <td>Discovery — category filter, search, sort, the current round's banner</td>
  </tr>
  <tr>
    <td><code>/campaign/[id]</code></td>
    <td>Anyone → Contributor</td>
    <td>Campaign detail + inline contribute (gated: connect → Testnet → verified ≥ Basic)</td>
  </tr>
  <tr>
    <td><code>/campaign/new</code></td>
    <td>Campaign Owner</td>
    <td>Self-serve submission (title/story/category/image → IPFS)</td>
  </tr>
  <tr>
    <td><code>/operator</code></td>
    <td>Sponsor / Curator / Attester</td>
    <td>Open/fund/finalize a round, approve/reject campaigns, simulate-attest a tier</td>
  </tr>
  <tr>
    <td><code>/dashboard</code></td>
    <td>Campaign Owner</td>
    <td>Owned campaigns, per-round match status, claim / claim-unmatched</td>
  </tr>
  <tr>
    <td><code>/seasons</code></td>
    <td>Anyone</td>
    <td>Archive of past (finalized) rounds</td>
  </tr>
  <tr>
    <td><code>/results?round=</code></td>
    <td>Anyone</td>
    <td>A single round's QF reveal (direct vs. matched, ranked)</td>
  </tr>
  <tr>
    <td><code>/account</code></td>
    <td>Contributor</td>
    <td>Own contribution history, reconstructed from on-chain contrib events</td>
  </tr>
  <tr>
    <td><code>/verify</code></td>
    <td>Anyone</td>
    <td>SEP-10 anchor auth → SEP-12 KYC (or simulated-attest fallback) → TierBadge</td>
  </tr>
</table>

## Project Layout

```
patungan/
├─ contracts/patungan/     # Soroban contract (Rust)
├─ frontend/               # Next.js 14 App Router app (React + TS)
├─ scripts/                # deploy.sh, seed.ts, e2e.ts
└─ justfile                # common tasks
```

## Getting Started

### Prerequisites
<p align="left">
  <img src="https://img.shields.io/badge/Rust-rustup%20%2B%20wasm32v1--none-orange?style=flat-square&logo=rust&logoColor=white" alt="Rust"/>
  <img src="https://img.shields.io/badge/Stellar_CLI-≥_v27-blue?style=flat-square&logo=stellar&logoColor=white" alt="Stellar CLI"/>
  <img src="https://img.shields.io/badge/Node.js-18%2B-green?style=flat-square&logo=node.js&logoColor=white" alt="Node"/>
</p>

### 1. Clone this repo
```bash
git clone https://github.com/BudakGPT/patungan.git
cd patungan
```

### 2. Build & test the contract
```bash
just contract-test          # cargo test — 32 tests (multi-round QF, conservation, tier gates)
```

### 3. Deploy to Stellar Testnet
```bash
just deploy                 # build wasm, deploy a fresh contract id, init roles, write .env.local
just bindings               # regenerate frontend/src/contract/ from the deployed id
```

### 4. Seed data
```bash
just seed                   # seed categories/campaigns + a finalized round (seasons) + an open round
```

### 5. Run the frontend
```bash
cd frontend && npm install  # frontend deps (bindings import TS source directly, no extra build)
just dev                    # Next.js dev server — visit the routes above
```

### 6. End-to-end smoke test *(optional)*
```bash
just e2e                    # full submit→approve→verify→contribute→finalize→claim smoke test
```

> 💡 If you don't have [`just`](https://github.com/casey/just), open the `justfile` and run the underlying commands directly.

## Environment Variables

`scripts/deploy.sh` writes `frontend/.env.local` for you (git-ignored), holding the Testnet wiring. Two more integrations are opt-in:

```dotenv
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
NEXT_PUBLIC_PINATA_JWT=<a scoped/short-lived Pinata upload JWT>

# --- testnet anchor — needed for real SEP-10/SEP-12 on /verify ---
NEXT_PUBLIC_ANCHOR_HOME_DOMAIN=<anchor's domain, for stellar.toml discovery>
NEXT_PUBLIC_ANCHOR_AUTH_ENDPOINT=<optional explicit SEP-10 WEB_AUTH_ENDPOINT override>
```

> Without the IPFS/anchor vars, the app still builds and runs: `/campaign/new` surfaces a clear "not configured" error, and `/verify` falls back to the labeled **simulated attest**.

## Cost Ledger ($0 on Testnet)

<table>
  <tr>
    <th style="width:200px; text-align:left;">Piece</th>
    <th style="text-align:left;">Provider</th>
    <th style="text-align:left;">Testnet Cost</th>
  </tr>
  <tr>
    <td><b>Image Pin</b></td>
    <td>Pinata (1 GB free) / Filebase (5 GB free)</td>
    <td>$0</td>
  </tr>
  <tr>
    <td><b>Anchor / KYC</b></td>
    <td>SDF reference anchor, or simulated-attest fallback</td>
    <td>$0</td>
  </tr>
  <tr>
    <td><b>Contract + RPC</b></td>
    <td>Stellar Testnet</td>
    <td>$0</td>
  </tr>
</table>

> Money only enters the picture on a real **mainnet** launch — explicitly out of scope for this hackathon.

## Known Limitations (Deliberate)

- 🔐 **SEP-12 is simulated unless you wire a real anchor.** No reference anchor is configured by
  default — `/verify` degrades to the operator-attest path, clearly labeled in the UI.
- 🌐 **IPFS credential is client-visible.** `NEXT_PUBLIC_PINATA_JWT` ships to the browser; use a
  scoped/short-lived upload-only key.
- 🔍 **Discovery/search runs over Soroban RPC directly** (no index) — fine at hackathon scale;
  a free read-index is the escape hatch if it doesn't scale.
- 🔒 **One `Open` round at a time**, contract-enforced — a sponsor must finalize or cancel the
  current round before opening the next.

## Tech Stack
<p align="left">
  <img src="https://img.shields.io/badge/Stellar-Soroban-blue?style=for-the-badge&logo=stellar&logoColor=white" alt="Stellar"/>
  <img src="https://img.shields.io/badge/Rust-Smart_Contract-orange?style=for-the-badge&logo=rust&logoColor=white" alt="Rust"/>
  <img src="https://img.shields.io/badge/Next.js_14-App_Router-black?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js"/>
  <img src="https://img.shields.io/badge/React_18-Frontend-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React"/>
  <img src="https://img.shields.io/badge/TypeScript-Language-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/TailwindCSS-Styling-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="TailwindCSS"/>
  <img src="https://img.shields.io/badge/Framer_Motion-Animations-FF0055?style=for-the-badge&logo=framer&logoColor=white" alt="Framer Motion"/>
</p>

## Others
<p align="left">
    <a href="https://github.com/BudakGPT/patungan">
        <img src="https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub Repo"/>
    </a>
</p>
