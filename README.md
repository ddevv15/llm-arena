<div align="center">

# LLM ARENA

### `MULTI-MODEL EVALUATION // PARALLEL STREAMING // HONEST NUMBERS`

<img
src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=500&size=18&pause=1000&color=888888&center=true&vCenter=true&width=700&lines=one+prompt+%E2%86%92+three+models+%E2%86%92+side+by+side;real+per-call+numbers%2C+measured+not+estimated;votes+build+a+leaderboard+nobody+invented"
alt="Typing SVG"
/>

<br/>

[![Next.js](https://img.shields.io/badge/NEXT.JS_16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TYPESCRIPT-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Postgres](https://img.shields.io/badge/POSTGRES-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![OpenRouter](https://img.shields.io/badge/OPENROUTER-6467F2?style=for-the-badge&logo=openai&logoColor=white)](https://openrouter.ai)

</div>

---

```txt
you@arena:~$ what is this

> Send one prompt to up to three language models at once
> Watch every answer stream in, side by side, in real time
> Pick the one you'd actually use
> Those votes build a leaderboard nobody invented
```

Most model comparisons are a screenshot of someone's single lucky prompt, or a benchmark that stopped meaning anything the week it was published. This is neither. You send **your** prompt, you watch the answers arrive at the speed they actually arrive at, and you vote on the one you'd genuinely reach for.

The numbers underneath each answer are measured on that call, not quoted from a model card. **Every model here is on the free tier, so cost always reads `$0.0000` — that is a real, honestly measured number, not a placeholder.**

---

# `01 // WHAT IT DOES`

<table>
<tr>

<td width="50%" valign="top">

## ⚔️ The arena

### Three models, one prompt, one screen

Pick up to three models, send a prompt, and each answer streams into its own column over its own connection.

One model being slow, rate-limited, or down never blocks the other two — they fail independently by design, not by luck.

**Built around**

- Three independent SSE connections
- Per-model conversation history
- Streaming with live token counts
- Independent failure per model
- Voting once two models have answered
- Threads readable by anyone with the link

`Vercel AI SDK` `SSE` `Prisma` `Clerk`

</td>

<td width="50%" valign="top">

## 🧾 The receipt

### Real numbers, or none at all

Every finished answer prints a receipt: tokens per second, time to first token, output tokens, cost.

Where a number is known to be misleading, it is withheld rather than shown prettily — the leaderboard has no speed column for exactly that reason, and says so on the page.

**Measured per call**

- Tokens per second (wall clock)
- Time to first token
- Output tokens
- Cost, always `$0.0000`
- Win rate, from real votes only

`PostHog` `Arcjet` `Postgres`

</td>

</tr>
</table>

---

# `02 // HOW A PROMPT FLOWS`

```txt
                          Composer
                              │
                              ▼
                     POST /api/turns
              auth → Arcjet screen → one write
                              │
              Thread + Turn + one ModelAnswer per model
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
      POST /api/chat  POST /api/chat  POST /api/chat
       (model A)       (model B)       (model C)
              │               │               │
         OpenRouter      OpenRouter      OpenRouter
              │               │               │
        chunk/done      chunk/done      chunk/done
              │               │               │
              ▼               ▼               ▼
         Column A        Column B        Column C
              └───────────────┼───────────────┘
                              ▼
                         Pick a winner
                              │
                              ▼
                    Vote → Leaderboard
```

**Three connections, never one.** A single multiplexed stream is simpler right up until it drops, and then all three answers die together — which defeats the entire point of watching models fail independently. Each model gets its own connection, its own reader, and its own history.

---

# `03 // THE NUMBERS ARE REAL, INCLUDING THE AWKWARD ONES`

```txt
tokens/s .................................... 75.5
ttft ...................................... 412ms
tokens ...................................... 128
cost .................................... $0.0000
```

Two measurements are **known to be wrong in a specific way**, and the app says so rather than quietly averaging them into a ranking:

| Measurement    | What it actually does                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| `ttft`         | Starts at the first **text** delta, so a model that reasons first can read as 116 seconds to first token |
| `outputTokens` | Comes from the provider's total usage and **includes reasoning tokens** — 416 tokens for the word "blue" |

That is why the leaderboard ranks on votes and carries no speed column yet. A wrong number averaged across models and then sorted by is an invented score, just arrived at honestly. The columns land when the measurement is fixed.

---

# `04 // ENGINEERING STACK`

<div align="center">

### `CORE`

<img src="https://skillicons.dev/icons?i=nextjs,react,ts,tailwind" alt="Core" />

<br/><br/>

### `DATA + AUTH`

<img src="https://skillicons.dev/icons?i=postgres,prisma,vercel" alt="Data and auth" />

<br/><br/>

### `MODELS + PLATFORM`

`OpenRouter` · `Vercel AI SDK` · `Clerk` · `Arcjet` · `PostHog`

</div>

---

# `05 // DECISIONS WORTH KNOWING`

```txt
INDEPENDENT STREAMS
│   Three connections, not one multiplexed stream.
│   One dropping must never take the other two with it.
│
PER-MODEL HISTORY
│   Each model continues its own conversation, built from
│   its own completed answers. A model that errored on turn
│   two doesn't inherit a gap the others don't have.
│
LINK-PUBLIC THREADS
│   No visibility column. A thread is readable by anyone
│   holding the link; writing to it is re-checked server
│   side on every route, never trusted to a hidden button.
│
WRITES FAIL CLOSED, READS FAIL OPEN
│   A prompt that can't be screened is refused. A page view
│   that can't be screened is served — a shared link going
│   dark because a security service blinked is worse than
│   one unscreened read.
│
17 HAND-CURATED FREE MODELS
│   The catalog does not say which free models can actually
│   be called. Every candidate is probed with a real
│   completion before it reaches the picker.
```

---

# `06 // RUNNING IT LOCALLY`

```bash
pnpm install
pnpm exec simple-git-hooks     # register the pre-commit hook, once
cp .env.example .env.local     # then fill it in
pnpm prisma migrate deploy
pnpm dev
```

Every variable in `.env.example` is required and checked at startup — a missing one **crashes the server on boot** rather than failing on somebody's first request. The two opt-outs are explicit: `NEXT_PUBLIC_POSTHOG_DISABLED=true` to run without analytics, and `ARCJET_ENV=development`, which you want locally or Arcjet cannot resolve a client IP behind the dev server.

```bash
pnpm lint          # eslint
pnpm format:check  # prettier
pnpm build         # the real check — typecheck plus a production build
```

There is no test runner and no browser automation in this project, deliberately. Changes are verified against a running server and a real browser.

---

# `07 // PROJECT DOCS`

| File                      | What's in it                                                                    |
| ------------------------- | ------------------------------------------------------------------------------- |
| `assets/docs/scope.md`    | The living plan. Every feature, the decision behind it, and how it was verified |
| `open-issues.md`          | The queue — things deliberately left open, each with its reason                 |
| `AGENTS.md` / `CLAUDE.md` | How to work in this repo                                                        |

`scope.md` is the permanent record and is meant to be readable cold: open it in a fresh session and it's obvious what's done, what isn't, and why each call was made.

---

<div align="center">

```txt
MEASURE.
DON'T ESTIMATE.
SHOW THE NUMBER.
EVEN WHEN IT'S ZERO.
```

### Built by [Dev Shah](https://shahdev.com)

[**PORTFOLIO**](https://shahdev.com)
·
[**LINKEDIN**](https://www.linkedin.com/in/devshah1583/)
·
[**GITHUB**](https://github.com/ddevv15)

</div>
