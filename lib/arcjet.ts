import { cache } from "react";
import arcjet, {
  request as arcjetRequest,
  createRemoteClient,
  detectBot,
  detectPromptInjection,
  shield,
  slidingWindow,
  tokenBucket,
} from "@arcjet/next";
import { env } from "@/lib/env";

/**
 * Two clients, not one, because the app has two genuinely different front
 * doors and a client's `characteristics` are fixed when it's constructed.
 *
 * `aj` guards the authenticated write path, keyed on `userId` so one person's
 * budget is shared across the three parallel per-model calls a single prompt
 * fans out into. `ajPublic` guards the link-public read path, where there is
 * no `userId` to key on — a signed-out reader is exactly who it exists for —
 * so it carries no global characteristic and each rule falls back to Arcjet's
 * `["ip.src"]` default.
 *
 * `withRule()` can't bridge the two: it layers a rule onto an existing client
 * but can't remove that client's `userId` characteristic, and asking an
 * anonymous reader for a `userId` has no answer.
 */

/**
 * The write path gets a longer deadline than the SDK's default (500ms in
 * production, 1000ms in development), and that number is load-bearing rather
 * than a guess.
 *
 * This client's ruleset includes `detectPromptInjection`, whose decide call
 * measured around 1600ms against a real signed-in session — comfortably past
 * the default. On its own that was harmless, because an expired deadline
 * produces an `ERROR` conclusion and the route used to let those through. Once
 * the route started failing closed on `ERROR`, the same latency turned into a
 * roughly one-in-two rejection rate on sending a prompt, measured, not
 * theorised: six control requests alternated 200/503, every 503 landing at
 * ~1030ms against the 1000ms dev deadline.
 *
 * So the deadline has to sit above how long the call actually takes, or "fail
 * closed" quietly means "fail". Six seconds was arrived at by measurement, not
 * taste: at the default it was roughly one in two, and at three seconds still
 * four in eight. At six, eighteen consecutive prompts went through, against a
 * warm call of 1.5-1.9s and a cold-start spike of 3.2s — so it clears the real
 * worst case with room, and is only ever the ceiling on how long someone waits
 * before a 503 on the failure path.
 *
 * `ajPublic` deliberately keeps the default. Its rules are lighter, it stayed
 * healthy throughout the same testing, and it fails *open* — so a timeout there
 * costs one unscreened page view rather than a rejected prompt, and a fast page
 * is worth more than a slow guarantee.
 */
const WRITE_DECISION_TIMEOUT_MS = 6_000;

export const aj = arcjet({
  key: env.ARCJET_KEY,
  characteristics: ["userId"],
  client: createRemoteClient({ timeout: WRITE_DECISION_TIMEOUT_MS }),
  rules: [
    shield({ mode: "LIVE" }),
    detectBot({ mode: "LIVE", allow: [] }),
    detectPromptInjection({ mode: "LIVE" }),
    tokenBucket({
      mode: "LIVE",
      capacity: 20,
      refillRate: 5,
      interval: 10,
    }),
  ],
});

/**
 * Bots that are allowed to read a shared thread. An `allow` list denies
 * everything absent from it, so this list is the whole policy.
 *
 * The first three are the feature working as intended: a thread link pasted
 * into Slack, Discord, or X is fetched by that platform's unfurler, and
 * denying them would break sharing in the act of protecting it. Search engines
 * are a deliberate product call — threads are link-public by design, so
 * letting them be found is consistent rather than a leak. The last two are the
 * app's own infrastructure: Vercel fetches pages for deploy previews and uptime
 * checks need to reach a real page, and neither is abuse.
 *
 * The AI readers are named one by one instead of taken as `CATEGORY:AI`, and
 * that is the point rather than fussiness. The category is 47 bots covering
 * three unrelated jobs: assistants fetching a page to answer someone's question
 * (wanted here — a thread being cited in ChatGPT or Perplexity is the same win
 * as being findable in Google), crawlers building training corpora, and a
 * grab-bag that includes `PYTHON_SCRAPY` and `DIFFBOT_CRAWLER`. Allowing the
 * category to get the first would have handed a standing exemption to a generic
 * scraping framework — the exact tool the rate limit and this rule exist to
 * stop — so the category is never used and the seven wanted bots are listed.
 *
 * Training crawlers (GPTBot, ClaudeBot, CCBot, Cohere, AI2) stay denied: a
 * corpus of people's prompts is not something to hand over by default, and
 * unlike a search fetch, nothing a reader can see breaks when it's refused.
 */
const READER_BOTS = [
  "CATEGORY:PREVIEW",
  "CATEGORY:SLACK",
  "CATEGORY:SOCIAL",
  "CATEGORY:SEARCH_ENGINE",
  "CATEGORY:VERCEL",
  "CATEGORY:MONITOR",
  "AI_SEARCH_BOT",
  "OPENAI_CRAWLER_SEARCH",
  "OPENAI_CRAWLER_USER",
  "PERPLEXITY_CRAWLER",
  "PERPLEXITY_USER",
  "YOU_CRAWLER",
  "IASK_CRAWLER",
] as const;

/**
 * A sliding window rather than the write path's token bucket, because the two
 * are absorbing different shapes of traffic. A prompt has variable cost and
 * legitimately arrives in bursts of three, which is what a bucket's capacity is
 * for; a page read is uniform and a burst of them is the abuse, so bucket
 * capacity would be handing a scraper exactly the head start it wants. Sliding
 * over fixed avoids the boundary case where a window's reset lets through two
 * full limits back to back.
 *
 * 120 a minute is deliberately generous — this is here to stop automated bulk
 * reads, not to police humans. A reader opening a shared link spends one, and
 * even an owner clicking down a 50-thread sidebar (each click a real render,
 * plus whatever Next prefetches) stays comfortably under. A scraper pulling the
 * corpus wants orders of magnitude more than this. It's also per-IP, so it has
 * to leave room for a whole office or campus behind one address.
 */
export const ajPublic = arcjet({
  key: env.ARCJET_KEY,
  rules: [
    shield({ mode: "LIVE" }),
    detectBot({ mode: "LIVE", allow: [...READER_BOTS] }),
    slidingWindow({ mode: "LIVE", interval: 60, max: 120 }),
  ],
});

/**
 * One decision for one public read, no matter how many places ask for it.
 *
 * A page and its `generateMetadata` both run for a single request, and both
 * need to know whether this read is allowed — `generateMetadata` because it
 * would otherwise go on reading the thread out of Postgres for a request the
 * page is about to turn away, which is the exact query the rate limit exists
 * to prevent. Without `cache()` the honest fix (ask in both places) would
 * spend two of the reader's 120 per page view and bill two decisions.
 *
 * `request()` reads headers and cookies, so this only works inside a real
 * request — a server component, server action, or route handler.
 */
export const protectPublicRead = cache(async function protectPublicRead() {
  return ajPublic.protect(await arcjetRequest());
});
