# Memory — Arcjet protection + Prisma Postgres setup

Last updated: 2026-08-13

## What was built

**Arcjet protection on `/api/chat`:**
- `lib/arcjet.ts` — shared Arcjet client: `shield`, `detectBot`, `detectPromptInjection`, `tokenBucket` (capacity 20, refill 5 tokens/10s, keyed on `userId`)
- `app/api/chat/route.ts` — calls `aj.protect()` after the existing Clerk auth check, before `streamText()`; latest user message checked for prompt injection; denials mapped to 429 (rate limit) / 400 (prompt injection) / 403 (bot/shield/other) via the existing `humanError()` helper
- `ARCJET_KEY` added to `.env.local`, `.env.example`, and `lib/env.ts`'s required-vars list
- Installed `@arcjet/next`
- Arcjet site "llm-arena" already existed under the Personal team in Arcjet's console — reused rather than recreated

**Prisma Postgres, end to end:**
- Linked to existing Prisma Postgres database `db_cmsrf1uqb1qvfzrf6u11jy6u5` via `prisma postgres link` (CLI auth, not interactive) — `DATABASE_URL` written to `.env.local`
- `prisma/schema.prisma` — `prisma-client` generator (output `../generated/prisma`), Prisma 7 style with **no `url` in the datasource block** (URL lives in `prisma.config.ts` instead)
- `prisma.config.ts` — datasource URL from env, `migrations.seed: "tsx prisma/seed.ts"`
- Starter schema: `User` ↔ `Post` (one-to-many) — explicitly a placeholder, not the real app data model
- `prisma/migrations/20260813111720_init` applied
- `lib/prisma.ts` — singleton `PrismaClient` with `PrismaPg` adapter, cached on `globalThis` in dev
- `prisma/seed.ts` — seeds 2 users with posts; ran successfully via `prisma db seed`
- `scripts/verify-prisma.ts` — confirms a live DB connection (`✅ Connected (found 2 users)`)
- `DATABASE_URL` added to `.env.example`
- `.gitignore` updated: `/generated/prisma` (build output) and `.env*` (already covered `.env`, confirmed `.env.local`/`.env` never tracked)

**Environment setup:**
- Homebrew `node@22` upgraded 22.17.1 → 22.23.2 (required by `@arcjet/next`'s Node minimum)
- `package.json` gained a `pnpm.onlyBuiltDependencies` allowlist (`@prisma/client`, `@prisma/engines`, `esbuild`, `prisma`) so pnpm's build-script approval gate doesn't block Prisma's postinstall

## Decisions made

- Arcjet is request-based (`@arcjet/next`), not guard-based, since `/api/chat` has a real HTTP `Request` object
- Per-user token bucket keyed on `userId` (not IP) is what makes the rate limit shared across the three parallel per-model calls the arena UI will eventually make — this was the key design point from `scope.md` feature #6
- Both `shield` (SQLi/XSS) and `detectPromptInjection` are wired in, since scope.md's wording ("shield against prompt injection") conflates two distinct Arcjet rules
- Prisma `User`/`Post` schema is intentionally a generic starter, not the real data model. The real data model (users tied to Clerk, threads, per-model messages, votes) is still open — belongs to `scope.md` feature #3 and should go through `/architect`

## Problems solved

- `npm install` failed with a cryptic `Cannot read properties of null` error — this project uses pnpm (`packageManager: pnpm@10.23.0`), not npm; switching fixed it
- pnpm silently skipped Prisma's postinstall/build scripts (`Ignored build scripts: @prisma/engines, esbuild, prisma`) — fixed by adding `pnpm.onlyBuiltDependencies` to `package.json` and running `pnpm rebuild`
- `@arcjet/next` requires Node `>=22.21.0`; local Node was `22.17.1` — upgraded via `brew upgrade node@22`
- Prisma's public `llms-full.txt` doesn't document the `prisma postgres link` subcommand at all — confirmed it exists and got exact usage via `prisma postgres --help` instead of trusting training data

## Current state

- Both features fully wired, verified, and passing lint + typecheck + `next build`
- Arcjet: wiring confirmed via typecheck/build only — a live decision (e.g. hitting the 429 rate limit) has **not** been triggered yet, since `/api/chat` requires a signed-in Clerk session and there was no way to authenticate via `curl`. Needs manual verification through the browser once signed in.
- Prisma: fully verified end-to-end, including a live DB read (`scripts/verify-prisma.ts`)
- `scope.md` feature #6 (Arcjet) and feature #3 (data model) are still marked "not started" — this session's work is infrastructure underneath both, not the full feature build-out

## Next session starts with

Two open threads, pick up either:
1. **Arcjet manual verification** — sign in via browser, send ~25 rapid prompts to `/api/chat` to confirm the 429 actually fires, check `npx @arcjet/cli requests list --site-id site_01kzxbxd1ce4n8zxxb44qmaqxg`
2. **scope.md update** — was about to ask the user whether to update `scope.md` to note Prisma/Arcjet infra is live, while leaving feature #3's real schema decision open for `/architect`. Awaiting their answer.

## Open questions

- Should `scope.md` be updated now to reflect that Arcjet + Prisma Postgres infra is live, without marking features #3 or #6 as fully done (since the real data model and the rest of the parallel-streaming/voting feature aren't built yet)?
- The real Prisma data model (users/threads/messages/votes per scope.md feature #3) is still undecided — needs an `/architect` pass before building
