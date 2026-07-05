"use client";

import { strings } from "@/strings";
import { QueryState } from "@/components/QueryState";
import { RoundBanner } from "@/components/RoundBanner";
import { ProjectCard } from "@/components/ProjectCard";
import { useProjects, useRound, usePreviewMatch } from "@/lib/hooks";

export default function LandingPage() {
  const round = useRound();
  const projects = useProjects();
  const previewMatches = usePreviewMatch();

  const matchByProjectId = new Map(
    (previewMatches.data ?? []).map(([id, matched]) => [id, matched]),
  );
  const pool = round.data?.pool ?? BigInt(0);

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
                  previewMatches.data && previewMatches.data.length > 0
                    ? (matchByProjectId.get(project.id) ?? BigInt(0))
                    : undefined
                }
                pool={pool}
              />
            ))
          }
        </QueryState>
      </section>
    </main>
  );
}
