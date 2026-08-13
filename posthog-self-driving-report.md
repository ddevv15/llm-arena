# PostHog Self-driving Setup Report

## Summary

PostHog Self-driving has been configured for LLM Arena. Signal sources for error tracking, session replay, support, and health checks are now enabled and routed into the inbox. A five-scout troop is active — covering the core arena funnel, LLM observability, web traffic, and instrumentation health — and two Replay Vision scanners are standing by to watch recordings the moment they start arriving. Findings will begin appearing in the [Self-driving inbox](https://us.posthog.com/project/549399/inbox) within approximately 30 minutes.

---

## AI Data Processing

**Approved.** Organization-level AI data processing consent was confirmed by the wizard before this run started.

---

## GitHub

**Status: Not confirmed via API** — The GitHub App install was attempted three times (the user confirmed "Done" each time) but the integration did not appear in `integrations-list` after any confirmation. This is likely a propagation delay.

**Follow-up required:**
- Verify the integration is visible at [Integrations settings](https://us.posthog.com/project/549399/settings/environment-integrations).
- If missing, re-run the one-click install: `https://us.posthog.com/api/environments/549399/integrations/authorize?kind=github`.
- GitHub access is required for Self-driving to research findings in code and open fixes. Until confirmed, findings will surface in the inbox but code-level investigation will be limited.

---

## Products Enabled

The `products-enable` tool was not available on this deploy. Manual enables required:

| Product | Status | Action needed |
|---|---|---|
| Session Replay | Enabled (server flip pending confirmation) | Settings → Session Replay → "Record user sessions" |
| Error Tracking | **Already configured in init** (`capture_exceptions: true`) | Confirm "Enable exception autocapture" is ON in Settings → Error Tracking |
| Support (Conversations) | Enabled (server flip pending confirmation) | Turn on Conversations in the PostHog product sidebar |

**Web app init check:** The `instrumentation-client.ts` posthog.init is clean — no `disable_session_recording` or `capture_exceptions: false` override. The server flips will take effect as-is.

**Support note:** Conversations is now enabled but tickets only arrive once an inbound channel is connected. See Follow-ups.

---

## Signal Sources

| Source | Type | Action | Config ID |
|---|---|---|---|
| `signals_scout` | `cross_source_issue` | ON BY DEFAULT — no row needed | — |
| `health_checks` | `health_issue` | **Enabled** | `019ffaa6-fc8a-712c-a7ad-f12609e6316e` |
| `error_tracking` | `issue_created` | **Enabled** | `019ffaa7-022d-713d-918a-63209f1d098c` |
| `error_tracking` | `issue_reopened` | **Enabled** | `019ffaa7-0445-7df6-a3b4-25bf9bb3acb8` |
| `error_tracking` | `issue_spiking` | **Enabled** | `019ffaa7-12db-7081-ac36-b4e93d11ac6e` |
| `session_replay` | `session_analysis_cluster` | **Enabled** (sample rate: 0.1) | `019ffaa7-1571-77f9-bb7e-08b2daa21851` |
| `conversations` | `ticket` | **Enabled** (dormant until channel connected) | `019ffaa7-1818-70be-abff-9d74fb7c375d` |
| `llm_analytics` | — | Skipped — internal only, not a user-facing responder | — |
| `logs` | — | Skipped — not a v1 responder | — |
| `replay_vision` | — | Skipped — scanners are self-authorizing via `emits_signals` flag | — |

---

## Connected Tools

The user picked GitHub Issues, Linear, Jira, Sentry, and Zendesk. All were skipped or could not be connected during this run. Dormant responders are enabled for all five so they activate automatically once their warehouse sources are connected — no second setup trip needed.

| Tool | Class | Responder Config ID | Next step |
|---|---|---|---|
| GitHub Issues | **Selected but not connected** — GitHub App not confirmed in API; dormant responder enabled | `019ffaab-b610-7a22-925d-b093cbdfe4f2` | Confirm GitHub App, then add GitHub Issues source at [new source](https://us.posthog.com/project/549399/pipeline/new/source) |
| Linear | **Selected but skipped** — user skipped OAuth; dormant responder enabled | `019ffaab-b8ab-76e4-822e-d98c8062ecd1` | Connect at `https://us.posthog.com/api/environments/549399/integrations/authorize?kind=linear` |
| Jira | **Selected but skipped** — user skipped credential page; dormant responder enabled | `019ffaab-bae2-7374-a34a-49b206d6b9ba` | Connect at [https://us.posthog.com/project/549399/data-warehouse/connect?kind=Jira](https://us.posthog.com/project/549399/data-warehouse/connect?kind=Jira) |
| Sentry | **Selected but skipped** — user skipped credential page; dormant responder enabled | `019ffaab-c0e5-792a-b349-d311125a4e5f` | Connect at [https://us.posthog.com/project/549399/data-warehouse/connect?kind=Sentry](https://us.posthog.com/project/549399/data-warehouse/connect?kind=Sentry) |
| Zendesk | **Selected but skipped** — user skipped credential page; dormant responder enabled | `019ffaab-c841-74dd-a6f9-3f0f5bc33cec` | Connect at [https://us.posthog.com/project/549399/data-warehouse/connect?kind=Zendesk](https://us.posthog.com/project/549399/data-warehouse/connect?kind=Zendesk) |

Note: each connected source syncs only the table Signals reads (issues/tickets). Additional tables can be enabled in the data warehouse UI.

---

## Scout Troop

**Run budget:** 100 runs/day (early access default). 0 runs used today. Announcement: *"Scouts are in early access. Each project gets up to 100 scout runs a day. Contact team-self-driving@posthog.com if you need more."*

**Enabled (5 scouts):**

| Scout | Why enabled |
|---|---|
| `general` | Cross-product correlations and surfaces no specialist covers; always on |
| `product-analytics` | Core arena funnel (prompt → answer → vote) is the heart of the product |
| `ai-observability` | LLM analytics explicitly planned — wrapping model calls with PostHog `$ai_*` events |
| `web-analytics` | Next.js web app with traffic, channels, and landing-page health to watch |
| `health-checks` | Always actionable; especially valuable on a fresh PostHog setup |

**Disabled (22 scouts):**

| Scout | Reason |
|---|---|
| `error-tracking` | Covered by native error tracking source (step 4) — intentional |
| `session-replay` | Covered by native session replay source (step 4) — intentional |
| `feature-flags` | Not in use yet — enable if feature flags are added |
| `experiments` | Not in use yet — enable when A/B tests start |
| `surveys` | Not in use — enable if PostHog surveys are added |
| `revenue-analytics` | No payment SDK in this project |
| `csp-violations` | No CSP reporting configured |
| `logs` | PostHog logs product not in use |
| `customer-analytics` | No group/accounts analytics |
| `data-pipelines` | No CDP destinations or hog flows |
| `data-warehouse` | No external warehouse imports active |
| `conversations` | Conversations product enabled but no channel yet — enable when tickets start flowing |
| `apm` | No distributed tracing / OpenTelemetry configured |
| `anomaly-detection` | No dashboards yet to watch for anomalies |
| `observability-gaps` | No insights yet; will become useful once events and insights exist |
| `inbox-validation` | Avoided on fresh setup — no shipped fixes to validate yet |
| `insight-alerts` | No alerts configured |
| `replay-vision` | The analyst layer — reads trends across scanner observations; no observations yet |
| `tasks` | PostHog Tasks not in active use |
| `skills-store` | Skill hygiene scout — not a priority for this project |
| `mcp-tool-calls` | No `$mcp_tool_call` telemetry |
| `web-vitals` | Web Vitals (`$web_vitals`) not yet captured |

---

## Custom Scouts

One candidate was identified and proposed:

**"Watch the arena funnel for conversion drops"** (`signals-scout-arena-funnel`)
- **Surface:** The prompt→answer→vote funnel — the core loop of the product
- **Discriminator:** Vote rate (votes per session) sliding while prompt volume holds steady
- **Why not built-in:** `product-analytics` watches saved funnel insights, not raw event streams. On a fresh project with no saved funnels, it has nothing to watch. A custom scout watching raw domain events would provide immediate coverage
- **Outcome:** **Proposed, declined** — user selected "none" alongside the option. The scout was not created

Surfaces considered and ruled out:
- **Model latency/errors:** Covered by `ai-observability` once `$ai_*` events are instrumented
- **Leaderboard integrity:** Not a PostHog event surface
- **Arcjet rate-limit hits:** No specific events instrumented yet
- **Thread engagement depth:** Feature not built yet

**Noise escape hatch:** If any future custom scout turns noisy, set `emit: false` on its config in PostHog to switch it to dry-run.

---

## Replay Vision Scanners

Replay Vision scanners are LLMs that watch individual session recordings on a schedule and push what they find directly into the Self-driving inbox. Findings arrive at half weight — they need corroboration before being promoted into a full inbox report. The sizing skill (`creating-replay-vision-scanners`) was not available on this deploy, so credit spend was not verified; these skeletons are deliberately scoped small and can't meaningfully exhaust quota at these defaults.

No recordings exist yet — the scanners are armed and start working the day recordings begin (Session Replay needs to be enabled first; see Products and Follow-ups).

| Scanner | Watches | Query scope | Sampling rate | Status |
|---|---|---|---|---|
| **Broken experiences** | Product visibly breaking — error messages, blank screens, broken layouts, spinners that never resolve, buttons that do nothing | Sessions on `$current_url` `icontains` `/` (the arena page, where all prompts, answers, and votes happen) | 0.5 | **Created** (id: `019ffaaf-f20f-7bc1-8718-ab24b1bbcec2`) |
| **User frustration** | Users getting stuck — rage-clicks, repeated retries, abandoning flows | Sessions containing a `$rageclick` event (no URL filter, keeping it fully disjoint from Scanner 1) | 1.0 | **Created** (id: `019ffab0-13dd-7319-bb86-4a0e3489ca9e`) |

**Why `/` for Broken experiences:** The arena screen lives at the root path (`app/page.tsx`) and all of the product's key actions — prompt submission, model answer streaming, and voting — happen there. This is where a silent defect costs the business the most, so that is where the scan budget goes.

**Note on spend:** Credit spend was not verified (sizing skill unavailable). At `sampling_rate: 0.5` and `1.0` on a currently-empty recording set, projected spend is 0 credits/month. Each observation costs 15 credits; re-check once recordings are flowing.

---

## Follow-ups

- [ ] **Verify GitHub integration** — Check [Integrations settings](https://us.posthog.com/project/549399/settings/environment-integrations); if missing, re-run install at `https://us.posthog.com/api/environments/549399/integrations/authorize?kind=github`
- [ ] **Enable Session Replay** — Settings → Session Replay → "Record user sessions"
- [ ] **Confirm Error Tracking** — Settings → Error Tracking → verify "Enable exception autocapture" is ON (init already has `capture_exceptions: true`)
- [ ] **Enable Support (Conversations)** — Turn on Conversations in the PostHog product sidebar
- [ ] **Connect a Support inbound channel** — Email, inbox, or Slack in PostHog Conversations so tickets reach the inbox
- [ ] **Connect GitHub Issues** — Once GitHub App is confirmed, add source at [new source](https://us.posthog.com/project/549399/pipeline/new/source)
- [ ] **Connect Linear** — `https://us.posthog.com/api/environments/549399/integrations/authorize?kind=linear`
- [ ] **Connect Jira** — [https://us.posthog.com/project/549399/data-warehouse/connect?kind=Jira](https://us.posthog.com/project/549399/data-warehouse/connect?kind=Jira)
- [ ] **Connect Sentry** — [https://us.posthog.com/project/549399/data-warehouse/connect?kind=Sentry](https://us.posthog.com/project/549399/data-warehouse/connect?kind=Sentry)
- [ ] **Connect Zendesk** — [https://us.posthog.com/project/549399/data-warehouse/connect?kind=Zendesk](https://us.posthog.com/project/549399/data-warehouse/connect?kind=Zendesk)
- [ ] **Instrument LLM analytics** — Wrap OpenRouter model calls with PostHog `$ai_*` events (the `ai-observability` scout and LLM analytics product need this)
- [ ] **Instrument product funnel events** — Capture `prompt_sent`, `model_answered`, `vote_cast` (and model errors) as PostHog events per scope.md; these feed `product-analytics` and the arena funnel
- [ ] **Enable feature flags scout** — `signals-scout-feature-flags` in PostHog when feature flags are added
- [ ] **Enable experiments scout** — `signals-scout-experiments` when A/B experiments start
- [ ] **Custom arena funnel scout** — Revisit adding `signals-scout-arena-funnel` once funnel events are instrumented (proposal declined this run)

---

## What Happens Next

The scout coordinator picks up fresh configs within ~30 minutes. Scout runs draw from the project's daily budget (100 runs/day during early access). Findings cluster into reports in the inbox; immediately actionable ones can start coding tasks. Visit the inbox: [https://us.posthog.com/project/549399/inbox](https://us.posthog.com/project/549399/inbox)
