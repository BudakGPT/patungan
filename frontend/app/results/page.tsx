"use client";

import type { ProjectState } from "@/contract/src";
import { strings } from "@/strings";
import { QueryState } from "@/components/QueryState";
import { MatchCurve } from "@/components/MatchCurve";
import { formatIDR } from "@/lib/format";
import { useProjects, useRound, usePreviewMatch } from "@/lib/hooks";

export default function ResultsPage() {
  const round = useRound();
  const projects = useProjects();
  const isFinalized = round.data?.status.tag === "Finalized";
  // Post-finalize the stored `matched` is authoritative — stop re-simulating the split.
  const previewMatches = usePreviewMatch(!isFinalized);
  const matchByProjectId = new Map(
    (previewMatches.data ?? []).map(([id, matched]) => [id, matched]),
  );

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold">{strings.results.title}</h1>

      <section className="mt-8">
        <QueryState query={projects} isEmpty={(data) => data.length === 0}>
          {(data) => {
            // D1: post-finalize the contract's stored `matched` is authoritative; pre-finalize
            // fall back to the live `preview_matches` projection so the page is never broken.
            const rows: ProjectState[] = isFinalized
              ? data
              : data.map((p) => ({ ...p, matched: matchByProjectId.get(p.id) ?? 0n }));
            const sorted = [...rows].sort((a, b) =>
              Number(b.direct + b.matched - (a.direct + a.matched)),
            );

            return (
              <>
                {!isFinalized ? (
                  <p className="mb-4 text-sm text-amber-700">{strings.results.notFinalized}</p>
                ) : null}

                <div className="mb-8 overflow-x-auto">
                  <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 text-neutral-500">
                        <th className="py-2 pr-4">{strings.results.projectLabel}</th>
                        <th className="py-2 pr-4">{strings.results.directLabel}</th>
                        <th className="py-2 pr-4">{strings.results.matchedLabel}</th>
                        <th className="py-2 pr-4">{strings.results.totalLabel}</th>
                        <th className="py-2">{strings.results.donorSuffix}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((project) => (
                        <tr key={project.id} className="border-b border-neutral-100">
                          <td className="py-2 pr-4 font-medium">
                            {project.emoji} {project.title}
                          </td>
                          <td className="py-2 pr-4">{formatIDR(project.direct)}</td>
                          <td className="py-2 pr-4">{formatIDR(project.matched)}</td>
                          <td className="py-2 pr-4 font-semibold">
                            {formatIDR(project.direct + project.matched)}
                          </td>
                          <td className="py-2">{project.donor_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <MatchCurve projects={sorted} />

                <p className="mt-10 text-lg font-medium">{strings.results.verdict}</p>
                <p className="mt-1 text-sm text-neutral-600">{strings.results.hook}</p>
              </>
            );
          }}
        </QueryState>
      </section>
    </main>
  );
}
