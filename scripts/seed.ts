#!/usr/bin/env -S npx tsx
// Patungan demo seed script (build-spec §8). Idempotent + resumable via
// scripts/.seed-state.json (git-ignored — holds throwaway testnet keypairs).
// Run: npx tsx scripts/seed.ts   (or `just seed`)

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client, Keypair, contract } from "../frontend/src/contract/dist/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, "..", "frontend", ".env.local");
const STATE_PATH = join(__dirname, ".seed-state.json");

const SEED_CROWD_N = Number(process.env.SEED_CROWD_N ?? 50);
const SEED_MID_N = Number(process.env.SEED_MID_N ?? 5);
const SEED_CROWD_AMOUNT = BigInt(process.env.SEED_CROWD_AMOUNT ?? 10_000);
const SEED_MID_AMOUNT = BigInt(process.env.SEED_MID_AMOUNT ?? 50_000);
const SEED_WHALE_AMOUNT = BigInt(process.env.SEED_WHALE_AMOUNT ?? 1_000_000);
const POOL_TARGET = BigInt(process.env.SEED_POOL_TARGET ?? 100_000_000);
const ADMIN_IDENTITY = process.env.PATUNGAN_ADMIN_IDENTITY ?? "patungan-admin";

const PROJECTS = [
  { id: 0, emoji: "🏫", title: "Atap Sekolah SDN 2" },
  { id: 1, emoji: "🌱", title: "Kebun Warga RW 5" },
  { id: 2, emoji: "💧", title: "Sumur Bor Dusun Sumber" },
] as const;

type DonorState = {
  secret: string;
  address: string;
  funded?: boolean;
  verified?: boolean;
  contributed?: boolean;
};

type SeedState = {
  payouts: Record<string, { address: string; funded?: boolean }>;
  crowd: DonorState[];
  mids: DonorState[];
  whale?: DonorState;
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
  if (existsSync(STATE_PATH)) {
    return JSON.parse(readFileSync(STATE_PATH, "utf8"));
  }
  return { payouts: {}, crowd: [], mids: [] };
}

function saveState(state: SeedState) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function ensureDonors(list: DonorState[], count: number): DonorState[] {
  while (list.length < count) {
    const kp = Keypair.random();
    list.push({ secret: kp.secret(), address: kp.publicKey() });
  }
  return list;
}

// Testnet submission can transiently fail with "TRY_AGAIN_LATER" even for a
// well-formed tx (network congestion) — rebuild + resubmit rather than reusing
// the stale assembled tx, since its sequence number may already be consumed.
async function invokeWithRetry(label: string, build: () => Promise<any>, maxAttempts = 5): Promise<any> {
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
      const transient = msg.includes("TRY_AGAIN_LATER") || msg.includes("SendFailed") || msg.includes("Sending the transaction");
      if (!transient || attempt === maxAttempts) throw err;
      console.warn(`   ${label} transient failure (attempt ${attempt}/${maxAttempts}), retrying...`);
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, 20_000);
    }
  }
}

// Friendbot rate-limits aggressively under burst load (§8 robustness) — retry
// with backoff, and treat "account already exists" as success (resumability:
// a prior run may have funded this address before crashing pre-save).
async function fundFriendbot(address: string): Promise<boolean> {
  const url = `https://friendbot.stellar.org?addr=${encodeURIComponent(address)}`;
  let delay = 1000;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
      const body = await res.text();
      if (body.includes("createAccountAlreadyExist")) return true;
      if (res.status !== 429) {
        console.warn(`   friendbot ${address} -> HTTP ${res.status}: ${body.slice(0, 120)}`);
      }
    } catch (err) {
      console.warn(`   friendbot ${address} -> ${(err as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 2, 16_000);
  }
  return false;
}

async function seedCohort(
  label: string,
  donors: DonorState[],
  projectId: number,
  amount: bigint,
  client: Client,
  networkPassphrase: string,
  state: SeedState,
): Promise<void> {
  console.log(`==> Seeding ${label} (${donors.length} target) -> project ${projectId}`);
  let ok = 0;
  for (const donor of donors) {
    if (!donor.funded) {
      donor.funded = await fundFriendbot(donor.address);
      saveState(state);
      if (!donor.funded) {
        console.warn(`   ${donor.address} could not be funded — skipping this run`);
        continue;
      }
    }
    if (!donor.verified) {
      await invokeWithRetry(`register_verified(${donor.address})`, () =>
        client.register_verified({ who: donor.address }),
      );
      donor.verified = true;
      saveState(state);
    }
    if (!donor.contributed) {
      const kp = Keypair.fromSecret(donor.secret);
      const donorSigner = contract.basicNodeSigner(kp, networkPassphrase);
      await invokeWithRetry(`contribute(${donor.address})`, () =>
        client.contribute(
          { donor: donor.address, project_id: projectId, amount },
          { publicKey: donor.address, signTransaction: donorSigner.signTransaction },
        ),
      );
      donor.contributed = true;
      saveState(state);
    }
    ok++;
  }
  console.log(`   ${label}: ${ok}/${donors.length} contributed this session`);
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

  const client = new Client({
    contractId,
    networkPassphrase,
    rpcUrl,
    publicKey: admin.publicKey(),
    signTransaction: adminSigner.signTransaction,
    signAuthEntry: adminSigner.signAuthEntry,
  });

  const state = loadState();
  ensureDonors(state.crowd, SEED_CROWD_N);
  ensureDonors(state.mids, SEED_MID_N);
  if (!state.whale) {
    const kp = Keypair.random();
    state.whale = { secret: kp.secret(), address: kp.publicKey() };
  }
  saveState(state);

  // 1. Pool funding — driven off live chain state so re-runs never overfund.
  console.log("==> Checking pool");
  const config = (await client.get_config()).result;
  if (config.pool < POOL_TARGET) {
    const delta = POOL_TARGET - config.pool;
    console.log(`   funding pool +${delta}`);
    await invokeWithRetry("fund_pool", () => client.fund_pool({ from: admin.publicKey(), amount: delta }));
  } else {
    console.log(`   pool already at ${config.pool}`);
  }

  // 2. Projects (skip any id already registered on-chain).
  console.log("==> Checking projects");
  const existingIds = new Set((await client.list_projects()).result.map((p) => p.id));
  for (const p of PROJECTS) {
    if (existingIds.has(p.id)) {
      console.log(`   project ${p.id} (${p.title}) already registered`);
      continue;
    }
    let payout = state.payouts[String(p.id)];
    if (!payout) {
      const kp = Keypair.random();
      payout = { address: kp.publicKey() };
      state.payouts[String(p.id)] = payout;
      saveState(state);
    }
    if (!payout.funded) {
      payout.funded = await fundFriendbot(payout.address);
      saveState(state);
    }
    console.log(`   registering project ${p.id} (${p.title})`);
    await invokeWithRetry(`register_project(${p.id})`, () =>
      client.register_project({ id: p.id, payout: payout.address, title: p.title, emoji: p.emoji }),
    );
  }

  // 3. Donor cohorts — leave the protagonist's own contribution for the live demo (§8).
  await seedCohort("crowd", state.crowd, 0, SEED_CROWD_AMOUNT, client, networkPassphrase, state);
  await seedCohort("mid", state.mids, 1, SEED_MID_AMOUNT, client, networkPassphrase, state);
  await seedCohort("whale", [state.whale], 2, SEED_WHALE_AMOUNT, client, networkPassphrase, state);

  // 4. Summary — lets the operator eyeball that the reveal will fire.
  console.log("\n==> Summary");
  const projects = (await client.list_projects()).result;
  for (const p of projects) {
    console.log(`   [${p.id}] ${p.emoji} ${p.title} — direct=${p.direct} donor_count=${p.donor_count}`);
  }
  const preview = (await client.preview_matches()).result;
  console.log("   projected matches:", preview.map(([id, m]) => `#${id}=${m}`).join(", "));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
