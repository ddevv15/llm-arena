import { aj } from "@/lib/arcjet";

/**
 * Measurement for open-issues.md #5. Throwaway; deleted after use.
 *
 * Two competing explanations for `Unable to detect prompt injection`:
 *   (a) idle-driven — the first call after a gap fails
 *   (b) stochastic  — roughly one call in ten fails, gap irrelevant
 *
 * Phase A is the discriminator and is cheap: fifteen calls back to back with
 * no idle at all. Under (b) that should show failures; under (a) it should
 * show none. Phase B then puts real gaps in to test (a) directly.
 *
 * The very first call of the process is discarded — that one is already known
 * to fail and would bias both phases.
 */

const wait = (s: number) => new Promise((r) => setTimeout(r, s * 1000));

const makeRequest = () =>
  new Request("http://localhost:3000/api/turns", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    },
  });

type Row = {
  phase: string;
  n: number;
  gapSeconds: number;
  ms: number;
  errored: boolean;
  conclusion: string;
  note: string;
};

const rows: Row[] = [];
let lastCallEndedAt = Date.now();

async function call(phase: string, n: number, gapSeconds: number) {
  const started = Date.now();
  const decision = await aj.protect(makeRequest(), {
    userId: "issue-5-measurement",
    requested: 1,
    detectPromptInjectionMessage: `Measurement ${phase}${n}: what is five times five?`,
  });
  const ms = Date.now() - started;
  lastCallEndedAt = Date.now();

  const errored = decision.isErrored();
  const promptRule = decision.results.find(
    (r) => r.reason.type === "PROMPT_INJECTION_DETECTION",
  );

  rows.push({
    phase,
    n,
    gapSeconds,
    ms,
    errored,
    conclusion: decision.conclusion,
    note: errored
      ? decision.reason.message.slice(0, 60)
      : promptRule
        ? "prompt rule ran"
        : "prompt rule ABSENT",
  });
}

async function main() {
  console.log("discarding the known-bad first call of the process...");
  await call("warmup", 0, 0);
  rows.length = 0;

  console.log("\nPHASE A — 15 calls back to back, no idle");
  for (let i = 0; i < 15; i += 1) {
    const gap = (Date.now() - lastCallEndedAt) / 1000;
    await call("A", i, +gap.toFixed(1));
  }

  console.log("PHASE B — 6 calls, 90s idle before each");
  for (let i = 0; i < 6; i += 1) {
    await wait(90);
    const gap = (Date.now() - lastCallEndedAt) / 1000;
    await call("B", i, +gap.toFixed(1));
  }

  console.log("\nphase  n   gap(s)   ms   conclusion  note");
  for (const r of rows) {
    console.log(
      `${r.phase.padEnd(5)} ${String(r.n).padStart(2)}  ${String(r.gapSeconds).padStart(6)}  ${String(r.ms).padStart(5)}  ${r.conclusion.padEnd(9)}  ${r.errored ? "FAILED: " : ""}${r.note}`,
    );
  }

  const a = rows.filter((r) => r.phase === "A");
  const b = rows.filter((r) => r.phase === "B");
  console.log(
    `\nPHASE A (no idle):  ${a.filter((r) => r.errored).length}/${a.length} failed`,
  );
  console.log(
    `PHASE B (90s idle): ${b.filter((r) => r.errored).length}/${b.length} failed`,
  );
  console.log(
    "\nA>0 => stochastic. A==0 and B>0 => idle-driven. both 0 => neither; the trigger is something else.",
  );
}

void main();
