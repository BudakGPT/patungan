"use client";

import { useParams } from "next/navigation";
import { strings } from "@/strings";

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold">Proyek #{params.id}</h1>
      <p className="mt-2 text-neutral-600">{strings.project.backToLanding}</p>
    </main>
  );
}
