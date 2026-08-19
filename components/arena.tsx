"use client";

import { useCallback, useState } from "react";
import { ModelPicker } from "@/components/model-picker";
import { ReceiptFooter } from "@/components/receipt-footer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { CatalogModel } from "@/lib/model-catalog";
import type { FreeModelId } from "@/lib/models";
import { parseSseStream } from "@/lib/sse-client";

const MAX_SELECTED = 3;
const MIN_ANSWERED_TO_VOTE = 2;

type AnswerStatus = "STREAMING" | "COMPLETE" | "ERROR";

type AnswerState = {
  id: string;
  model: FreeModelId;
  modelName: string;
  status: AnswerStatus;
  content: string;
  ttft: number | null;
  tokensPerSecond: number | null;
  outputTokens: number | null;
};

type TurnState = {
  id: string;
  prompt: string;
  answers: AnswerState[];
  voteAnswerId: string | null;
  votePending: boolean;
};

type ArenaProps = {
  catalog: CatalogModel[];
};

const humanNumber = (value: number | null, digits = 0) =>
  value === null ? "—" : value.toFixed(digits);

export function Arena({ catalog }: ArenaProps) {
  const [selectedIds, setSelectedIds] = useState<FreeModelId[]>(() =>
    catalog.slice(0, MAX_SELECTED).map((model) => model.id),
  );
  const [prompt, setPrompt] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [turns, setTurns] = useState<TurnState[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const modelName = useCallback(
    (id: string) => catalog.find((model) => model.id === id)?.name ?? id,
    [catalog],
  );

  const updateAnswer = useCallback(
    (turnId: string, answerId: string, patch: Partial<AnswerState>) => {
      setTurns((current) =>
        current.map((turn) =>
          turn.id !== turnId
            ? turn
            : {
                ...turn,
                answers: turn.answers.map((answer) =>
                  answer.id !== answerId ? answer : { ...answer, ...patch },
                ),
              },
        ),
      );
    },
    [],
  );

  const streamAnswer = useCallback(
    async (turnId: string, answerId: string) => {
      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ turnId, answerId }),
        });

        if (!response.ok) {
          updateAnswer(turnId, answerId, { status: "ERROR" });
          return;
        }

        for await (const message of parseSseStream(response)) {
          if (message.event === "chunk") {
            const { text } = message.data as { text: string };
            setTurns((current) =>
              current.map((turn) =>
                turn.id !== turnId
                  ? turn
                  : {
                      ...turn,
                      answers: turn.answers.map((answer) =>
                        answer.id !== answerId
                          ? answer
                          : { ...answer, content: answer.content + text },
                      ),
                    },
              ),
            );
          } else if (message.event === "done") {
            const data = message.data as {
              outputTokens: number;
              ttft: number | null;
              tokensPerSecond: number;
            };
            updateAnswer(turnId, answerId, {
              status: "COMPLETE",
              ttft: data.ttft,
              tokensPerSecond: data.tokensPerSecond,
              outputTokens: data.outputTokens,
            });
          } else if (message.event === "error") {
            updateAnswer(turnId, answerId, { status: "ERROR" });
          }
        }
      } catch {
        updateAnswer(turnId, answerId, { status: "ERROR" });
      }
    },
    [updateAnswer],
  );

  const submit = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || selectedIds.length === 0 || submitting) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/turns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmedPrompt,
          models: selectedIds,
          threadId: threadId ?? undefined,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setSubmitError(
          body?.error ?? "That prompt couldn't be sent. Try again.",
        );
        return;
      }

      const data: {
        threadId: string;
        turnId: string;
        answers: { id: string; model: FreeModelId }[];
      } = await response.json();

      setThreadId(data.threadId);
      setPrompt("");
      setTurns((current) => [
        ...current,
        {
          id: data.turnId,
          prompt: trimmedPrompt,
          answers: data.answers.map((answer) => ({
            id: answer.id,
            model: answer.model,
            modelName: modelName(answer.model),
            status: "STREAMING",
            content: "",
            ttft: null,
            tokensPerSecond: null,
            outputTokens: null,
          })),
          voteAnswerId: null,
          votePending: false,
        },
      ]);

      data.answers.forEach((answer) => {
        void streamAnswer(data.turnId, answer.id);
      });
    } catch {
      setSubmitError("That prompt couldn't be sent. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const vote = async (turnId: string, answerId: string) => {
    setTurns((current) =>
      current.map((turn) =>
        turn.id === turnId ? { ...turn, votePending: true } : turn,
      ),
    );

    try {
      const response = await fetch(`/api/turns/${turnId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerId }),
      });

      setTurns((current) =>
        current.map((turn) =>
          turn.id !== turnId
            ? turn
            : {
                ...turn,
                votePending: false,
                voteAnswerId: response.ok ? answerId : turn.voteAnswerId,
              },
        ),
      );
    } catch {
      setTurns((current) =>
        current.map((turn) =>
          turn.id === turnId ? { ...turn, votePending: false } : turn,
        ),
      );
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8">
      {turns.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <h2 className="font-display text-2xl font-medium">
            Ask three models at once
          </h2>
          <p className="max-w-prose text-muted-foreground">
            Pick up to three models, send one prompt, and watch them answer side
            by side.
          </p>
        </div>
      ) : null}

      {turns.map((turn) => (
        <TurnPanel key={turn.id} turn={turn} onVote={vote} />
      ))}

      <div className="sticky bottom-4 flex flex-col gap-3 rounded-md border border-border bg-card p-4 shadow-sm">
        <ModelPicker
          catalog={catalog}
          selectedIds={selectedIds}
          onChange={setSelectedIds}
        />
        <Textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder="Ask something…"
          rows={3}
          className="resize-none"
        />
        {submitError ? (
          <p className="text-sm text-destructive">{submitError}</p>
        ) : null}
        <Button
          onClick={() => void submit()}
          disabled={submitting || !prompt.trim() || selectedIds.length === 0}
          className="self-end"
        >
          {submitting ? "Sending…" : "Ask the arena"}
        </Button>
      </div>
    </div>
  );
}

type TurnPanelProps = {
  turn: TurnState;
  onVote: (turnId: string, answerId: string) => void;
};

function TurnPanel({ turn, onVote }: TurnPanelProps) {
  const completedCount = turn.answers.filter(
    (answer) => answer.status === "COMPLETE",
  ).length;
  const canVote = completedCount >= MIN_ANSWERED_TO_VOTE && !turn.voteAnswerId;

  return (
    <div className="flex flex-col gap-3">
      <p className="font-display text-lg font-medium">{turn.prompt}</p>
      <div className="grid gap-4 md:grid-cols-3">
        {turn.answers.map((answer) => (
          <AnswerPanel
            key={answer.id}
            answer={answer}
            isWinner={turn.voteAnswerId === answer.id}
            canVote={canVote}
            votePending={turn.votePending}
            onVote={() => onVote(turn.id, answer.id)}
          />
        ))}
      </div>
    </div>
  );
}

type AnswerPanelProps = {
  answer: AnswerState;
  isWinner: boolean;
  canVote: boolean;
  votePending: boolean;
  onVote: () => void;
};

function AnswerPanel({
  answer,
  isWinner,
  canVote,
  votePending,
  onVote,
}: AnswerPanelProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-md border bg-card p-4",
        isWinner ? "border-success" : "border-border",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="truncate font-display text-sm font-medium">
          {answer.modelName}
        </h3>
        {isWinner ? (
          <span className="shrink-0 rounded-full bg-success px-2 py-0.5 text-xs font-medium text-success-foreground">
            Winner
          </span>
        ) : null}
      </div>

      <div className="min-h-24 flex-1 text-sm whitespace-pre-wrap">
        {answer.status === "ERROR" ? (
          <p className="text-destructive">
            This model didn&apos;t respond. Try again.
          </p>
        ) : (
          <>
            {answer.content}
            {answer.status === "STREAMING" ? (
              <span
                aria-hidden="true"
                className="ml-0.5 inline-block animate-pulse"
              >
                ▍
              </span>
            ) : null}
          </>
        )}
      </div>

      {answer.status === "COMPLETE" ? (
        <>
          <ReceiptFooter
            rows={[
              { label: "ttft", value: `${humanNumber(answer.ttft)}ms` },
              {
                label: "tokens/s",
                value: humanNumber(answer.tokensPerSecond, 1),
              },
              { label: "tokens", value: humanNumber(answer.outputTokens) },
              { label: "cost", value: "$0.0000" },
            ]}
          />
          {canVote ? (
            <Button
              variant="outline"
              size="sm"
              disabled={votePending}
              onClick={onVote}
            >
              Vote this answer
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
