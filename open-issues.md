# Open issues

Things deliberately left open, with enough context to pick up cold. Each one says what it is, why it wasn't fixed at the time, and what "done" would look like. Closed items get deleted, not archived — `scope.md` is the permanent record, this is the queue.

All three came out of feature #10 (abuse protection for public reads). See that section of `scope.md` for the full reasoning.

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
