import { strings } from "@/strings";

export default function LandingPage() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold">{strings.landing.title}</h1>
      <p className="mt-2 text-neutral-600">{strings.landing.subtitle}</p>
    </main>
  );
}
