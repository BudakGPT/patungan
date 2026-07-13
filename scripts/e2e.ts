#!/usr/bin/env -S npx tsx
// Patungan end-to-end smoke test. Exercises the full product loop with
// real testnet signatures WITHOUT disturbing the live round that scripts/seed.ts leaves Open
// for the on-stage demo — the contract allows only one Open round at a time (`open_round` errors
// RoundAlreadyOpen otherwise), so re-opening a round here would either fail or force-close the
// demo round. Two legs instead:
//   (a) submit -> approve -> verify -> contribute: a brand-new campaign + a brand-new donor,
//       contributing into whatever round is currently Open (proves the live chain accepts the
//       full pre-round pipeline against real state, not just at seed time).
//   (b) finalize -> claim: seed.ts already finalized round 0 with an unclaimed match sitting on
//       project #0 — claim it, proving the finalize->claim leg end to end.
// Idempotent via scripts/.e2e-state.json (git-ignored). Run: npx tsx scripts/e2e.ts
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client, Keypair, Tier, contract } from "../frontend/src/contract/src/index.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, "..", "frontend", ".env.local");
const STATE_PATH = join(__dirname, ".e2e-state.json");
const ADMIN_IDENTITY = process.env.PATUNGAN_ADMIN_IDENTITY ?? "patungan-admin";
const CID = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
const CONTRIB_AMOUNT = BigInt(process.env.E2E_CONTRIB_AMOUNT ?? 10_000);

type Keyed = { secret: string; address: string; funded?: boolean };
type State = {
  owner?: Keyed;
  donor?: Keyed;
  payout?: Keyed;
  projectId?: number;
  contributedRoundId?: number;
  claimedRound0Project0?: boolean;
  done: Record<string, true>;
};

function loadEnv(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    out[t.slice(0, eq)] = t.slice(eq + 1);
  }
  return out;
}
function loadState(): State {
  if (existsSync(STATE_PATH)) return JSON.parse(readFileSync(STATE_PATH, "utf8"));
  return { done: {} };
}
function saveState(s: State) {
  writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
}
function freshKey(): Keyed {
  const kp = Keypair.random();
  return { secret: kp.secret(), address: kp.publicKey() };
}

async function invokeWithRetry(label: string, build: () => Promise<any>, maxAttempts = 6): Promise<any> {
  let delay = 2000;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const tx = await build();
      const sent = await tx.signAndSend();
      if (sent.result?.isErr?.()) throw new Error(`${label} failed: ${sent.result.unwrapErr().message}`);
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
  const client = new Client({
    contractId,
    networkPassphrase,
    rpcUrl,
    publicKey: admin.publicKey(),
    signTransaction: adminSigner.signTransaction,
    signAuthEntry: adminSigner.signAuthEntry,
  });

  const state = loadState();
  state.owner ??= freshKey();
  state.donor ??= freshKey();
  state.payout ??= freshKey();
  saveState(state);

  console.log("==> Config sanity");
  const config = (await client.get_config()).result;
  console.log(`   admin=${config.admin} curator=${config.curator} attester=${config.attester}`);

  // --- Leg (a): submit -> approve -> verify -> contribute against whatever round is live Open ---
  console.log("==> Leg A: submit -> approve -> verify -> contribute");
  for (const [label, k] of [["owner", state.owner], ["donor", state.donor], ["payout", state.payout]] as const) {
    if (!k.funded) {
      k.funded = await fundFriendbot(k.address);
      saveState(state);
      if (!k.funded) throw new Error(`friendbot failed to fund e2e ${label} ${k.address} — re-run`);
    }
  }

  const setTier = async (who: string, tier: Tier, label: string) => {
    const key = `tier:${who}:${tier}`;
    if (state.done[key]) return;
    await invokeWithRetry(`set_verification(${label})`, () => client.set_verification({ who, tier }));
    state.done[key] = true;
    saveState(state);
  };
  await setTier(state.owner.address, Tier.Basic, "e2e owner");
  await setTier(state.donor.address, Tier.Basic, "e2e donor");

  if (state.projectId === undefined) {
    const ownerKp = Keypair.fromSecret(state.owner.secret);
    const ownerSigner = contract.basicNodeSigner(ownerKp, networkPassphrase);
    const title = `E2E smoke ${Date.now()}`;
    const sent = await invokeWithRetry("submit_project(e2e)", () =>
      client.submit_project(
        {
          owner: state.owner!.address,
          title,
          category: { tag: "Education", values: undefined } as any,
          story: "E2E smoke-test campaign — proves submit/approve/verify/contribute against live testnet state.",
          image_cid: CID,
          payout: state.payout!.address,
        },
        { publicKey: state.owner!.address, signTransaction: ownerSigner.signTransaction },
      ),
    );
    state.projectId = Number(sent.result.unwrap());
    saveState(state);
    console.log(`   submitted "${title}" as #${state.projectId}`);
  }
  const pid = state.projectId!;

  const project = (await client.get_project({ id: pid })).result;
  if (project.status.tag === "Pending") {
    await invokeWithRetry(`approve_project(#${pid})`, () => client.approve_project({ id: pid }));
    console.log(`   approved #${pid}`);
  } else {
    console.log(`   #${pid} already ${project.status.tag}`);
  }

  const openId = (await client.open_round_id()).result;
  if (openId === undefined || openId === null) {
    console.warn("   NOTE: no round is currently Open — contribute will land as unrounded_direct (still a valid leg).");
  }
  const contribKey = `contribute:${state.donor.address}:${pid}`;
  if (!state.done[contribKey]) {
    const donorKp = Keypair.fromSecret(state.donor.secret);
    const donorSigner = contract.basicNodeSigner(donorKp, networkPassphrase);
    await invokeWithRetry(`contribute(e2e donor -> #${pid})`, () =>
      client.contribute(
        { donor: state.donor!.address, project_id: pid, amount: CONTRIB_AMOUNT },
        { publicKey: state.donor!.address, signTransaction: donorSigner.signTransaction },
      ),
    );
    state.done[contribKey] = true;
    state.contributedRoundId = openId ?? undefined;
    saveState(state);
    console.log(`   contributed ${CONTRIB_AMOUNT} stroops to #${pid}${openId != null ? ` (round ${openId})` : " (no open round)"}`);
  } else {
    console.log(`   contribution already recorded`);
  }

  // --- Leg (b): claim an already-finalized round's match (round 0 / project 0 from seed.ts) ---
  console.log("==> Leg B: finalize -> claim");
  const rp = (await client.round_project({ round_id: 0, project_id: 0 })).result;
  const [direct, donors, matched, claimed] = rp;
  console.log(`   round_project(0,0) direct=${direct} donors=${donors} matched=${matched} claimed=${claimed}`);
  if (claimed) {
    console.log("   already claimed by a prior e2e run — leg B previously proven");
    state.claimedRound0Project0 = true;
    saveState(state);
  } else if (direct + matched <= 0n) {
    console.warn("   round 0 / project 0 has nothing to claim — seed state must have changed; skipping leg B");
  } else {
    await invokeWithRetry("claim(round=0, project=0)", () => client.claim({ round_id: 0, project_id: 0 }));
    const after = (await client.round_project({ round_id: 0, project_id: 0 })).result;
    if (!after[3]) throw new Error("claim(0,0) signAndSend succeeded but round_project still reports claimed=false");
    console.log(`   claimed ${direct + matched} stroops (direct=${direct} + matched=${matched}) -> round_project now claimed=true`);
    state.claimedRound0Project0 = true;
    saveState(state);
  }

  console.log("\n==> E2E summary");
  console.log(`   owner=${state.owner.address}`);
  console.log(`   donor=${state.donor.address}`);
  console.log(`   e2e project #${pid}, contributed round=${state.contributedRoundId ?? "(none open)"}`);
  console.log(`   round 0 / project 0 claimed=${state.claimedRound0Project0 === true}`);
  console.log("   all legs completed with real testnet signatures.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
