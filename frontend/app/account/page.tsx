"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ProjectState } from "@/contract/src";
import { Tier } from "@/contract/src";
import { useWallet } from "@/lib/wallet";
import { useContributions, useCampaigns, useTier } from "@/lib/hooks";
import type { Contribution } from "@/lib/events";
import { formatIDR } from "@/lib/format";
import { categoryMeta } from "@/lib/category";
import { useStrings } from "@/lib/locale";
import { ExplorerLink } from "@/components/ExplorerLink";

/**
 * Contributor account `/account`. The "me" surface: my verification tier, my
 * total impact, and every direct donation I've signed — reconstructed purely from on-chain
 * `contrib` events over RPC (no backend), grouped by campaign into a scannable statement. Reuses
 * the `/dashboard` ledger idiom (surface row-cards, tinted category chips, quiet ledger totals);
 * the impact figure is a header band, never a hero-metric card.
 */
export default function AccountPage() {
  const strings = useStrings();
  const a = strings.account;
  const { address, status, connect } = useWallet();

  return (
    <main className="mx-auto max-w-page px-4 py-8 sm:px-6 sm:py-10">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-bold leading-[1.1] tracking-tight text-ink sm:text-[2.25rem]">
          {a.title}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted">{a.subtitle}</p>
      </header>

      <div className="mt-8">
        <Gate status={status} connecting={status === "connecting"} onConnect={connect}>
          {address ? <AccountBody owner={address} /> : null}
        </Gate>
      </div>
    </main>
  );
}

/** Gate ladder — connect → Testnet → history. No tier gate: anyone may review their own giving. */
function Gate({
  status,
  connecting,
  onConnect,
  children,
}: {
  status: ReturnType<typeof useWallet>["status"];
  connecting: boolean;
  onConnect: () => Promise<void>;
  children: React.ReactNode;
}) {
  const strings = useStrings();
  const a = strings.account;
  if (status === "not-installed" || status === "disconnected" || status === "connecting") {
    return (
      <Panel>
        <p className="text-sm text-muted">{a.connectPrompt}</p>
        <button
          type="button"
          disabled={connecting}
          onClick={() => void onConnect()}
          className="btn btn-lime mt-4 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {connecting ? strings.wallet.connecting : strings.wallet.connect}
        </button>
      </Panel>
    );
  }
  if (status === "wrong-network") {
    return (
      <Panel>
        <p className="text-sm text-cat-disaster">{a.wrongNetwork}</p>
      </Panel>
    );
  }
  return <>{children}</>;
}

/** One campaign's contributions collapsed into a group: the campaign (if still on-chain) + my gifts. */
interface Group {
  projectId: number;
  campaign: ProjectState | undefined;
  gifts: Contribution[];
  total: bigint;
}

function AccountBody({ owner }: { owner: string }) {
  const strings = useStrings();
  const a = strings.account;
  const contributions = useContributions(owner);
  const campaigns = useCampaigns();
  const tier = useTier(owner);

  const byId = useMemo(() => {
    const m = new Map<number, ProjectState>();
    for (const c of campaigns.data ?? []) m.set(c.id, c);
    return m;
  }, [campaigns.data]);

  // Group newest-first contributions by campaign, preserving first-seen (most-recent) order.
  const groups = useMemo<Group[]>(() => {
    const order: number[] = [];
    const acc = new Map<number, Group>();
    for (const gift of contributions.data ?? []) {
      let g = acc.get(gift.projectId);
      if (!g) {
        g = { projectId: gift.projectId, campaign: byId.get(gift.projectId), gifts: [], total: 0n };
        acc.set(gift.projectId, g);
        order.push(gift.projectId);
      }
      g.gifts.push(gift);
      g.total += gift.amount;
    }
    return order.map((id) => acc.get(id)!);
  }, [contributions.data, byId]);

  const impact = useMemo(
    () => (contributions.data ?? []).reduce((sum, c) => sum + c.amount, 0n),
    [contributions.data],
  );

  // Loading (contributions is the gating read; campaign titles fill in when ready).
  if (contributions.data === undefined) {
    if (contributions.isError) {
      return (
        <Panel>
          <p className="text-sm text-cat-disaster">{strings.errorGeneric}</p>
        </Panel>
      );
    }
    return (
      <div className="space-y-4">
        <div className="skeleton h-16 rounded-xl" />
        <div className="skeleton h-40 rounded-2xl" />
        <div className="skeleton h-40 rounded-2xl" />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="space-y-5">
        <SummaryBand
          impact={impact}
          campaigns={0}
          gifts={0}
          tier={tier.data}
        />
        <div className="rounded-2xl border border-dashed border-line-strong bg-paper px-6 py-12 text-center">
          <p className="text-base font-semibold text-ink">{a.empty}</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{a.emptyHint}</p>
          <Link
            href="/"
            className="mt-5 inline-block rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-ink"
          >
            {a.exploreCta}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SummaryBand
        impact={impact}
        campaigns={groups.length}
        gifts={contributions.data.length}
        tier={tier.data}
      />
      <div className="space-y-4">
        {groups.map((g) => (
          <CampaignGroup key={g.projectId} group={g} />
        ))}
      </div>
      <p className="text-xs leading-relaxed text-faint">{a.retentionNote}</p>
    </div>
  );
}

/* ── Header ledger band: quiet total + tier, never a hero-metric card ────────────────────── */

function SummaryBand({
  impact,
  campaigns,
  gifts,
  tier,
}: {
  impact: bigint;
  campaigns: number;
  gifts: number;
  tier: Tier | undefined;
}) {
  const strings = useStrings();
  const a = strings.account;
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-y border-line py-5">
      <div>
        {tier !== undefined ? (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              tier !== Tier.None ? "bg-match-soft text-match-ink" : "bg-line/50 text-muted"
            }`}
          >
            <span className="uppercase tracking-wide text-[0.65rem] opacity-70">{a.tierLabel}</span>
            {a.tier[Tier[tier]] ?? Tier[tier]}
          </span>
        ) : (
          <span className="skeleton inline-block h-5 w-24 rounded-full" />
        )}
        {campaigns > 0 ? (
          <p className="tabular mt-2 text-xs text-muted">
            {a.campaignCount(campaigns)}
            <span className="mx-1.5 text-faint">·</span>
            {a.giftCount(gifts)}
          </p>
        ) : null}
      </div>
      <div className="text-right">
        <p className="text-xs uppercase tracking-widest text-faint">{a.impactLabel}</p>
        <p className="tabular mt-1 text-2xl font-bold text-ink sm:text-[1.75rem]">
          {formatIDR(impact)}
        </p>
      </div>
    </div>
  );
}

/* ── One campaign's giving: header row + hairline-separated gift statement ────────────────── */

function CampaignGroup({ group }: { group: Group }) {
  const strings = useStrings();
  const a = strings.account;
  const { campaign, projectId, gifts, total } = group;
  const tag = campaign?.category.tag ?? "";
  const { label, chip } = categoryMeta(tag, strings.categories);

  return (
    <article className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {campaign ? (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${chip}`}>{label}</span>
          ) : null}
          <h2 className="mt-2 truncate text-lg font-semibold text-ink">
            {campaign ? (
              <Link href={`/campaign/${projectId}`} className="transition-colors hover:text-accent-ink">
                {campaign.title}
              </Link>
            ) : (
              a.unknownCampaign(projectId)
            )}
          </h2>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-faint">{a.myTotalLabel}</p>
          <p className="tabular mt-0.5 text-lg font-bold text-ink">{formatIDR(total)}</p>
        </div>
      </div>

      <ul className="mt-5 divide-y divide-line border-t border-line">
        {gifts.map((gift) => (
          <li
            key={gift.txHash}
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 text-sm"
          >
            <span className="tabular font-medium text-ink">{formatIDR(gift.amount)}</span>
            <span className="flex items-center gap-3 text-xs text-muted">
              <time dateTime={gift.at}>{formatDate(gift.at)}</time>
              <span className="text-faint">
                <ExplorerLink hash={gift.txHash} label={a.viewTx} />
              </span>
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}

/** RFC3339 ledger close time → a compact Indonesian date (`8 Jul 2026`). */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="state-panel p-6">{children}</div>;
}
