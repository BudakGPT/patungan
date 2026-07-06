"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { strings } from "@/strings";
import { formatIDR } from "@/lib/format";
import { useProject, useRound, usePreviewMatch } from "@/lib/hooks";
import { ContributeModal } from "@/components/ContributeModal";

/** A3 · project story + tally + Contribute action (§7 Epic A3). */
export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const isValidId = Number.isInteger(id) && id >= 0;

  const project = useProject(id, isValidId);
  const round = useRound();
  const isFinalized = round.data?.status.tag === "Finalized";
  // Post-finalize the stored `matched` is authoritative — skip the simulation.
  const previewMatches = usePreviewMatch(!isFinalized);
  const [showModal, setShowModal] = useState(false);

  // Unknown/malformed id → not-found (the contract panics on an unknown id; a genuine
  // transient RPC error surfaces the same way here, with its own retry).
  if (!isValidId || project.isError) {
    return (
      <main className="min-h-screen p-8">
        <p className="text-neutral-600">{strings.project.notFound}</p>
        <div className="mt-3 flex items-center gap-3">
          <Link href="/" className="underline underline-offset-2">
            {strings.project.backToLanding}
          </Link>
          {project.isError ? (
            <button
              type="button"
              onClick={() => project.refetch()}
              className="text-neutral-500 underline underline-offset-2"
            >
              {strings.retry}
            </button>
          ) : null}
        </div>
      </main>
    );
  }

  if (project.isPending) {
    return (
      <main className="min-h-screen p-8">
        <p className="text-neutral-500">{strings.loading}</p>
      </main>
    );
  }

  const data = project.data;
  const projectedMatch = isFinalized
    ? data.matched
    : previewMatches.data?.find(([pid]) => pid === id)?.[1];
  // Three-way CTA state: unknown (round still loading) renders the normal label disabled —
  // only a KNOWN closed round may claim "Round ditutup".
  const roundStatus = round.data?.status.tag;
  const isOpen = roundStatus === "Open";

  return (
    <main className="min-h-screen p-8">
      <Link href="/" className="text-sm text-neutral-500 underline underline-offset-2">
        {strings.project.backToLanding}
      </Link>

      <p className="mt-4 text-4xl">{data.emoji}</p>
      <h1 className="mt-1 text-2xl font-bold">{data.title}</h1>
      <p className="mt-3 max-w-prose text-neutral-600">
        {strings.project.stories[data.id] ?? ""}
      </p>

      <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
        <div>
          {/* This is the project's DIRECT raised total — not the matching pool. */}
          <p className="text-xs uppercase text-neutral-500">{strings.project.raisedLabel}</p>
          <p className="text-xl font-semibold">{formatIDR(data.direct)}</p>
          <p className="text-sm text-neutral-600">
            {data.donor_count} {strings.landing.donorCountSuffix}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-neutral-500">
            {isFinalized ? strings.landing.finalMatchLabel : strings.landing.projectedMatchLabel}
          </p>
          <p className="text-xl font-semibold">
            {projectedMatch === undefined ? strings.landing.noMatchYet : formatIDR(projectedMatch)}
          </p>
        </div>
      </div>

      <button
        type="button"
        disabled={!isOpen}
        onClick={() => setShowModal(true)}
        className="mt-6 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-neutral-300"
      >
        {roundStatus === "Finalized"
          ? strings.project.roundClosedCta
          : strings.project.contributeCta}
      </button>

      {showModal ? (
        <ContributeModal
          projectId={data.id}
          projectTitle={data.title}
          onClose={() => setShowModal(false)}
        />
      ) : null}
    </main>
  );
}
