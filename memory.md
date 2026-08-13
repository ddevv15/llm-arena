# Memory — Verifying feature #1, sign-in route, feature #2 decided (not yet built)

Last updated: 2026-08-13

## What was built

**Per-call metrics on `/api/chat` (groundwork for scope.md feature #6, not the full feature):**
- `lib/model-stream.ts` — `toModelSseResponse(result, requestStart)` now tracks `firstTokenAt` on the first `text-delta`, reads `outputTokens` off the `finish` part's `totalUsage`, and sends `{ outputTokens, ttft, tokensPerSecond }` on the `done` SSE event (was previously empty `{}`)
- `app/api/chat/route.ts` — captures `requestStart = performance.now()` right before `streamText()` (after auth/parsing/Arcjet), so the metric times the model call only, not our own middleware overhead
- `tokensPerSecond` is wall-clock throughput (`outputTokens / (finish − requestStart)`), deliberately not per-delta timing, since OpenRouter providers differ in whether they stream token-by-token or buffer-and-flush — delta timing would measure that difference instead of real model speed
- No UI reads these fields yet

**Sign-in route (to unblock manual verification of feature #1):**
- `app/sign-in/[[...sign-in]]/page.tsx` — Clerk's `<SignIn />` on a dedicated catch-all route
- `app/page.tsx` — rewritten from the create-next-app boilerplate to a minimal `Show`/`SignInButton`/`UserButton` toggle (Clerk Core 3 API — `@clerk/nextjs@7.7.4` replaced `SignedIn`/`SignedOut` with a single `Show when=` component; confirmed via Clerk's current docs, not assumed from training data)
- `.env.local` and `.env.example` — added `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`, `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/`, `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/` so `SignInButton` redirects to our route instead of Clerk's hosted Account Portal

**`assets/docs/scope.md` updates:**
- Table status for features #1 and #6 corrected from stale "not started" to "in progress" (they'd had real code behind them for a session already)
- Feature #1's verify-by-hand line updated: confirmed live under a real signed-in session — Clerk auth resolved, Arcjet passed, `streamText` was called, and a real provider error (bad model id, testing mistake) was correctly caught and masked into the plain human-facing message. A successful model response hasn't been seen yet; decided not worth forcing a dedicated round for — will happen naturally once feature #5 (model picker) provides a real model id
- Feature #6 gained two "Decided (ahead of the full feature)" notes documenting the Arcjet wiring and the per-call metrics groundwork, so a fresh conversation isn't surprised by code the scope didn't mention

## Decisions made

- Metrics (`ttft`/`tokensPerSecond`/`outputTokens`) belong on the existing `done` SSE event, not a new event type
- `tokensPerSecond` = wall-clock throughput including TTFT, not generation-only speed — see reasoning above; this is a real trade-off (a slow-to-start model reads as slower on tok/s too) accepted because it's the only measure robust to provider buffering differences
- Sign-in UI kept deliberately minimal (no app shell, no styling pass) — it exists only to unblock manual verification, not as feature #7's app shell, which is still fully open
- Coding-standards doc (scope.md feature #2) will live in AGENTS.md's existing `## Rules` section, not a new separate file — avoids duplicating/drifting from what's already there
- Pre-commit tooling will use `simple-git-hooks` + `lint-staged`, not `husky` — avoids the same pnpm build-script postinstall friction hit earlier with Prisma (`simple-git-hooks` needs one manual `pnpm exec simple-git-hooks` to register, no postinstall script)

## Problems solved

- Confirmed `ai@7.0.62`'s `fullStream` `finish` part carries `totalUsage: LanguageModelUsage` (with `outputTokens`) by reading the actual type declarations — not assumed
- Confirmed `@clerk/nextjs@7.7.4` is Clerk "Core 3" (via Clerk's own current docs, through context7), where `SignedIn`/`SignedOut` are replaced by `Show when="signed-in"|"signed-out"` — built the homepage against that, not older stale patterns
- User got carried away pushing manual model-call testing (feature #6 territory) when only feature #1 verification was in scope — corrected mid-session, see feedback below

## Current state

- Feature #1 (connecting to a model): effectively verified — signed-in auth → Arcjet → streamText → SSE error-masking all confirmed working live. Only a successful (non-error) model response is unseen, and that's intentionally deferred, not blocking.
- Feature #6: still "not started" for its actual scope (parallel calls, voting, UI, PostHog funnel) — only two small pieces of groundwork (Arcjet, metrics) exist ahead of it, clearly logged as such in scope.md so they don't get mistaken for the real feature
- Feature #2 (coding standards & tooling): approach fully decided and reported to the user, but building has **not** started — was mid-way through "report the decision, stop and wait" per AGENTS.md's workflow when the session ended. Decision recap: reuse AGENTS.md's `## Rules` as the conventions doc (add one caveat that "functional style over mutating loops" is review-enforced, not lint-enforced, since the SSE reader's `for await` loop is legitimate necessary imperative code); add Prettier (defaults already match existing code style — double quotes, semicolons, 2-space); add `simple-git-hooks` + `lint-staged` running `eslint --fix` + `prettier --write` on staged files only, no full build/typecheck in the hook
- Lint already enforces `no-explicit-any`, `prefer-const`, `no-var` as errors via `eslint-config-next`'s flat config (confirmed via `eslint --print-config`) — AGENTS.md's "strict TS, no any, const" rules are already mechanically covered, this was a useful discovery that narrowed feature #2's actual remaining scope
- Dev server was running on :3000 during this session (`pnpm dev` backgrounded to `/tmp/llm-arena-dev.log`) — likely not running anymore in a fresh session

## Next session starts with

Waiting on the user's go-ahead to actually build feature #2 as decided above:
1. Add the honest caveat line to AGENTS.md's `## Rules` about functional style being review-enforced, not lint-enforced
2. Install Prettier, add `.prettierrc` (matching existing defaults) + `.prettierignore`, add `format`/`format:check` scripts
3. Install `simple-git-hooks` + `lint-staged`, configure pre-commit to run `eslint --fix` + `prettier --write` on staged files, register the hook
4. Run lint/format/build to verify, then check off scope.md feature #2's two checklist items and flip its table status from "not started"

If the user wants something else first, re-decide — don't assume feature #2 is still the priority without asking, per AGENTS.md's "report, stop, wait" workflow.

## Open questions

- None blocking — just awaiting explicit go-ahead on feature #2's build step (already decided and reported, per this project's strict "decide → report → stop → wait for go-ahead, every feature, no exceptions" rule in AGENTS.md)
