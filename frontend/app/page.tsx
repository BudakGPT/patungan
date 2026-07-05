"use client";

import Link from "next/link";
import { strings } from "@/strings";
import { QueryState } from "@/components/QueryState";
import { useProjects, useRound } from "@/lib/hooks";
import { formatIDR } from "@/lib/format";

export default function LandingPage() {
  const round = useRound();
  const projects = useProjects();

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold">{strings.landing.title}</h1>
      <p className="mt-2 text-neutral-600">{strings.landing.subtitle}</p>

      <section className="mt-6">
        <QueryState query={round}>
          {(config) => (
            <p className="text-sm text-neutral-700">
              Pool {formatIDR(config.pool)} · {config.status.tag}
            </p>
          )}
        </QueryState>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <QueryState query={projects} isEmpty={(data) => data.length === 0}>
          {(data) =>
            data.map((project) => (
              <Link
                key={project.id}
                href={`/project/${project.id}`}
                className="rounded-lg border border-neutral-200 p-4 hover:border-neutral-400"
              >
                <p className="text-2xl">{project.emoji}</p>
                <p className="mt-1 font-medium">{project.title}</p>
                <p className="mt-1 text-sm text-neutral-600">
                  {formatIDR(project.direct)} · {project.donor_count} pendukung
                </p>
              </Link>
            ))
          }
        </QueryState>
      </section>
    </main>
  );
}
