import { strings } from "@/strings";

export default function OperatorPage() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold">{strings.operator.title}</h1>
      <p className="mt-2 text-neutral-600">{strings.operator.gated}</p>
    </main>
  );
}
