import Link from "next/link";
import { getModelCatalog } from "@/lib/model-catalog";

function formatContextLength(contextLength: number): string {
  if (contextLength >= 1_000_000) {
    return `${(contextLength / 1_000_000).toFixed(1).replace(/\.0$/, "")}M tokens`;
  }
  return `${Math.round(contextLength / 1_000)}K tokens`;
}

export default async function ModelsPage() {
  const catalog = await getModelCatalog();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12">
      <div className="flex flex-col gap-2">
        <Link href="/" className="font-display text-xl font-medium">
          LLM Arena
        </Link>
        <h1 className="font-display text-2xl font-medium">Models</h1>
        <p className="max-w-prose text-muted-foreground">
          Every free-tier model the arena can call, sorted by context window.
          Cost is always $0.0000, that&apos;s real, not a bug.
        </p>
      </div>
      {catalog.length === 0 ? (
        <p className="text-muted-foreground">
          Models are unavailable right now. Try again shortly.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-card text-left text-muted-foreground">
                <th className="px-4 py-2 font-medium">Model</th>
                <th className="px-4 py-2 font-medium">Context</th>
                <th className="px-4 py-2 font-medium">Price</th>
              </tr>
            </thead>
            <tbody>
              {catalog.map((model) => (
                <tr
                  key={model.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-2">{model.name}</td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {formatContextLength(model.contextLength)}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">$0.0000</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
