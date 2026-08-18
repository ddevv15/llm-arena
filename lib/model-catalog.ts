import { env } from "@/lib/env";
import { isFreeModel, type FreeModelId } from "@/lib/models";

export type CatalogModel = {
  id: FreeModelId;
  name: string;
  contextLength: number;
  promptPrice: number;
  completionPrice: number;
};

type OpenRouterModel = {
  id: string;
  name: string;
  context_length: number;
  pricing: { prompt: string; completion: string };
};

type OpenRouterModelsResponse = {
  data: OpenRouterModel[];
};

/**
 * The live OpenRouter catalog, narrowed to FREE_MODEL_IDS (the same
 * allowlist app/api/chat/route.ts enforces) so the picker can never offer a
 * model the app would then refuse to call. Cached for an hour, this list
 * doesn't change minute to minute.
 *
 * `/` and `/models` both render straight from this, so a transient OpenRouter
 * failure here must degrade to an empty catalog, not take the page down with
 * it — callers render their own honest "unavailable" state for `[]`.
 */
export async function getModelCatalog(): Promise<CatalogModel[]> {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error(
        `OpenRouter model catalog request failed: ${response.status}`,
      );
    }

    const { data }: OpenRouterModelsResponse = await response.json();

    return data
      .filter((model): model is OpenRouterModel & { id: FreeModelId } =>
        isFreeModel(model.id),
      )
      .map((model) => ({
        id: model.id,
        name: model.name,
        contextLength: model.context_length,
        promptPrice: Number(model.pricing.prompt),
        completionPrice: Number(model.pricing.completion),
      }))
      .sort((a, b) => b.contextLength - a.contextLength);
  } catch (error) {
    console.error("Failed to load the OpenRouter model catalog", error);
    return [];
  }
}
