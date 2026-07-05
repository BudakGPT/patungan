"use client";

import Link from "next/link";
import type { ProjectState } from "@/contract/dist/index.js";
import { formatIDR } from "@/lib/format";
import { strings } from "@/strings";

/** A2 · one project tile: emoji, title, direct, donor_count, projected-match bar (§7 Epic A2). */
export function ProjectCard({
  project,
  projectedMatch,
  pool,
}: {
  project: ProjectState;
  /** undefined = no projection yet (pre-contribution "—"), per preview_matches' empty-vec case. */
  projectedMatch: bigint | undefined;
  pool: bigint;
}) {
  const pct =
    projectedMatch !== undefined && pool > BigInt(0)
      ? Math.min(Number((projectedMatch * BigInt(10000)) / pool) / 100, 100)
      : 0;

  return (
    <Link
      href={`/project/${project.id}`}
      className="rounded-lg border border-neutral-200 p-4 hover:border-neutral-400"
    >
      <p className="text-2xl">{project.emoji}</p>
      <p className="mt-1 font-medium">{project.title}</p>
      <p className="mt-1 text-sm text-neutral-600">
        {formatIDR(project.direct)} · {project.donor_count} {strings.landing.donorCountSuffix}
      </p>

      <p className="mt-3 text-xs uppercase text-neutral-500">
        {strings.landing.projectedMatchLabel}
      </p>
      <p className="text-sm font-medium">
        {projectedMatch === undefined ? strings.landing.noMatchYet : formatIDR(projectedMatch)}
      </p>
      <div className="mt-1 h-2 w-full rounded-full bg-neutral-100">
        <div className="h-2 rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
      </div>
    </Link>
  );
}
