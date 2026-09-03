"use client";

import { useCallback, useState } from "react";
import type { FreeModelId } from "@/lib/models";
import { parseSseStream } from "@/lib/sse-client";
import type { StoredAnswer, StoredTurn } from "@/lib/thread-view";

/**
 * The arena's whole state machine, lifted out of the component that renders
 * it.
 *
 * It lives here because two separate parts of the screen have to agree about
 * it: the answer panels, and the top bar's win record. Deriving both from one
 * `turns` array is the only way they can't drift — a second counter kept
 * alongside would be free to disagree the moment a vote failed.
 */

/**
 * `UNFINISHED` is client-only, and exists because the database can't tell the
 * difference between the two things `STREAMING` means. Live, it means a model
 * is typing right now. Loaded from a past thread, it means feature #6's known
 * gap happened — the tab closed mid-answer and that row was never settled.
 * Rendering a blinking cursor for the second one would be a lie.
 */
export type ArenaAnswerStatus = StoredAnswer["status"] | "UNFINISHED";

export type ArenaAnswer = Omit<StoredAnswer, "status"> & {
  readonly status: ArenaAnswerStatus;
};

export type ArenaTurn = Omit<StoredTurn, "answers"> & {
  readonly answers: readonly ArenaAnswer[];
  readonly votePending: boolean;
};

type TurnCreatedResponse = {
  threadId: string;
  threadTitle: string;
  turnId: string;
  answers: { id: string; model: FreeModelId }[];
};

type UseArenaOptions = {
  /** `null` on the new-thread page, until the first prompt creates one. */
  readonly threadId: string | null;
  readonly initialTurns: readonly StoredTurn[];
  readonly onThreadCreated: (thread: { id: string; title: string }) => void;
};

const pendingAnswer = (id: string, model: string): ArenaAnswer => ({
  id,
  model,
  status: "STREAMING",
  content: "",
  ttft: null,
  tokensPerSecond: null,
  outputTokens: null,
});

/** A stored turn as the client should first see it — see `UNFINISHED` above. */
const toArenaTurn = (turn: StoredTurn): ArenaTurn => ({
  ...turn,
  votePending: false,
  answers: turn.answers.map((answer) =>
    answer.status === "STREAMING"
      ? { ...answer, status: "UNFINISHED" as const }
      : answer,
  ),
});

export function useArena({
  threadId,
  initialTurns,
  onThreadCreated,
}: UseArenaOptions) {
  const [activeThreadId, setActiveThreadId] = useState(threadId);
  const [turns, setTurns] = useState<ArenaTurn[]>(() =>
    initialTurns.map(toArenaTurn),
  );
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const patchAnswer = useCallback(
    (turnId: string, answerId: string, patch: Partial<ArenaAnswer>) => {
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

  const appendChunk = useCallback(
    (turnId: string, answerId: string, text: string) => {
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
          patchAnswer(turnId, answerId, { status: "ERROR" });
          return;
        }

        for await (const message of parseSseStream(response)) {
          if (message.event === "chunk") {
            const { text } = message.data as { text: string };
            appendChunk(turnId, answerId, text);
          } else if (message.event === "done") {
            const data = message.data as {
              outputTokens: number;
              ttft: number | null;
              tokensPerSecond: number;
            };
            patchAnswer(turnId, answerId, {
              status: "COMPLETE",
              ttft: data.ttft,
              tokensPerSecond: data.tokensPerSecond,
              outputTokens: data.outputTokens,
            });
          } else if (message.event === "error") {
            patchAnswer(turnId, answerId, { status: "ERROR" });
          }
        }
      } catch {
        patchAnswer(turnId, answerId, { status: "ERROR" });
      }
    },
    [appendChunk, patchAnswer],
  );

  const submit = useCallback(
    async (models: readonly FreeModelId[]) => {
      const trimmedPrompt = prompt.trim();
      if (!trimmedPrompt || models.length === 0 || submitting) {
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
            models,
            threadId: activeThreadId ?? undefined,
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

        const data: TurnCreatedResponse = await response.json();

        if (!activeThreadId) {
          setActiveThreadId(data.threadId);
          onThreadCreated({ id: data.threadId, title: data.threadTitle });
        }

        setPrompt("");
        setTurns((current) => [
          ...current,
          {
            id: data.turnId,
            prompt: trimmedPrompt,
            answers: data.answers.map((answer) =>
              pendingAnswer(answer.id, answer.model),
            ),
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
    },
    [activeThreadId, onThreadCreated, prompt, streamAnswer, submitting],
  );

  const vote = useCallback(async (turnId: string, answerId: string) => {
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
  }, []);

  return {
    turns,
    prompt,
    setPrompt,
    submitting,
    submitError,
    submit,
    vote,
  } as const;
}

export type ArenaController = ReturnType<typeof useArena>;
