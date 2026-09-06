# Open issues

Things deliberately left open, with enough context to pick up cold. Each one says what it is, why it wasn't fixed at the time, and what "done" would look like. Closed items get deleted, not archived — `scope.md` is the permanent record, this is the queue.

The first three came out of feature #10 (abuse protection for public reads); the rest came out of feature #11 (performance). See those sections of `scope.md` for the full reasoning.

**#5 is the one to pick up next.** It is the only item here that is both currently reproducible and currently breaking something a person would notice.

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

## 5. `Unable to detect prompt injection` fails roughly one prompt in three

**What.** `aj.protect()` on `/api/turns` comes back errored with `Unable to detect prompt injection - contact Arcjet support`, and the route fails closed on that by design, so the person gets a 503 and their prompt is refused. Feature #11's Phase 1 verification hit it three times in four attempts.

Phase 0 recorded this as a cold-start cost — "exactly one 503 on the first prompt after a start". **That reading is now known to be wrong.** Two of the three failures were on a server that had been up for half an hour and had already served successful requests, about 27 minutes apart. Whatever this is, it is not warm-up.

It is also distinct from the deadline problem `WRITE_DECISION_TIMEOUT_MS` already solved. A blown deadline reports `[deadline_exceeded] the operation timed out`; this reports a named service failure, and it arrives well inside the six seconds. Raising the deadline again would not touch it.

**Why not now.** Phase 1 was scoped to how the wait feels, and it deliberately did not fold in a correctness bug it would have had to guess at. The guessing is the problem: the message says to contact Arcjet support, and nothing local distinguishes "this account or key has a broken prompt-injection entitlement", "the model backing that rule is down", and "something about these particular prompts". Picking a fix before knowing which would mean weakening a security control on a hunch — and feature #10 settled that this rule is the reason the write path is guarded at all.

Phase 1 did make the failure survivable rather than destructive, which is why this is a queued question and not an emergency: the optimistic turn rolls back, the prompt is returned to the textarea intact, and the person sees a plain sentence and can retry. Verified live, on real failures.

**Done looks like.** First the actual cause, which almost certainly means asking Arcjet with the error text and a timestamp, since the message asks for exactly that. Then a decision that is a real fork and should be asked rather than assumed: retry the decide once before failing, fail open on _this specific_ error while keeping the other rules closed, or leave it closed and rely on the retry the person now has. The middle option is the one that trades away real protection, so it needs to be chosen deliberately rather than reached for because it makes the number go away.

## 6. The public read path's Arcjet deadline was never actually tested

**What.** `ajPublic` keeps the SDK's default decide deadline (500ms in production, 1000ms in development). `lib/arcjet.ts` justifies that in a comment: its rules are lighter and "it stayed healthy throughout the same testing" that forced the write path up to six seconds.

That justification does not hold, because during that testing the read path was not reaching a decision at all. `.env.local` had no `ARCJET_ENV`, so Arcjet could not resolve a client IP behind the dev server, the fingerprint failed, and every public read errored out and failed open — silently, since a failed-open read renders exactly like an allowed one. Feature #11 set `ARCJET_ENV` and the real behaviour appeared immediately: the first `/thread/[id]` read took 2.6s and logged `[deadline_exceeded]`, then settled to ~480ms.

**Why not now.** Nothing is broken for a reader. The read path fails open on purpose — feature #10 decided a shared link going dark because a security service blinked is worse than an unscreened page view — so the page still renders. What it costs is that a cold read goes unscreened, which is a weaker guarantee than the code's comment currently claims. Raising the deadline is a one-line change, but picking the number wants production data rather than one local cold start, and that data is issue #1's job.

**Done looks like.** Read-path decide latency from a deployed instance (issue #1 already has to collect it), then either a deadline sized against it the way the write path's six seconds were, or a deliberate decision that failing open on a cold read is fine and the comment gets corrected instead. Either way `lib/arcjet.ts`'s claim that `ajPublic` "stayed healthy" needs rewriting — it was never tested.
