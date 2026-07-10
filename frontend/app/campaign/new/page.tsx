"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import freighterApi from "@stellar/freighter-api";
import type { Category } from "@/contract/src";
import { Tier } from "@/contract/src";
import { contractClient } from "@/lib/contract";
import { useWallet } from "@/lib/wallet";
import { useTier } from "@/lib/hooks";
import { mapContractError } from "@/lib/errors";
import { ALL_CATEGORIES, categoryMeta, type CategoryTag } from "@/lib/category";
import { useStrings } from "@/lib/locale";
import { ImageUpload } from "@/components/ImageUpload";
import { ExplorerLink } from "@/components/ExplorerLink";

const MAX_TITLE = 96;
const MAX_STORY = 1024;
const STELLAR_ADDR = /^G[A-Z2-7]{55}$/;
/** Contract measures String::len() in UTF-8 bytes, so validate the byte length, not code points. */
const byteLen = (s: string) => new TextEncoder().encode(s).length;

type TxState =
  | { phase: "idle" }
  | { phase: "awaiting-signature" }
  | { phase: "submitting" }
  | { phase: "success"; id: number; hash: string }
  | { phase: "error"; message: string };

/**
 * Campaign create `/campaign/new` — the self-serve submission entry point. Gated by the same
 * ladder the contribute panel uses (connect → Testnet →
 * tier ≥ Basic, else route to `/verify`); once past the gate a single focused form column collects
 * title / category / story / payout / image, validates client-side against the input limits, pins
 * the image to IPFS, then calls `submit_project`. Success lands on an "awaiting curation" panel
 * linking to the new (Pending) campaign page. Four tx states throughout.
 */
export default function CampaignCreatePage() {
  const { campaign } = useStrings();
  const t = campaign.create;
  const { address, status, connect } = useWallet();
  const tierQ = useTier(address);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
      >
        <span aria-hidden>←</span>
        {t.back}
      </Link>

      <div className="mt-5">
        <h1 className="text-3xl font-bold leading-[1.1] tracking-tight text-ink sm:text-[2.25rem]">
          {t.heading}
        </h1>
        <p className="mt-3 max-w-[60ch] text-base leading-relaxed text-muted">{t.subtitle}</p>
      </div>

      <div className="mt-8">
        <Gate status={status} tier={tierQ.data} connecting={status === "connecting"} onConnect={connect}>
          {address ? <CreateForm owner={address} /> : null}
        </Gate>
      </div>
    </main>
  );
}

/** The gate ladder: each rung renders its own affordance; the form only mounts past the top rung. */
function Gate({
  status,
  tier,
  connecting,
  onConnect,
  children,
}: {
  status: ReturnType<typeof useWallet>["status"];
  tier: Tier | undefined;
  connecting: boolean;
  onConnect: () => Promise<void>;
  children: React.ReactNode;
}) {
  const strings = useStrings();
  const t = strings.campaign.create;
  if (status === "not-installed" || status === "disconnected" || status === "connecting") {
    return (
      <Panel>
        <p className="text-sm text-muted">{t.connectPrompt}</p>
        <button
          type="button"
          disabled={connecting}
          onClick={() => void onConnect()}
          className="mt-4 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-ink disabled:opacity-60"
        >
          {connecting ? strings.wallet.connecting : strings.wallet.connect}
        </button>
      </Panel>
    );
  }

  if (status === "wrong-network") {
    return (
      <Panel>
        <p className="text-sm text-cat-disaster">{t.wrongNetwork}</p>
      </Panel>
    );
  }

  // Connected: enforce the tier gate before the form (undefined = tier still loading).
  if (tier === Tier.None) {
    return (
      <Panel>
        <p className="font-medium text-ink">{t.tierGateTitle}</p>
        <p className="mt-1 text-sm text-muted">{t.tierGateBody}</p>
        <Link
          href="/verify"
          className="mt-4 inline-block rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-ink"
        >
          {t.tierGateCta}
        </Link>
      </Panel>
    );
  }

  if (tier === undefined) {
    return (
      <Panel>
        <p className="text-sm text-muted">{strings.loading}</p>
      </Panel>
    );
  }

  return <>{children}</>;
}

function CreateForm({ owner }: { owner: string }) {
  const strings = useStrings();
  const t = strings.campaign.create;
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<CategoryTag | null>(null);
  const [story, setStory] = useState("");
  const [payout, setPayout] = useState(owner);
  const [imageCid, setImageCid] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [tx, setTx] = useState<TxState>({ phase: "idle" });

  // Default the payout to the connected wallet once (and whenever the wallet changes while empty).
  useEffect(() => {
    setPayout((prev) => (prev === "" ? owner : prev));
  }, [owner]);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (byteLen(title.trim()) === 0) e.title = t.invalid.titleRequired;
    else if (byteLen(title.trim()) > MAX_TITLE) e.title = t.invalid.titleTooLong;
    if (byteLen(story.trim()) === 0) e.story = t.invalid.storyRequired;
    else if (byteLen(story.trim()) > MAX_STORY) e.story = t.invalid.storyTooLong;
    if (!STELLAR_ADDR.test(payout.trim())) e.payout = t.invalid.payoutInvalid;
    if (!imageCid) e.image = t.invalid.imageRequired;
    return e;
  }, [title, story, payout, imageCid]);

  const categoryValid = category !== null;
  const valid = Object.keys(errors).length === 0 && categoryValid;
  const pending = tx.phase === "awaiting-signature" || tx.phase === "submitting";
  const show = (key: string) => touched && errors[key];

  async function submit() {
    setTouched(true);
    if (!valid || pending || !category || !imageCid) return;
    setTx({ phase: "awaiting-signature" });
    try {
      const assembled = await contractClient.submit_project(
        {
          owner,
          title: title.trim(),
          category: { tag: category, values: undefined } as Category,
          story: story.trim(),
          image_cid: imageCid,
          payout: payout.trim(),
        },
        { publicKey: owner },
      );
      const sent = await assembled.signAndSend({
        signTransaction: freighterApi.signTransaction,
        watcher: {
          onSubmitted: () => setTx({ phase: "submitting" }),
          onProgress: () => {},
        },
      });

      if (sent.result.isErr()) {
        setTx({ phase: "error", message: mapContractError(sent.result.unwrapErr(), strings.errors) });
        return;
      }

      const newId = Number(sent.result.unwrap());
      // The new campaign is Pending; let discovery/dashboard repoll it in.
      void queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setTx({ phase: "success", id: newId, hash: sent.sendTransactionResponse?.hash ?? "" });
    } catch (err) {
      setTx({ phase: "error", message: mapContractError(err, strings.errors) });
    }
  }

  if (tx.phase === "success") {
    return (
      <Panel tone="match">
        <p className="text-lg font-semibold text-match-ink">{t.successTitle}</p>
        <p className="mt-2 max-w-[56ch] text-sm leading-relaxed text-muted">{t.successBody}</p>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <Link
            href={`/campaign/${tx.id}`}
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-ink"
          >
            {t.viewCampaign}
          </Link>
          <button
            type="button"
            onClick={() => {
              setTitle("");
              setCategory(null);
              setStory("");
              setPayout(owner);
              setImageCid(null);
              setTouched(false);
              setTx({ phase: "idle" });
            }}
            className="text-sm font-medium text-muted underline underline-offset-2 hover:text-ink"
          >
            {t.createAnother}
          </button>
          {tx.hash ? (
            <span className="text-sm text-match-ink">
              <ExplorerLink hash={tx.hash} label={strings.explorer.viewTx} />
            </span>
          ) : null}
        </div>
      </Panel>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      noValidate
      className="space-y-7"
    >
      {/* Title */}
      <Field label={t.titleLabel} htmlFor="title" error={show("title")}>
        <div className="relative">
          <input
            id="title"
            type="text"
            value={title}
            disabled={pending}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t.titlePlaceholder}
            className={inputClass(!!show("title"))}
          />
        </div>
        <Counter n={byteLen(title.trim())} max={MAX_TITLE} />
      </Field>

      {/* Category — selectable tinted chips, one source of truth with discovery */}
      <div>
        <Label>{t.categoryLabel}</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {ALL_CATEGORIES.map((tag) => {
            const active = category === tag;
            const { label, chip } = categoryMeta(tag, strings.categories);
            return (
              <button
                key={tag}
                type="button"
                disabled={pending}
                onClick={() => setCategory(tag)}
                aria-pressed={active}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
                  active
                    ? `border-transparent ${chip}`
                    : "border-line bg-surface text-muted hover:border-accent/40"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Story */}
      <Field label={t.storyLabel} htmlFor="story" error={show("story")}>
        <textarea
          id="story"
          value={story}
          disabled={pending}
          onChange={(e) => setStory(e.target.value)}
          placeholder={t.storyPlaceholder}
          rows={6}
          className={`${inputClass(!!show("story"))} resize-y leading-relaxed`}
        />
        <Counter n={byteLen(story.trim())} max={MAX_STORY} />
      </Field>

      {/* Image */}
      <div>
        <Label>{t.imageLabel}</Label>
        <div className="mt-2">
          <ImageUpload cid={imageCid} onChange={setImageCid} disabled={pending} />
        </div>
        {show("image") ? <p className="mt-2 text-sm text-cat-disaster">{errors.image}</p> : null}
      </div>

      {/* Payout */}
      <Field label={t.payoutLabel} htmlFor="payout" error={show("payout")}>
        <input
          id="payout"
          type="text"
          value={payout}
          disabled={pending}
          spellCheck={false}
          onChange={(e) => setPayout(e.target.value)}
          className={`${inputClass(!!show("payout"))} tabular`}
        />
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <p className="text-xs text-faint">{t.payoutHelper}</p>
          {payout.trim() !== owner ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => setPayout(owner)}
              className="shrink-0 text-xs font-medium text-accent-ink underline underline-offset-2 hover:text-accent disabled:opacity-60"
            >
              {t.payoutReset}
            </button>
          ) : null}
        </div>
      </Field>

      {tx.phase === "error" ? (
        <p className="text-sm text-cat-disaster">{tx.message}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending || (touched && !valid)}
        className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        {tx.phase === "awaiting-signature"
          ? t.awaiting
          : tx.phase === "submitting"
            ? t.submitting
            : t.submit}
      </button>
    </form>
  );
}

function inputClass(hasError: boolean): string {
  return `w-full rounded-xl border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-faint transition-colors focus:outline-none ${
    hasError
      ? "border-cat-disaster focus:border-cat-disaster"
      : "border-line focus:border-accent"
  }`;
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string | false;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      <div className="mt-2">{children}</div>
      {error ? <p className="mt-1.5 text-sm text-cat-disaster">{error}</p> : null}
    </div>
  );
}

function Label({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">
      {children}
    </label>
  );
}

function Counter({ n, max }: { n: number; max: number }) {
  const over = n > max;
  return (
    <p className={`mt-1.5 text-right text-xs tabular ${over ? "text-cat-disaster" : "text-faint"}`}>
      {n}/{max}
    </p>
  );
}

function Panel({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "match";
}) {
  const border = tone === "match" ? "border-match/30 bg-match-soft" : "border-line bg-surface";
  return <div className={`rounded-2xl border ${border} p-6 shadow-card`}>{children}</div>;
}
