"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ProjectState } from "@/contract/src";
import { formatIDR } from "@/lib/format";
import { strings } from "@/strings";

/** D2 · stacked bar per project: direct segment + matched segment animating 0 → final width. */
export function MatchCurve({ projects }: { projects: ProjectState[] }) {
  const prefersReducedMotion = useReducedMotion();
  const maxTotal = Math.max(
    1,
    ...projects.map((p) => Number(p.direct) + Number(p.matched)),
  );

  return (
    <div className="flex flex-col gap-4">
      {projects.map((project) => {
        const direct = Number(project.direct);
        const matched = Number(project.matched);
        const directPct = (direct / maxTotal) * 100;
        const matchedPct = (matched / maxTotal) * 100;

        return (
          <div key={project.id}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="font-medium">
                {project.emoji} {project.title}
              </span>
              <span className="text-neutral-500">
                {project.donor_count} {strings.results.donorSuffix}
              </span>
            </div>
            <div className="flex h-6 w-full overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full bg-neutral-400"
                style={{ width: `${directPct}%` }}
                title={`${strings.results.directLabel}: ${formatIDR(project.direct)}`}
              />
              <motion.div
                className="h-full bg-blue-500"
                initial={{ width: prefersReducedMotion ? `${matchedPct}%` : "0%" }}
                animate={{ width: `${matchedPct}%` }}
                transition={{ duration: prefersReducedMotion ? 0 : 1.2, ease: "easeOut" }}
                title={`${strings.results.matchedLabel}: ${formatIDR(project.matched)}`}
              />
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              {strings.results.directLabel} {formatIDR(project.direct)} ·{" "}
              {strings.results.matchedLabel} {formatIDR(project.matched)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
