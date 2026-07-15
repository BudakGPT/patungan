#!/usr/bin/env -S npx tsx
// Patungan demo-world seed. Builds a runnable product world on testnet:
// attest tiers, submit + curate ~4 campaigns across the 3 categories, finalize a
// PRIOR round (so `/seasons` isn't empty), then open a CURRENT round with a
// crowd-vs-whale QF pattern. Idempotent + resumable via scripts/.seed-state.json
// (git-ignored — holds throwaway testnet keypairs + progress flags). Runs matching
// via the deployed contract; never reimplements it.
// Run: npx tsx scripts/seed.ts   (never commit generated keys)

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// Import the bindings' TS source directly (tsx compiles it) — dist/ is git-ignored, so a
// clean clone must not depend on it.
import { Client, Keypair, Tier, contract } from "../frontend/src/contract/src/index.ts";
import type { Category } from "../frontend/src/contract/src/index.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, "..", "frontend", ".env.local");
const STATE_PATH = join(__dirname, ".seed-state.json");

const ADMIN_IDENTITY = process.env.PATUNGAN_ADMIN_IDENTITY ?? "patungan-admin";

// Amounts are in stroops (native XLM SAC = the IDR stand-in). Well within the ~10_000 XLM
// friendbot grant each donor gets. The current-round pair is deliberately near-symmetric in
// TOTAL money (8 × CROWD ≈ WHALE), so the QF reveal isolates a single variable — breadth of
// support — and the crowd campaign wins the match on people alone, not on money.
const CROWD_AMOUNT = BigInt(process.env.SEED_CROWD_AMOUNT ?? 500_000);
const WHALE_AMOUNT = BigInt(process.env.SEED_WHALE_AMOUNT ?? 4_000_000);
const PRIOR_POOL = BigInt(process.env.SEED_PRIOR_POOL ?? 50_000_000);
const CURRENT_POOL = BigInt(process.env.SEED_CURRENT_POOL ?? 100_000_000);
const CROWD_N = 8;

const cat = (tag: Category["tag"]): Category => ({ tag, values: undefined } as Category);

// ~4 campaigns spanning all 3 curated categories. image_cid is a placeholder CIDv1; it only
// has to be a non-empty ≤80-char string. Titles ≤96, stories ≤1024 — all within limits.
const PLACEHOLDER_CID = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
const CAMPAIGNS = [
  {
    key: "atap",
    title: "Atap Sekolah SDN 2 Cianjur",
    category: cat("Education"),
    story:
      "Ruang kelas SDN 2 Cianjur bocor parah setiap hujan. Dana ini mengganti rangka atap dan genteng agar 180 murid belajar dengan aman dan kering.",
  },
  {
    key: "jantung",
    title: "Operasi Jantung Bayi Arka",
    category: cat("Health"),
    story:
      "Arka, bayi 8 bulan, lahir dengan kelainan jantung bawaan. Dana ini menutup biaya operasi dan perawatan pascaoperasi yang tak ditanggung penuh.",
  },
  {
    key: "masjid",
    title: "Renovasi Masjid Al-Ikhlas Kampung Nelayan",
    category: cat("FaithCommunity"),
    story:
      "Masjid Al-Ikhlas jadi pusat kegiatan 200 keluarga nelayan, tapi atap dan tempat wudunya lapuk. Renovasi ini mengembalikan ruang ibadah dan belajar warga.",
  },
  {
    key: "mangrove",
    title: "Tanam Mangrove Pesisir Demak",
    category: cat("EnvironmentAnimals"),
    story:
      "Abrasi mengikis pesisir Demak tiap tahun. Penanaman 5.000 bibit mangrove menahan abrasi, memulihkan habitat kepiting, dan melindungi tambak warga.",
  },
  {
    key: "sumur",
    title: "Sumur Bor Dusun Sumber",
    category: cat("DevelopingRegions"),
    story:
      "Warga Dusun Sumber berjalan 3 km demi air bersih. Sumur bor dalam ini melayani 60 keluarga sepanjang musim kemarau panjang.",
  },
  {
    key: "dapur",
    title: "Dapur Umum Banjir Demak",
    category: cat("DisasterRelief"),
    story:
      "Banjir merendam 5 desa di Demak. Dapur umum menyediakan 500 porsi makan hangat setiap hari bagi warga yang mengungsi.",
  },
  {
    key: "kebun",
    title: "Kebun Pangan Warga RW 5",
    category: cat("DevelopingRegions"),
    story:
      "Lahan tidur RW 5 disulap menjadi kebun sayur bersama, menekan biaya pangan 40 keluarga sekaligus melatih pertanian kota.",
  },
] as const;

type Keyed = { secret: string; address: string; funded?: boolean };
type CampaignState = { id?: number; payoutSecret: string; payoutAddress: string; payoutFunded?: boolean };

type SeedState = {
  crowd: Keyed[];
  whale?: Keyed;
  campaigns: Record<string, CampaignState>;
  priorRoundId?: number;
  currentRoundId?: number;
  // Generic idempotency ledger: any completed action is a `true` key so re-runs skip it.
  done: Record<string, true>;
};

function loadEnv(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return out;
}

function loadState(): SeedState {
  if (existsSync(STATE_PATH)) return JSON.parse(readFileSync(STATE_PATH, "utf8"));
  return { crowd: [], campaigns: {}, done: {} };
}
function saveState(state: SeedState) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function ensureKeys(list: Keyed[], count: number) {
  while (list.length < count) {
    const kp = Keypair.random();
    list.push({ secret: kp.secret(), address: kp.publicKey() });
  }
}

// Testnet submission can transiently fail with "TRY_AGAIN_LATER" even for a well-formed tx
// (congestion) — rebuild + resubmit rather than reusing the stale assembled tx, whose sequence
// number may already be consumed. Returns the sent tx so callers can unwrap a return value.
async function invokeWithRetry(label: string, build: () => Promise<any>, maxAttempts = 6): Promise<any> {
  let delay = 2000;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const tx = await build();
      const sent = await tx.signAndSend();
      if (sent.result?.isErr?.()) {
        throw new Error(`${label} failed: ${sent.result.unwrapErr().message}`);
      }
      return sent;
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      const transient =
        msg.includes("TRY_AGAIN_LATER") || msg.includes("SendFailed") || msg.includes("Sending the transaction");
      if (!transient || attempt === maxAttempts) throw err;
      console.warn(`   ${label} transient failure (attempt ${attempt}/${maxAttempts}), retrying...`);
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, 20_000);
    }
  }
}

// Friendbot rate-limits aggressively under burst — retry with backoff; treat "already exists"
// as success (a prior run may have funded before crashing pre-save).
async function fundFriendbot(address: string): Promise<boolean> {
  const url = `https://friendbot.stellar.org?addr=${encodeURIComponent(address)}`;
  let delay = 1000;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
      const body = await res.text();
      if (body.includes("createAccountAlreadyExist")) return true;
      if (res.status !== 429) console.warn(`   friendbot ${address} -> HTTP ${res.status}: ${body.slice(0, 120)}`);
    } catch (err) {
      console.warn(`   friendbot ${address} -> ${(err as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 2, 16_000);
  }
  return false;
}

async function main() {
  const env = loadEnv(ENV_PATH);
  const contractId = env.NEXT_PUBLIC_CONTRACT_ID;
  const networkPassphrase = env.NEXT_PUBLIC_NETWORK_PASSPHRASE;
  const rpcUrl = env.NEXT_PUBLIC_SOROBAN_RPC_URL;
  if (!contractId || !networkPassphrase || !rpcUrl) {
    throw new Error(`missing NEXT_PUBLIC_* config in ${ENV_PATH} — run scripts/deploy.sh first`);
  }

  const adminSecret = execSync(`stellar keys secret ${ADMIN_IDENTITY}`, { encoding: "utf8" }).trim();
  const admin = Keypair.fromSecret(adminSecret);
  const adminSigner = contract.basicNodeSigner(admin, networkPassphrase);

  // The admin identity is also attester + curator on testnet (deploy.sh default), so this one
  // client can attest tiers, curate campaigns, open/fund/finalize rounds — the operator role.
  const client = new Client({
    contractId,
    networkPassphrase,
    rpcUrl,
    publicKey: admin.publicKey(),
    signTransaction: adminSigner.signTransaction,
    signAuthEntry: adminSigner.signAuthEntry,
  });

  const state = loadState();
  ensureKeys(state.crowd, CROWD_N);
  if (!state.whale) {
    const kp = Keypair.random();
    state.whale = { secret: kp.secret(), address: kp.publicKey() };
  }
  saveState(state);

  // --- helpers bound to this run -------------------------------------------------
  const setTier = async (who: string, tier: Tier, label: string) => {
    const key = `tier:${who}:${tier}`;
    if (state.done[key]) return;
    await invokeWithRetry(`set_verification(${label})`, () => client.set_verification({ who, tier }));
    state.done[key] = true;
    saveState(state);
  };

  const fundDonor = async (d: Keyed): Promise<boolean> => {
    if (d.funded) return true;
    d.funded = await fundFriendbot(d.address);
    saveState(state);
    return d.funded;
  };

  const contributeAs = async (d: Keyed, roundId: number, projectId: number, amount: bigint) => {
    const key = `contrib:${roundId}:${d.address}:${projectId}`;
    if (state.done[key]) return;
    const kp = Keypair.fromSecret(d.secret);
    const signer = contract.basicNodeSigner(kp, networkPassphrase);
    await invokeWithRetry(`contribute(${d.address.slice(0, 6)}→p${projectId})`, () =>
      client.contribute(
        { donor: d.address, project_id: projectId, amount },
        { publicKey: d.address, signTransaction: signer.signTransaction },
      ),
    );
    state.done[key] = true;
    saveState(state);
  };

  const fundPoolTo = async (roundId: number, target: bigint) => {
    const round = (await client.get_round({ id: roundId })).result;
    if (round.pool >= target) {
      console.log(`   round ${roundId} pool already ${round.pool}`);
      return;
    }
    const delta = target - round.pool;
    console.log(`   funding round ${roundId} pool +${delta}`);
    await invokeWithRetry(`fund_pool(r${roundId})`, () =>
      client.fund_pool({ from: admin.publicKey(), round_id: roundId, amount: delta }),
    );
  };

  const nowSec = BigInt(Math.floor(Date.now() / 1000));

  // 0. Config sanity — deploy must have init'd the contract.
  const config = (await client.get_config()).result;
  console.log(
    `==> Contract ${contractId}\n   admin=${config.admin}\n   attester=${config.attester} curator=${config.curator}`,
  );

  // 1. Tiers. Admin needs Institution to fund pools; crowd + whale need Basic to contribute.
  console.log("==> Attesting tiers");
  await setTier(admin.publicKey(), Tier.Institution, "admin/Institution");
  for (const d of state.crowd) {
    if (!(await fundDonor(d))) {
      console.warn(`   ${d.address} unfunded — re-run to finish`);
      process.exitCode = 1;
      return;
    }
    await setTier(d.address, Tier.Basic, `crowd ${d.address.slice(0, 6)}`);
  }
  if (!(await fundDonor(state.whale))) {
    console.warn(`   whale ${state.whale.address} unfunded — re-run to finish`);
    process.exitCode = 1;
    return;
  }
  await setTier(state.whale.address, Tier.Basic, "whale");

  // The live-demo Freighter address must be ≥ Basic or the on-stage contribute fails TierTooLow.
  const demoWallet = process.env.DEMO_WALLET;
  if (demoWallet) {
    console.log(`==> Verifying demo wallet ${demoWallet}`);
    await setTier(demoWallet, Tier.Basic, "demo wallet");
  } else {
    console.warn("   NOTE: DEMO_WALLET not set — re-run with DEMO_WALLET=G... to verify the live wallet.");
  }

  // 2. Campaigns — submit (owner=admin) + approve (curator=admin). Match by title against the
  // chain so a lost state file never double-submits.
  console.log("==> Submitting + curating campaigns");
  const onChain = (await client.list_projects()).result;
  const byTitle = new Map(onChain.map((p) => [p.title, p]));
  for (const c of CAMPAIGNS) {
    let cs = state.campaigns[c.key];
    if (!cs) {
      const kp = Keypair.random();
      cs = { payoutSecret: kp.secret(), payoutAddress: kp.publicKey() };
      state.campaigns[c.key] = cs;
      saveState(state);
    }
    // Payout account must exist on-chain to receive a future claim.
    if (!cs.payoutFunded) {
      cs.payoutFunded = await fundFriendbot(cs.payoutAddress);
      saveState(state);
    }

    const existing = byTitle.get(c.title);
    if (existing) {
      cs.id = existing.id;
      saveState(state);
      console.log(`   "${c.title}" already on-chain as #${existing.id} (${existing.status.tag})`);
    } else if (cs.id === undefined) {
      const sent = await invokeWithRetry(`submit_project("${c.title}")`, () =>
        client.submit_project({
          owner: admin.publicKey(),
          title: c.title,
          category: c.category,
          story: c.story,
          image_cid: PLACEHOLDER_CID,
          payout: cs!.payoutAddress,
        }),
      );
      cs.id = Number(sent.result.unwrap());
      saveState(state);
      console.log(`   submitted "${c.title}" as #${cs.id}`);
    }

    // Approve if still Pending.
    const cur = (await client.get_project({ id: cs.id! })).result;
    if (cur.status.tag === "Pending") {
      await invokeWithRetry(`approve_project(#${cs.id})`, () => client.approve_project({ id: cs.id! }));
      console.log(`   approved #${cs.id}`);
    }
  }
  const pid = (key: string): number => {
    const id = state.campaigns[key]?.id;
    if (id === undefined) throw new Error(`campaign ${key} has no id — seed inconsistency`);
    return id;
  };

  // Contribution plans. Prior round exercises a spread; the current round is the crowd-vs-whale
  // reveal (8 small crowd gifts on one campaign vs one whale on another) that QF rebalances.
  const priorPlan = [
    ...state.crowd.slice(0, 4).map((d) => ({ d, key: "atap", amount: CROWD_AMOUNT })),
    ...state.crowd.slice(4, 8).map((d) => ({ d, key: "sumur", amount: CROWD_AMOUNT })),
    { d: state.whale!, key: "dapur", amount: WHALE_AMOUNT },
  ];
  const currentPlan = [
    ...state.crowd.map((d) => ({ d, key: "atap", amount: CROWD_AMOUNT })),
    { d: state.whale!, key: "sumur", amount: WHALE_AMOUNT },
  ];

  // 3. PRIOR round — open (all categories), fund, contribute, FINALIZE so /seasons has history.
  console.log("==> Prior round (finalized season)");
  let rounds = (await client.list_rounds()).result;
  if (state.priorRoundId === undefined) {
    const finalized = rounds.find((r) => r.status.tag === "Finalized");
    const open = rounds.find((r) => r.status.tag === "Open");
    if (finalized) state.priorRoundId = finalized.id;
    else if (open) state.priorRoundId = open.id;
    else {
      const sent = await invokeWithRetry("open_round(prior)", () =>
        client.open_round({ sponsor: admin.publicKey(), round_end: nowSec - 86_400n, categories: [] }),
      );
      state.priorRoundId = Number(sent.result.unwrap());
    }
    saveState(state);
  }
  const priorId = state.priorRoundId!;
  let prior = (await client.get_round({ id: priorId })).result;
  if (prior.status.tag === "Open") {
    await fundPoolTo(priorId, PRIOR_POOL);
    for (const p of priorPlan) await contributeAs(p.d, priorId, pid(p.key), p.amount);
    console.log(`   finalizing round ${priorId}`);
    await invokeWithRetry(`finalize_round(${priorId})`, () => client.finalize_round({ round_id: priorId }));
  } else {
    console.log(`   round ${priorId} already ${prior.status.tag}`);
  }

  // 4. CURRENT round — open (all categories), fund, seed crowd-vs-whale, LEAVE OPEN.
  console.log("==> Current round (open season)");
  rounds = (await client.list_rounds()).result;
  // If the tracked current round has since been finalized/cancelled (e.g. a demo reset), roll to a
  // fresh one: drop the stale id so the block below opens a new Open round instead of no-op warning.
  if (state.currentRoundId !== undefined) {
    const tracked = rounds.find((r) => r.id === state.currentRoundId);
    if (tracked && tracked.status.tag !== "Open") {
      console.log(`   tracked current round ${state.currentRoundId} is ${tracked.status.tag} — opening a fresh round`);
      state.currentRoundId = undefined;
      saveState(state);
    }
  }
  if (state.currentRoundId === undefined) {
    const open = rounds.find((r) => r.status.tag === "Open" && r.id !== priorId);
    if (open) state.currentRoundId = open.id;
    else {
      const sent = await invokeWithRetry("open_round(current)", () =>
        client.open_round({ sponsor: admin.publicKey(), round_end: nowSec + 14n * 86_400n, categories: [] }),
      );
      state.currentRoundId = Number(sent.result.unwrap());
    }
    saveState(state);
  }
  const currentId = state.currentRoundId!;
  const current = (await client.get_round({ id: currentId })).result;
  if (current.status.tag === "Open") {
    await fundPoolTo(currentId, CURRENT_POOL);
    for (const p of currentPlan) await contributeAs(p.d, currentId, pid(p.key), p.amount);
  } else {
    console.warn(`   current round ${currentId} is ${current.status.tag} — expected Open`);
  }

  // 5. Summary — eyeball the seeded world + the live crowd-vs-whale projection.
  console.log("\n==> Summary");
  const projects = (await client.list_projects()).result;
  for (const p of projects) {
    console.log(`   [#${p.id}] ${p.title} (${p.category.tag}, ${p.status.tag}) lifetime=${p.lifetime_direct}`);
  }
  const allRounds = (await client.list_rounds()).result;
  for (const r of allRounds) {
    console.log(`   round ${r.id}: ${r.status.tag} pool=${r.pool} categories=${r.categories.length || "all"}`);
  }
  const preview = (await client.preview_round({ round_id: currentId })).result;
  console.log(
    `   current round ${currentId} projected matches:`,
    preview.map(([id, m]) => `#${id}=${m}`).join(", ") || "(none yet)",
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
