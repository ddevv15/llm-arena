# Scope: LLM Arena

Send one prompt, watch up to three AI models answer it at the same time, and vote for the best one. Over time those votes and the real per-call numbers, speed, tokens, cost, build an honest leaderboard of which model is actually worth using.

Build it in a thin, working slice first, one prompt actually reaching a model and coming back, before making any single part of it fuller. Then thicken it piece by piece. Before building anything, decide what you're doing and why in a few plain sentences, then build it, and if the plan turns out wrong once it's actually built, say so and fix the plan too, not just the code.

Whenever a "build it" style step actually gets underway, break it into its own short list of what's genuinely being done, and check each part off as it's finished, right in this file. That way this file can be opened fresh, in a brand new conversation, and it's obvious what's already done and what's still left, without anyone re-explaining the feature from scratch.

## Stack

Already decided, nothing open here: Next.js (App Router), TypeScript, Tailwind, shadcn for components (card, button, popover, loading skeleton, and whatever else the UI actually needs as it gets built), Prisma with Postgres, Clerk for auth, Arcjet in front of the endpoint, PostHog for analytics and observability.

## Sketches

There are rough hand-drawn sketches for the arena screen, the leaderboard, and the models page. Treat them as structure only, where things sit, what exists on the page, not as the final design or the actual colors, all of that is already decided elsewhere in this file. If something in a sketch genuinely contradicts what's written here, stop and ask which one actually wins rather than guessing.

## At a glance

| #   | Feature                                     | Phase      | Status      |
| --- | ------------------------------------------- | ---------- | ----------- |
| 1   | Connecting to a model                       | Foundation | in progress |
| 2   | Coding standards & tooling                  | Foundation | done        |
| 3   | Data model                                  | Foundation | done        |
| 4   | Design & look                               | Foundation | done        |
| 5   | Model picker                                | Slice 1    | not started |
| 6   | Send a prompt, parallel streams, and voting | Slice 1    | in progress |
| 7   | App shell & thread history                  | Slice 2    | in progress |
| 8   | Public thread visibility & sharing          | Slice 3    | not started |
| 9   | Leaderboard: global & personal              | Slice 4    | not started |

## Foundation

### 1. How the app actually connects to a model

The Next.js project itself gets created manually first, `create-next-app`, fast and simple, no reason to spend agent time or tokens on something that easy.

Two real decisions still open once that exists: how the app calls OpenRouter to get a model's answer, and how streaming three models back to the browser at once should actually work. This one's worth real thought: routing all three through one shared connection looks simpler, but if that one connection drops, all three answers die together, which breaks the whole point of one model failing never affecting the others. Decide both properly, then wire them, along with Prisma, Clerk, and Arcjet, into the project that already exists.

PostHog should be wired in from the start too, session replay and heatmaps turned on, and tied to the signed-in user once Clerk resolves, so events are attached to a real person, not left anonymous.

Decided: the app calls OpenRouter through the Vercel AI SDK (`ai` + `@openrouter/ai-sdk-provider`), streaming on the plain Node runtime, no edge. Three models never share one connection, since that would make one dropping take the other two down with it, defeating the whole point of independent failure. `POST /api/chat` streams one model's answer at a time; the browser calls it three times in parallel, once per selected model, each with its own connection and its own reader. A follow-up just calls it again with that model's own growing message history. Enough Clerk to know who's asking is wired in now (`clerkMiddleware`, `ClerkProvider`, `auth()` gating the route); Prisma, Arcjet, and the rest of PostHog stay with their own features so this doesn't balloon into one untracked step.

- [x] Decide the approach
- [x] Build it: `lib/env.ts` (fail fast on missing vars), `lib/openrouter.ts`, `lib/model-stream.ts` (SSE framing: `chunk` / `error` / `done`, errors never leak the raw exception), `app/api/chat/route.ts`, `middleware.ts` + `ClerkProvider` in `app/layout.tsx`
- [ ] Verify by hand: confirmed live under a real signed-in session — Clerk auth resolved, Arcjet passed, `streamText` was called, and a genuine provider error (bad model id) was caught and masked into the plain human message correctly. A successful model response hasn't been seen yet; not worth a dedicated round to force one, will happen naturally once feature #5 (model picker) gives a real model id to send.

Hardened after a code review surfaced three gaps, ahead of the full feature:

- **`lib/env.ts` was only lazy.** The read-on-first-access proxy let a route's first real request discover missing config instead of the server refusing to boot. Added `assertRequiredEnv()`, called once from a new root `instrumentation.ts`'s `register()` — Next.js runs that at real server startup (not during `next build`'s module analysis, confirmed via the framework's own instrumentation docs), so a missing var now crashes the process before it serves anything. Verified by hand: deleted `ARCJET_KEY` from `.env.local`, `pnpm dev` crashed immediately with the exact missing-var error; restored it, server came back up clean.
- **`instrumentation-client.ts`'s PostHog init silently no-op'd in production** when config was missing (the throw only fired in development). Now it throws in every environment unless `NEXT_PUBLIC_POSTHOG_DISABLED=true` is set, an explicit, observable opt-out distinct from a misconfigured deploy. Documented in `.env.example`.
- **`app/api/chat/route.ts` only screened the newest message for prompt injection**, but forwarded the whole conversation array to the model — an earlier message could carry an injection payload behind a benign final prompt and reach the model unscreened. Added a `.refine()` on the request schema requiring messages to strictly alternate starting and ending on `"user"` (so every real earlier turn is unambiguous), and a second, lean Arcjet client (`ajPromptInjection` in `lib/arcjet.ts`, prompt-injection rule only, no `tokenBucket`) that screens every earlier user message in parallel, on top of the existing full `aj.protect()` screen on the newest one — so the per-conversation rate-limit budget still only spends once per request. Verified by hand: a standalone schema check confirmed 6 cases (valid single/multi-turn accepted; wrong-role-first, two user turns in a row, and ending on assistant all rejected).
- **`model` accepted any string**, letting an authenticated caller request a paid OpenRouter model under this app's key. Added `lib/models.ts`: `FREE_MODEL_IDS`, hand-filtered from a live `GET /api/v1/models` fetch to $0 pricing and text-output models only, and the request schema now uses `z.enum(FREE_MODEL_IDS)` instead of a bare string. Feature #5's live picker should apply this exact same filter so the two can't drift apart.

### 2. Coding standards & tooling

Write down the real conventions for this project once it actually exists, then install linting, formatting, and a pre-commit hook that actually enforces them.

Decided: conventions live in `AGENTS.md`'s existing `## Rules` section rather than a new doc, to avoid duplicating/drifting from what's already there — added one caveat that "functional style over mutating loops" is review-enforced, not lint-enforced (a `for await` loop over a stream reader is legitimate imperative code). Lint already covers `no-explicit-any`, `prefer-const`, `no-var` as errors via `eslint-config-next`'s flat config (confirmed with `eslint --print-config`), so AGENTS.md's strict-TS rules were already mechanically enforced before this feature. Added Prettier with default settings (already matched the existing code style — double quotes, semicolons, 2-space indent). Pre-commit uses `simple-git-hooks` + `lint-staged` (`eslint --fix` + `prettier --write` on staged files only, no full build/typecheck in the hook) rather than `husky`, to avoid the pnpm build-script postinstall friction hit earlier with Prisma — `simple-git-hooks` needs one manual `pnpm exec simple-git-hooks` to register, which was run once; the hook writes to `.git/hooks/pre-commit` locally and isn't tracked by git, so anyone who clones the repo needs to run that same command once after `pnpm install`.

- [x] Decide the approach
- [x] Install lint, format, and whatever else is needed, and write it up in a coding-standards doc: `.prettierrc`, `.prettierignore`, `format`/`format:check` scripts, `simple-git-hooks` + `lint-staged` config in `package.json`, hook registered and verified live on real staged files; lint, format:check, `tsc --noEmit`, and `next build` all pass

**Note (not yet reconciled):** `assets/docs/coding-standards.md` also exists, pasted in verbatim at the user's request as a target document. It describes a stricter, more built-out setup than the two paragraphs above — `husky` instead of `simple-git-hooks`, a `docs/` path instead of `assets/docs/`, an `infrastructure/`/`features/` folder layering with `no-restricted-imports` walls, `prettier-plugin-tailwindcss`, a `console.log`-fails-build rule, and other ESLint rules none of which are actually configured yet. Treat it as a future direction, not the current state, until each piece is actually decided and built through its own feature (mainly #3 onward, once real feature folders exist) — the two paragraphs above remain the accurate record of what feature #2 actually shipped.

### 3. Data model

The core things every feature depends on: users tied to Clerk, threads, each model's own messages inside a thread, and votes. A vote should only ever be possible on a turn where two or more models actually answered.

Decided: `User` → `Thread` → `Turn` → `ModelAnswer`, plus `Vote`. `User.id` is Clerk's own user id directly, no separate internal id or profile cache, since nothing in the app ever displays another user's profile (the leaderboards rank models, not people). `Thread` has no visibility/privacy column — feature #8 already treats threads as link-accessible by default. `Turn` is one row per prompt (named `Turn`, not `Message`, since one prompt fans out to several models' answers at once). `ModelAnswer` carries `status` (`STREAMING`/`COMPLETE`/`ERROR`) and the same `ttft`/`tokensPerSecond`/`outputTokens` feature #1's groundwork already computes, so a follow-up can reconstruct each model's own growing history independently. `Vote.turnId` is `@unique` (DB-level: no double-voting on a turn) and `Vote.answerId` is `@unique` too (an answer can win at most one vote, required by Prisma to make `ModelAnswer.wonVote` a proper one-to-one). The "needs 2+ answered models" rule is application code on the future insert path, not a DB constraint — Postgres can't express "count of sibling rows ≥ 2" declaratively without a trigger, not worth it for one legitimate insert path.

Scope boundary: schema + migration only, no application code calls Prisma yet — wiring real `prisma.turn.create()` / the vote insert path into the streaming flow is feature #6's job, same pattern as #1 building Arcjet/metrics ahead of #6 without wiring them in.

- [x] Decide the approach
- [x] Build it: `prisma/schema.prisma` rewritten (starter `User`/`Post` replaced), migration `20260813192045_core_data_model` generated via `prisma migrate diff` + applied via `prisma migrate deploy` (the interactive `migrate dev` path isn't available non-interactively), Prisma client regenerated. `prisma/seed.ts` now seeds one demo user/thread/turn/two answers/one vote to exercise the full graph, `scripts/verify-prisma.ts` counts all five models. Verified by hand: seed ran clean against the real Postgres DB, verify script confirmed `users: 3, threads: 1, turns: 1, answers: 2, votes: 1` (3 users because 2 stale `email`/`name`-stripped rows survived the migration from the old Alice/Bob starter seed — harmless, no threads reference them, left in place since deleting them needs a direct go-ahead). Lint, typecheck, and `next build` all pass.

### 4. Design & look

A coffee or dark brown background, warm, not neutral gray or true black. One accent color, rust, used only for things you interact with, buttons, links, focus states, the win-rate bar, never as decoration. Because the background and the accent are both warm tones from the same family, the accent has to stay clearly brighter and more saturated than the background, enough that a button never blends into the page behind it, that's a real risk with two warm colors this close and worth checking by eye, not just by the numbers. Blue, indigo, and purple are never the accent, under any circumstance. Green is reserved only for marking a winner, red only for errors, never reused for anything else. Contrast should genuinely hold up in both light and dark mode, not just look fine at a glance.

Decided: the whole app leans into an honest-ledger register, not a generic AI-startup look, because the one thing this product actually promises is real, unmanufactured numbers (including a $0.0000 cost line that's true, not a bug). That idea becomes the page's signature: every answer panel ends in a small receipt-style footer, monospace, dotted leaders between label and value (`tokens/s ..... 42`, `cost ..... $0.0000`), styled like a printed ticket stub rather than a stat card. Three model panels sit side by side on desktop (they answer in parallel, not in sequence, so no numbered 01/02/03 markers anywhere), stacking on mobile with the receipt footer as the last thing to "print in" once a panel finishes streaming, that's the one deliberate motion beat, everything else stays quiet, no hover confetti, no gradient hero.

Type: a warm slab serif with real character, Fraunces, carries the app name and the model-name headers on each panel, used sparingly, not for body text. Body copy runs in a humanist grotesk, Schibsted Grotesk, warmer and less clinical than the default Inter reach. Every number, anywhere, uses a monospace face, IBM Plex Mono, tokens/sec, ttft, cost, timestamps, so three models' figures actually line up in a column a person can compare at a glance.

Color tokens, dark mode: background `#241811`, card surface `#2E2015`, text `#F1E6D8`, rust accent `#C1652D`, winner green `#5B8A52`, error red `#D0362B`. Light mode is not a plain white flip, same paper: background `#EFE3D3` (warm parchment, not cream-#F4F1EA-default), card surface `#F7EEE0`, text `#2A1B10`, accent deepened to `#A8501E` to hold contrast on the lighter paper, green and red unchanged. Rust and red are kept clearly separate hues (rust reads orange, red reads red) so a losing-error state is never mistaken for the accent color at a glance.

Components: shadcn stays the library, but corners stay closer to sharp than rounded (4px radius, not the pill-shaped default), dividers are hairlines or the same dotted-leader motif as the receipt footer, no drop shadows or glassmorphism, flat and paper-like throughout.

- [x] Decide the approach
- [x] Build it: tokens wired into `app/globals.css` as CSS variables (`.dark` class + `next-themes`, `attribute="class"` `defaultTheme="system"`, so it follows the OS by default and a manual toggle can be added later without a rework), `--radius: 0.25rem`. Fonts wired into `app/layout.tsx` via `next/font/google`: Fraunces (`--font-display`), Schibsted Grotesk (`--font-sans`), IBM Plex Mono (`--font-mono`). shadcn initialized (`components.json`, `lib/utils.ts`), `button`/`card`/`badge` added as the base primitives. `components/receipt-footer.tsx` built as the shared signature component (dotted-leader label/value rows in mono), consumed via a `rows` prop so feature #6 can hand it real `tokens/s`/`ttft`/`cost` figures directly. Verified by hand: rendered a throwaway `/design-preview` route with real 3-panel content, screenshotted both light and dark via Playwright (OS `prefers-color-scheme` emulation, no manual toggle exists yet), confirmed the rust accent holds contrast against both the parchment and coffee backgrounds and the receipt footer's columns actually line up, then deleted the route, it wasn't a real feature page. Lint, typecheck, and `next build` all pass.

## Slice 1: Core arena loop

### 5. Model picker

An "Add model" popover pulling OpenRouter's live free-tier list, sorted by context window, capped at three models, defaulting to all three selected, with removable chips next to the prompt box. Also render that same catalog as a simple `/models` page, name, context window, and pricing for each one, so anyone can browse the full list without opening the picker.

- [ ] Decide the approach
- [ ] Build it

### 6. Send a prompt, parallel streams, and voting

The heart of the product. One prompt goes to every selected model at once, each streaming and failing independently, so one being slow or down never blocks the others. Each answer shows its own real time-to-first-token, tokens per second, and total tokens. No cost shown, every model here is free tier, so it would always read zero. A vote only exists once two or more models have answered, and picking one writes exactly one vote and marks that answer as the winner, while every answer stays visible the whole time. A follow-up continues each model's own separate conversation.

Arcjet sits in front of this endpoint before any model is ever called: rate limiting, bot protection, and a shield against prompt injection, plus a real limit on how much one person can use across all three models at once, not just a limit on the endpoint overall.

Decided (Arcjet, ahead of the full feature): `lib/arcjet.ts` wires `shield`, `detectBot`, `detectPromptInjection`, and a `tokenBucket` (capacity 20, refill 5/10s) keyed on `userId` rather than IP, so the limit is shared across the three parallel per-model calls one prompt will eventually make, not per-connection. Wired into `app/api/chat/route.ts` after auth, before the model is called. Passes build/lint; the live 429 and prompt-injection denials have **not** been triggered by hand yet, needs a signed-in browser session sending rapid/adversarial prompts.

Decided (per-call metrics, ahead of the full feature): `lib/model-stream.ts` now computes `ttft`, `outputTokens`, and `tokensPerSecond` and sends them on the `done` SSE event (`app/api/chat/route.ts` captures `requestStart` right before `streamText()`, after auth/Arcjet, so the number times the model only). `tokensPerSecond` is wall-clock throughput, `outputTokens / (finish − requestStart)`, not per-delta timing, since some OpenRouter providers stream token-by-token and others buffer-and-flush, and a delta-timing-based number would measure that difference instead of real model speed. Confirmed the fields exist and typecheck against `ai@7.0.62`; not yet verified by hand that the numbers look sane on a real streamed answer. No UI reads these yet.

Prisma (data model) is separate and still fully open, see feature #3.

- [ ] Decide the approach
- [ ] Build it

## Slice 2: App shell & thread history

### 7. App shell & thread history

The frame everything else sits inside: a top bar and sidebar that stay in place while the page scrolls, the thread's name, and each model's win record shown right there (shrinking down to a small dot and number if it gets crowded). The sidebar lists a signed-in user's own past threads so the tool actually feels usable across visits, not just in one sitting.

Decided (UI only, ahead of the full feature): built the frame with placeholder thread/win-record data, since the real thread list (feature #7's own data wiring), model catalog (#5), and streaming/voting (#6) don't exist yet. `components/app-shell.tsx` — sidebar (wordmark, "New thread" button, thread list, active thread marked with a rust left-rule rather than a filled pill, consistent with the ledger identity from feature #4) is a fixed column on `md`+ and an off-canvas drawer below it, opened by a top-bar menu button, closed by backdrop click or Escape, with focus moved to the drawer's close button on open and back to the menu button on close. Top bar shows the thread name plus each model's win record as small mono chips (`Claude Sonnet 5 · 5`); below `sm` those collapse to a dot-and-number chip per model, per the brief. Win-record chips deliberately use neutral secondary styling, not green, since scope.md reserves green for marking a single turn's winner, not a running tally. `app/page.tsx`'s signed-in branch now renders inside `AppShell`; signed-out keeps feature #1's original minimal sign-in prompt, no shell, nothing to show pre-auth. Main content area is a placeholder "ask three models" message with a disabled button, feature #6's real prompt composer replaces it.

Scope boundary: no real routing yet, sidebar thread links point at `/thread/[id]` hrefs that don't resolve to a real page, that's feature #7's own remaining data-wiring work (or #6/#8), not built here.

**Open note:** user flagged the built UI as not good on sight, needs a real design pass before this is considered finished. Deliberately deferred, not forgotten, feature-list work (#5/#6) takes priority for now. Don't treat #4 or #7 as visually settled in a fresh conversation.

- [x] Decide the approach
- [x] Build it: verified by hand on a throwaway unauthenticated preview route (`AppShell` rendered directly, bypassing the Clerk gate) — screenshotted light and dark at desktop width (sidebar, active-thread highlight, full win-record chips all correct in both) and at a 390px mobile width (sidebar hidden, win chips collapsed to dots, hamburger present). Opened the mobile drawer, confirmed the backdrop and content render correctly, then confirmed Escape closes it and returns focus to the menu button. Deleted the preview route afterward. Lint, format, typecheck (via `next build`'s own TypeScript pass), and `next build` all pass.

## Slice 3: Public visibility & sharing

### 8. Public thread visibility & sharing

Anyone should be able to open a thread's link and see it, without an account, that's what actually makes it shareable. Only sending a prompt and voting need sign-in. A made-up or deleted thread just shows a plain not-found page either way. The thread's real owner sees everything everyone else sees, plus the ability to actually use it.

- [ ] Decide the approach
- [ ] Build it

## Slice 4: Leaderboard

### 9. Leaderboard: global & personal

Two leaderboards from the same votes, one for everyone, one just for the signed-in user. Each row's win rate is the big, bold number, in the accent color, with a small bar next to it, always written as "won 4 of 5," never a bare percentage or a made-up score. Smaller, quieter numbers underneath for average speed and time-to-first-token, each clearly labeled. No cost or "cheapest" stat, every model is free, so that number never means anything here. First place gets a subtle highlight, nobody else does.

- [ ] Decide the approach
- [ ] Build it

## Not doing right now

Kept here so the plan stays honest about what's deliberately left out.

- A "fastest" label on the leaderboard, tagging whichever model already has the best average speed, only for models with enough votes to mean anything. Nice to have, not required.
- Giving each model's own little icon a distinct look instead of plain gray. Nice to have, not required.
- Privacy policy and terms pages.
- Rich link previews when a thread gets shared somewhere.
- Any kind of admin or moderation page.
- A public API for the leaderboard data. Nobody's asked for this.
