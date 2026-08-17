/**
 * Application-owned allowlist of OpenRouter model IDs this app is willing to
 * call. Every model listed here is confirmed $0 prompt/completion pricing on
 * OpenRouter and text-in/text-out (no audio-output-only models). Pulled from
 * `GET https://openrouter.ai/api/v1/models` and filtered by hand, since the
 * live catalog also contains paid models and the request body's `model`
 * field is otherwise fully caller-controlled.
 *
 * Feature #5 (model picker) will fetch this same catalog live for the UI;
 * when it lands, apply the identical $0-pricing + text-output filter there
 * so the picker and this allowlist can't drift apart.
 */
export const FREE_MODEL_IDS = [
  "nvidia/nemotron-3.5-lightning:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "poolside/laguna-s-2.1:free",
  "poolside/laguna-xs-2.1:free",
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "cohere/north-mini-code:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "openrouter/free",
  "openai/gpt-oss-20b:free",
  "liquid/lfm-2.5-2.6b:free",
  "nvidia/nemotron-3.5-content-safety:free",
  "nvidia/nemotron-nano-12b-v2-vl:free",
  "nvidia/nemotron-nano-9b-v2:free",
] as const;

export type FreeModelId = (typeof FREE_MODEL_IDS)[number];

export const isFreeModel = (id: string): id is FreeModelId =>
  (FREE_MODEL_IDS as readonly string[]).includes(id);
