"use client";

import { strings } from "@/strings";
import { QueryState } from "@/components/QueryState";
import { RoundBanner } from "@/components/RoundBanner";
import { ProjectCard } from "@/components/ProjectCard";
import { useProjects, useRound, usePreviewMatch } from "@/lib/hooks";

export default function LandingPage() {
  const round = useRound();
  const projects = useProjects();
  const isFinalized = round.data?.status.tag === "Finalized";
  // Post-finalize each project's stored `matched` is authoritative — skip the simulation.
  const previewMatches = usePreviewMatch(!isFinalized);

  const matchByProjectId = new Map(
    (previewMatches.data ?? []).map(([id, matched]) => [id, matched]),
  );
  const pool = round.data?.pool ?? 0n;

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold">{strings.landing.title}</h1>
      <p className="mt-2 text-neutral-600">{strings.landing.subtitle}</p>

      <section className="mt-6">
        <RoundBanner />
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <QueryState query={projects} isEmpty={(data) => data.length === 0}>
          {(data) =>
            data.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                projectedMatch={
                  isFinalized
                    ? project.matched
                    : previewMatches.data && previewMatches.data.length > 0
                      ? (matchByProjectId.get(project.id) ?? 0n)
                      : undefined
                }
                pool={pool}
                finalized={isFinalized}
              />
            ))
          }
        </QueryState>
      </section>
    </main>
  );
}
