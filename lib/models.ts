/**
 * Application-owned allowlist of OpenRouter model IDs this app is willing to
 * call. Every model listed here is confirmed $0 prompt/completion pricing on
 * OpenRouter and text-in/text-out (no audio-output-only models). Pulled from
 * `GET https://openrouter.ai/api/v1/models` and filtered by hand, since the
 * live catalog also contains paid models and the request body's `model`
 * field is otherwise fully caller-controlled.
 *
 * Feature #5's picker fetches the same catalog live and narrows it to exactly
 * this list, so the two can't drift.
 *
 * Refreshed against the live catalog on 2026-09-03, in context-window order.
 * "Free" is checked across *every* priced dimension rather than just prompt and
 * completion — some models are free to prompt but charge per request or per
 * image — and output must be text alone, which is what excludes the two models
 * that also emit audio.
 *
 * Every id here was probed with a real one-token completion before being
 * listed, because the catalog does not say which free models can actually be
 * called. Two that pass every catalog filter — `thinkingmachines/inkling` and
 * `inkling-small` — answer 403 "only available on agentic harnesses" and are
 * deliberately absent: that gate is structural, not transient, so they would
 * be permanently broken entries in the picker. Models that answered 429 or 502
 * *are* included; those are the shared free pool being busy, the same
 * condition Poolside and Gemma already hit, and they work again later.
 *
 * Four further ids were dropped in that refresh because OpenRouter no longer
 * offers them free: `nvidia/nemotron-3-nano-30b-a3b`, `openai/gpt-oss-20b`,
 * `nvidia/nemotron-nano-12b-v2-vl` and `nvidia/nemotron-nano-9b-v2`. Two of
 * them hold real votes, and nothing is lost by their removal: the leaderboard
 * falls back to the raw id for a model it can't name, `selectInitialModels`
 * already drops ids that left the free tier when restoring a thread's picks,
 * and `/api/chat` refuses them with a plain sentence — which is now true
 * rather than a lie.
 */
export const FREE_MODEL_IDS = [
  "minimax/minimax-m3:free",
  "nvidia/nemotron-3.5-lightning:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "dots-studio/dots-3-note-preview:free",
  "inclusionai/ling-3.0-flash-fin:free",
  "poolside/laguna-s-2.1:free",
  "poolside/laguna-xs-2.1:free",
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "cohere/north-mini-code:free",
  "z-ai/glm-5.2:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "openrouter/free",
  "minimax/minimax-m2.7:free",
  "nvidia/nemotron-3.5-content-safety:free",
  "liquid/lfm-2.5-2.6b:free",
] as const;

export type FreeModelId = (typeof FREE_MODEL_IDS)[number];

/**
 * How many models one prompt may be sent to at once.
 *
 * Lives here rather than in the picker because three separate places need to
 * agree on it: the picker's cap, how many a brand-new thread starts with, and
 * how many an existing thread restores. `POST /api/turns` enforces the same
 * number server-side via its own `.max(3)`, which is the one that actually
 * matters — this constant shapes the UI, it doesn't guard the endpoint.
 */
export const MAX_SELECTED_MODELS = 3;

export const isFreeModel = (id: string): id is FreeModelId =>
  (FREE_MODEL_IDS as readonly string[]).includes(id);
