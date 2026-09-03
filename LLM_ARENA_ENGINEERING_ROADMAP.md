# LLM Arena — Engineering Roadmap

> **Goal:** evolve LLM Arena from a model-streaming application into a provider-agnostic **LLM evaluation and benchmarking platform** that can run models in parallel, normalize their streams, measure performance and cost consistently, and produce reproducible evaluations and rankings.

## Target architecture

```text
Prompt
   ↓
Request Orchestrator
   ↓
┌──────────┬──────────┬──────────┐
GPT        Claude     Gemini
↓           ↓           ↓
Streams     Streams     Streams
└──────┬────┴─────┬─────┘
       ↓
Normalized Event Stream
       ↓
Metrics
├── TTFT
├── tokens/sec
├── cost
├── latency
└── errors
       ↓
Evaluation + Ranking
```

**Important design rule:** GPT / Claude / Gemini are examples. The orchestrator should operate on a common provider interface so adding another model/provider does not require changing the core pipeline.

---

## 1. Build a provider abstraction layer

Create one internal contract that every provider adapter must implement.

```ts
export interface ModelProvider {
  id: string;
  stream(request: ModelRequest): AsyncIterable<NormalizedModelEvent>;
  estimateCost?(usage: TokenUsage, model: string): number;
}
```

Suggested adapters:

```text
/providers
  openai.ts
  anthropic.ts
  google.ts
  openrouter.ts
```

### Why this matters

Without an adapter layer, provider-specific SDK behavior leaks into the rest of the app. With it, the orchestrator, metrics engine, persistence layer, and UI operate against one consistent contract.

### Definition of done

- [ ] Each provider implements the same interface.
- [ ] Model IDs and provider configuration live in one registry.
- [ ] API keys are server-only.
- [ ] Adding a provider requires a new adapter, not modifications throughout the application.

---

## 2. Normalize every provider's stream

Providers emit streaming data differently. Convert all provider output into a small internal event protocol.

```ts
type NormalizedModelEvent =
  | { type: "start"; runId: string; model: string; timestamp: number }
  | { type: "token"; text: string; timestamp: number }
  | { type: "usage"; inputTokens: number; outputTokens: number }
  | { type: "finish"; finishReason?: string; timestamp: number }
  | { type: "error"; code: string; message: string; timestamp: number };
```

### Benefits

- UI no longer cares which SDK produced the stream.
- Metrics can be calculated identically for every provider.
- Events can be persisted and replayed.
- Testing becomes dramatically easier.

### Definition of done

- [ ] Provider-specific chunks never reach the frontend directly.
- [ ] All adapters pass contract tests against the same event expectations.
- [ ] Disconnect/error/finish states use normalized events.

---

## 3. Build the Request Orchestrator

The orchestrator receives one prompt and fans the request out to the selected models concurrently.

```text
Arena Request
     │
     ├── model A ──→ provider adapter ──→ stream
     ├── model B ──→ provider adapter ──→ stream
     └── model C ──→ provider adapter ──→ stream
```

### Responsibilities

- Generate a single `arenaRunId`.
- Start selected models concurrently.
- Give each request its own cancellation/timeout controller.
- Forward normalized events as soon as they arrive.
- Prevent one failed provider from killing the entire arena run.
- Record per-provider start/end/error state.

### Failure behavior

Prefer partial success:

```text
GPT     ✅ complete
Claude  ❌ timeout
Gemini  ✅ complete

Arena result = successful with one provider error
```

Do **not** fail the entire comparison because one model failed.

### Engineering details worth implementing

- [ ] `Promise.allSettled()` or equivalent isolation.
- [ ] `AbortController` per model.
- [ ] Configurable hard timeout.
- [ ] Client-disconnect cancellation.
- [ ] Retry only safe/transient failures such as 429/5xx.
- [ ] Exponential backoff with jitter.

---

## 4. Create a proper metrics engine

The metrics layer is one of the strongest ways to make LLM Arena more than an API wrapper.

### Core metrics

#### Time to first token (TTFT)

```text
TTFT = timestamp(first normalized token) - request start timestamp
```

Measure this on the server with a monotonic timer whenever possible.

#### Total latency

```text
latency = completion timestamp - request start timestamp
```

#### Generation throughput

```text
tokens/sec = output tokens / generation duration
```

For fair comparisons, explicitly document whether generation duration begins at request start or first-token time. A useful metric is:

```text
generation duration = completion - first token
```

#### Cost

Maintain a versioned pricing registry.

```ts
{
  provider: "openai",
  model: "...",
  inputPer1M: 0,
  outputPer1M: 0,
  effectiveFrom: "YYYY-MM-DD"
}
```

Then calculate:

```text
cost = input-token cost + output-token cost
```

Store the pricing version used for every run so historical benchmarks remain reproducible even after providers change pricing.

#### Errors

Normalize errors into categories such as:

```text
RATE_LIMIT
TIMEOUT
AUTH
PROVIDER_5XX
CONTEXT_LIMIT
CONTENT_FILTER
CLIENT_DISCONNECT
UNKNOWN
```

### Strong additional metrics

- [ ] First-token success rate.
- [ ] Completion success rate.
- [ ] Median / p95 TTFT by model.
- [ ] Median / p95 latency by model.
- [ ] Cost per successful response.
- [ ] Output tokens per dollar.
- [ ] Quality score per dollar.

---

## 5. Persist arena runs instead of only displaying them

Suggested conceptual model:

```text
ArenaRun
├── id
├── userId
├── prompt
├── createdAt
└── responses[]

ModelResponse
├── id
├── arenaRunId
├── provider
├── model
├── responseText
├── ttftMs
├── latencyMs
├── inputTokens
├── outputTokens
├── tokensPerSecond
├── estimatedCost
├── status
└── errorCode

Evaluation
├── arenaRunId
├── winnerResponseId
├── method
├── scores
└── createdAt
```

### Why persistence matters

Once comparisons are stored, LLM Arena can become an actual benchmarking product rather than a one-time chat UI.

It enables:

- historical model comparisons;
- aggregate performance dashboards;
- reproducible benchmark suites;
- per-prompt analysis;
- model/provider reliability statistics;
- user voting and ranking histories.

---

## 6. Add blind evaluation

Do not show model/provider names until after the user votes.

```text
Response A     Response B     Response C
     \             |             /
              User Vote
                  ↓
             Reveal Models
```

This reduces brand bias and gives the comparison platform a real evaluation mechanism.

### Store

- winning response;
- losing responses;
- tie / both-bad choice;
- prompt category;
- model identities;
- timestamp.

---

## 7. Build ranking instead of simply showing a winner

Start simple and add complexity only when you have enough data.

### Level 1 — raw wins

```text
win rate = wins / completed comparisons
```

### Level 2 — pairwise Elo

Useful once models face one another across many prompts.

Store rating history rather than only the latest number.

### Level 3 — multi-dimensional ranking

Do **not** collapse everything into one number unless the scoring weights are visible.

Useful dimensions:

```text
Quality
Speed
Cost
Reliability
User preference
```

Then expose views such as:

- Best quality
- Fastest
- Cheapest
- Best quality-per-dollar
- Best overall for coding
- Best overall for reasoning

---

## 8. Add LLM-as-a-Judge carefully

Automated judging can supplement human voting, not replace it.

Possible rubric:

```json
{
  "correctness": 1,
  "relevance": 1,
  "reasoning": 1,
  "clarity": 1,
  "completeness": 1
}
```

### Guard against judge bias

- Randomize response order.
- Hide provider/model names.
- Use structured JSON output.
- Save the judge prompt and judge model version.
- Compare automated judgments against human votes.
- Consider multiple judges for important benchmarks.

---

## 9. Add benchmark suites

Allow a user to save a set of prompts and run them against selected models.

```text
Benchmark Suite
├── Coding
│   ├── Prompt 1
│   ├── Prompt 2
│   └── Prompt 3
├── Reasoning
├── Writing
└── Summarization
```

A benchmark run can produce:

```text
Model       Quality   TTFT   Latency   Cost   Errors
GPT-X       8.8       620ms  4.2s      $...   0%
Claude-X    9.1       910ms  5.0s      $...   0%
Gemini-X    8.4       410ms  3.7s      $...   2%
```

This is a major step toward making the project useful for developers evaluating which model to deploy.

---

## 10. Make runs reproducible

Persist enough context to rerun a comparison later:

- provider;
- exact model ID/version;
- prompt;
- system prompt;
- temperature;
- max tokens;
- tool configuration;
- timestamp;
- pricing version;
- application commit/version if useful.

If a model is silently updated by the provider, surface that limitation rather than pretending the result is perfectly reproducible.

---

## 11. Add observability like a production system

### Structured logs

Every log should include identifiers such as:

```text
arenaRunId
responseId
provider
model
userId (or anonymized identifier)
request duration
status
error category
```

### Consider

- OpenTelemetry traces;
- Sentry/error tracking;
- request/error dashboards;
- provider health dashboard;
- p50/p95/p99 latency tracking.

An orchestrator trace should make it possible to see where time was spent for each model.

---

## 12. Security and abuse controls

LLM endpoints can become unexpectedly expensive when abused.

### Minimum controls

- [ ] Keep every provider secret server-side.
- [ ] Rate-limit by user/IP with Arcjet.
- [ ] Limit number of models per arena run.
- [ ] Limit prompt/context size.
- [ ] Set hard provider timeouts.
- [ ] Add daily/monthly spend caps.
- [ ] Validate model IDs server-side instead of accepting arbitrary strings.
- [ ] Prevent clients from setting provider credentials.
- [ ] Sanitize stored/shareable content where appropriate.

### Nice-to-have

Create a quota model:

```text
anonymous → 1–2 models / limited runs
signed-in  → larger quota
admin/dev  → unrestricted benchmark mode
```

---

## 13. Test the architecture, not only the UI

### Unit tests

- metric calculations;
- cost calculations;
- error normalization;
- provider chunk → normalized event conversion;
- ranking math.

### Contract tests

Run the same test suite against every provider adapter.

```ts
providerContract(openAIProvider);
providerContract(anthropicProvider);
providerContract(googleProvider);
```

### Integration tests

Use mocked streaming providers to test:

- provider succeeds;
- provider times out;
- stream disconnects halfway;
- one provider fails while two succeed;
- usage arrives after content;
- malformed provider event.

### End-to-end tests

Verify that:

1. a user submits a prompt;
2. multiple response panels begin independently;
3. text streams correctly;
4. metrics finalize;
5. provider failure does not kill other streams;
6. voting persists;
7. model names reveal after a blind vote.

### Load testing

Eventually test concurrent arena runs rather than only concurrent users.

Three models per user means:

```text
100 arena runs = potentially 300 upstream LLM requests
```

That multiplier matters.

---

## 14. UI features that add real product value

Prioritize features that expose the engineering work rather than hiding it.

### Comparison view

Each response panel can show:

```text
Model A
────────────
Response...

TTFT          540 ms
Latency       4.8 s
Output        612 tokens
Throughput    142 tok/s
Cost          $0.00...
Status        Complete
```

### Useful controls

- [ ] Model selector.
- [ ] Blind mode.
- [ ] Side-by-side and stacked layouts.
- [ ] Stop one model without stopping others.
- [ ] Stop all.
- [ ] Copy/download result.
- [ ] Shareable arena-run link.
- [ ] Re-run same prompt.
- [ ] Compare previous run.

---

## 15. High-value differentiators after the core system works

These should come **after** orchestration, normalization, metrics, persistence, reliability, and tests.

### Cost-quality frontier

Plot models by quality versus cost and identify Pareto-efficient models.

### Speed-quality frontier

Help developers choose the best model under a latency budget.

### Model routing recommendation

Given historical arena data, recommend a model based on a constraint such as:

```text
"Best coding model under $0.01/request and p95 latency under 5s"
```

### Prompt-category analytics

Automatically or manually tag prompts:

```text
coding
reasoning
writing
summarization
research
```

Then expose per-category rankings.

### Bring-your-own-key mode

Allow advanced users to use their own provider credentials without permanently storing them. This needs careful security design and should not be rushed.

### Dataset export

Allow benchmark results to be exported as JSON/CSV for analysis.

---

# Recommended implementation order

Do not try to build everything simultaneously.

## Milestone 1 — Multi-provider foundation

- [ ] Provider interface.
- [ ] OpenAI/OpenRouter adapter.
- [ ] Anthropic adapter.
- [ ] Google adapter.
- [ ] Normalized event schema.
- [ ] Adapter contract tests.

**Result:** one internal API for every model.

## Milestone 2 — Parallel arena

- [ ] Request orchestrator.
- [ ] Concurrent model streams.
- [ ] Independent cancellation/timeouts.
- [ ] Partial-failure handling.
- [ ] Multi-panel streaming UI.

**Result:** one prompt genuinely runs across multiple models in parallel.

## Milestone 3 — Measurement

- [ ] TTFT.
- [ ] latency.
- [ ] output tokens.
- [ ] tokens/sec.
- [ ] cost.
- [ ] normalized error categories.

**Result:** LLM Arena becomes measurable instead of subjective only.

## Milestone 4 — Persistence + evaluation

- [ ] Store arena runs.
- [ ] Blind voting.
- [ ] Shareable results.
- [ ] Win-rate ranking.
- [ ] Elo when sufficient comparison data exists.

**Result:** the application starts accumulating meaningful evaluation data.

## Milestone 5 — Production engineering

- [ ] Rate limiting.
- [ ] quotas/spend controls.
- [ ] retries/backoff.
- [ ] observability.
- [ ] integration/E2E tests.
- [ ] load tests.

**Result:** the project demonstrates production reliability, not only features.

## Milestone 6 — Benchmark platform

- [ ] Benchmark suites.
- [ ] LLM-as-a-Judge.
- [ ] category rankings.
- [ ] historical analytics.
- [ ] cost-quality/speed-quality frontiers.
- [ ] result export.

**Result:** LLM Arena becomes a genuine developer evaluation tool.

---

# What would make this project resume-level exceptional?

Aim to eventually be able to truthfully write bullets like these — **do not use them until the features and numbers are real**:

> Built a provider-agnostic LLM evaluation platform that orchestrates parallel streaming responses across multiple model providers through a normalized event protocol, isolating provider failures and supporting independent cancellation/timeouts.

> Instrumented model performance across TTFT, latency, throughput, token usage, cost, and normalized error rates; persisted comparison runs for reproducible benchmarking and model-level analytics.

> Implemented blind pairwise evaluation and ranking across real user comparisons, with automated benchmark suites and quality/cost analysis for model-selection decisions.

Even stronger once there is usage:

> Processed **X+ model comparisons** across **Y+ users**, with p95 arena latency of **Z**, **N%** successful completion, and historical evaluation data across **M** model providers.

The important part is that the numbers must come from actual telemetry, not estimates.

---

# What _not_ to do

Avoid turning the repo into a long list of superficial AI features.

Do not prioritize these before the architecture is solid:

- generic chatbot memory;
- flashy animations;
- dozens of providers without adapter tests;
- arbitrary "AI score" numbers with no visible rubric;
- agents just because agents are trendy;
- a large feature list without persistence, testing, observability, or failure handling.

The differentiator should be:

> **one prompt → parallel providers → normalized streams → trustworthy metrics → reproducible evaluation → evidence-backed ranking**

---

# Short-term next actions

If opening this file later and wondering what to build next, start here:

1. Define `ModelProvider`, `ModelRequest`, and `NormalizedModelEvent`.
2. Move existing OpenRouter/AI SDK logic behind the provider interface.
3. Add a second genuinely independent provider adapter.
4. Write adapter contract tests before adding the third provider.
5. Build the orchestrator with concurrent streams + partial failure handling.
6. Finalize metric definitions and persist raw timestamps/usage.
7. Add a side-by-side comparison UI.
8. Add blind user voting.
9. Persist arena runs and expose historical comparisons.
10. Only then move into rankings, benchmark suites, and LLM-as-a-Judge.

---

## North-star statement

**LLM Arena should answer a practical engineering question:**

> _For this prompt and these constraints, which model performs best — and can I prove why using quality, speed, reliability, and cost data?_
