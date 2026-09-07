# Open issues

Things deliberately left open, with enough context to pick up cold. Each one says what it is, why it wasn't fixed at the time, and what "done" would look like. Closed items get deleted, not archived — `scope.md` is the permanent record, this is the queue.

The first three came out of feature #10 (abuse protection for public reads); the rest came out of feature #11 (performance). See those sections of `scope.md` for the full reasoning.

Numbers are stable — a closed item is deleted and the rest keep their numbering, so a reference to "#4" in a commit or a comment still means the same thing later. Numbers are never reused for a different problem.

## 1. Measure Arcjet decide latency in production, and watch the 429 / 403 rate

**What.** Two numbers need eyes on them once this is deployed, and neither can be answered locally.

The first is decide latency on `/api/turns`. The write path's correctness now depends on it: `aj` is given an explicit six-second deadline because the default was rejecting roughly half of all prompts on latency alone, and **the production default is 500ms, tighter than development's 1000ms**. The six seconds were sized against locally measured calls of 1.5–1.9s warm and a 3.2s cold spike. If production is genuinely faster, the deadline could come down; if it resembles local, the explicit deadline is the only thing keeping the route usable. Either way it should be measured, not assumed.

The second is how often real people get turned away. A 429 on the public read almost certainly means shared NAT rather than a scraper, and the fix is raising `slidingWindow`'s `max`, not narrowing the rule. A 403 is worth checking too, because a denial is cached against the IP for 60 seconds and the fingerprint is the IP — so one denied bot can take a real reader down with it for a minute, and the two look identical from the outside.

**Why not now.** Both are production observations. Nothing local can produce them honestly.

**Done looks like.** Real decide-latency numbers from a deployed instance, the deadline adjusted or confirmed against them, and a decision on whether 120/minute is the right ceiling. The `console.warn` on the denial path already names the rule that fired, so a `BOT` denial on a residential IP is distinguishable from a `SHIELD` one — that log is the starting point.

## 2. Denial pages return HTTP 200

**What.** When Arcjet turns away a reader on `/thread/[id]`, the page renders the right words but the wrong status. `PageMessage` shows `429` or `403` in the eyebrow; the response says `200`.

**Why not now.** A server component can't set a status code. `notFound()` is the only escape hatch Next gives and it would claim 404, which is a lie about a thread that exists. Moving the guard to middleware would fix the status but runs against the Arcjet guidance and would sit ahead of Clerk. Not worth it for a code that mostly matters to bots which were denied content either way.

**Done looks like.** Either a Next API for setting a status from a server component, or a deliberate decision that the eyebrow code is enough and this stays as is. Worth revisiting if the pages ever need to be correct to a crawler rather than to a person.

## 3. `sensitiveInfo` on the way in to `/api/turns`

**What.** Threads are world-readable now, so a prompt containing an API key, a customer's email, or a card number is published the moment it's sent. Arcjet's `sensitiveInfo` rule detects exactly this, locally in WASM, with nothing leaving the environment.

**Why not now.** Two reasons, both real. It belongs on the write path, not the read path — by the time a thread is being read the data is already stored and shared, so screening there is too late. And whether the arena should refuse a prompt because of what it contains is a product decision, not a security patch: it trades a user's control over their own prompt for protection they didn't ask for, and it will have false positives on prompts that legitimately discuss an email address or a key format.

**Done looks like.** A decision on the product question first — refuse, warn, or redact — and only then the rule. If it ships, it goes in `aj`'s ruleset alongside the existing four and needs `sensitiveInfoValue` passed at `protect()` time.

## 4. A thread transcript has no ceiling

**What.** `getThread` in `lib/threads.ts` selects every turn, and inside each turn every answer's full `content`, with no pagination at any of its three nested levels. That whole transcript is then serialized into the RSC flight payload _and_ the streamed HTML, so a reader downloads it twice, and the client copies it into `useArena`'s state on top of that. A sixty-turn thread across three models is a hundred and eighty rows of full model prose on a single page load.

Feature #11 bounds the two neighbouring reads — the leaderboard aggregates in SQL, and `/api/chat`'s history replay caps at six turns — and deliberately does not bound this one.

**Why not now.** The other two had a correct answer available that changed nothing a person sees. This one doesn't: a thread page truncated to the last N turns is a different product than a thread page, and the whole point of a shared link is that someone can read the conversation. Paginating it, virtualising it, or adding a "load earlier turns" control are all real features with real design decisions behind them, not a query tweak. Feature #11's indexes make the read itself fast; what stays unbounded is the payload, and no index fixes that.

It is also not yet a live problem. Threads today are short enough that this is a ceiling rather than a symptom, and guessing at the fix before anyone has hit it would mean designing for a thread length nobody has produced.

**Done looks like.** First a number: the turn count at which the page actually gets slow, taken from real threads rather than assumed. Then a product decision — windowed with a control to load earlier, virtualised so the DOM stays small while the data doesn't, or capped with the full transcript behind an explicit request. `getThread` is already `cache()`-wrapped per request, so whichever shape wins only has to change the query and the component that renders it.

## 6. The public read path's Arcjet deadline was never actually tested

**What.** `ajPublic` keeps the SDK's default decide deadline (500ms in production, 1000ms in development), on the grounds that its rules are lighter than the write path's.

The comment in `lib/arcjet.ts` used to add that it "stayed healthy throughout the same testing" that forced the write path up to six seconds. That half has since been removed from the code, because it does not hold: during that testing the read path was not reaching a decision at all. `.env.local` had no `ARCJET_ENV`, so Arcjet could not resolve a client IP behind the dev server, the fingerprint failed, and every public read errored out and failed open — silently, since a failed-open read renders exactly like an allowed one. Feature #11 set `ARCJET_ENV` and the real behaviour appeared immediately: the first `/thread/[id]` read took 2.6s and logged `[deadline_exceeded]`, then settled to ~480ms.

**Why not now.** Nothing is broken for a reader. The read path fails open on purpose — feature #10 decided a shared link going dark because a security service blinked is worse than an unscreened page view — so the page still renders. What it costs is that a cold read goes unscreened, which is a weaker guarantee than the code's comment currently claims. Raising the deadline is a one-line change, but picking the number wants production data rather than one local cold start, and that data is issue #1's job.

**Done looks like.** Read-path decide latency from a deployed instance (issue #1 already has to collect it), then either a deadline sized against it the way the write path's six seconds were, or a deliberate decision that failing open on a cold read is fine. The stale claim in the comment is already gone; what remains open is the number.

## 8. The Arcjet plan may have lapsed, and this route fails closed

**What.** The owner reports that Arcjet's free trial is over and suspects some features are disabled at their end. That is a plausible root cause for the `Unable to detect prompt injection` errors chased through issue #5 — the message says to contact support, which is what an entitlement problem would say — though it does not fit cleanly, since the rule succeeded on 42 consecutive measured calls and reports `PROMPT_INJECTION_DETECTION:ALLOW` when it runs. Whatever the mix, it is account-side, not code-side.

**Why this needs an eye rather than a shrug.** `/api/turns` fails closed by design (feature #10), so a rule that becomes _permanently_ unavailable does not degrade the arena — it stops it. Every send would error twice, exhaust the retry, and return a 503. Today the rule works nearly always and the retry covers the rest, so nothing is broken; the exposure is that the app's availability is coupled to a paid entitlement staying live, and nobody chose that consciously.

**Why not now.** It is a billing and account question first, and the code already behaves sanely under it. Guessing at a code change while the account state is unknown is how issue #5 acquired two wrong theories.

**Done looks like.** Confirming what the Arcjet plan actually covers now. Then a deliberate decision on the coupling, which is a real fork and should be asked rather than assumed: keep failing closed and accept that a lapsed plan is an outage; fail open specifically when the rule is _unavailable_ while still failing closed on a genuine timeout; or drop `detectPromptInjection` from the write path and screen prompts another way. The middle option is the one that quietly weakens a control, so it needs choosing rather than drifting into.
