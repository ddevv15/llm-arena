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
 * Two client-only statuses, both here because the database's three can't say
 * what the screen needs to say.
 *
 * `UNFINISHED` exists because `STREAMING` means two different things. Live, it
 * means a model is typing right now. Loaded from a past thread, it means
 * feature #6's known gap happened — the tab closed mid-answer and that row was
 * never settled. Rendering a blinking cursor for the second one would be a lie.
 *
 * `PENDING` is the same argument at the other end. Between pressing enter and
 * `/api/turns` answering, the turn is on screen — that's feature #11's
 * optimistic render — but no model has been asked yet, because the row it
 * would be asked about doesn't exist. A cursor there would claim a model is
 * typing during the ~1.8s it is provably not.
 */
export type ArenaAnswerStatus =
  StoredAnswer["status"] | "UNFINISHED" | "PENDING";

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

const blankAnswer = (
  id: string,
  model: string,
  status: ArenaAnswerStatus,
): ArenaAnswer => ({
  id,
  model,
  status,
  content: "",
  ttft: null,
  tokensPerSecond: null,
  outputTokens: null,
});

/**
 * The turn as it appears the instant enter is pressed, before the server has
 * agreed it exists.
 *
 * It carries the real prompt and the real models, so when `/api/turns` returns
 * ~1.8s later the only thing that changes is the ids — the columns don't
 * reshuffle and nothing on screen moves. The id is thrown away at that point;
 * it exists to find this turn again, whether to replace it or to remove it.
 */
const optimisticTurn = (
  id: string,
  prompt: string,
  models: readonly FreeModelId[],
): ArenaTurn => ({
  id,
  prompt,
  voteAnswerId: null,
  votePending: false,
  answers: models.map((model) =>
    blankAnswer(`${id}:${model}`, model, "PENDING"),
  ),
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

      const placeholderId = `optimistic:${crypto.randomUUID()}`;

      setSubmitting(true);
      setSubmitError(null);

      // Both of these used to happen after the fetch resolved, and that one
      // detail is what made a ~1.8s wait read as a broken app rather than a
      // slow one: the sent text sat in the box the whole time, so pressing
      // enter looked like a dropped keypress. The Arcjet screen on the other
      // end is a real 1.6s and is staying (feature #10), so the wait is not
      // going away — what goes away is the screen lying about it.
      setPrompt("");
      setTurns((current) => [
        ...current,
        optimisticTurn(placeholderId, trimmedPrompt, models),
      ]);

      /** Put the screen back the way it was, for every path that fails. */
      const rollBack = () => {
        setTurns((current) =>
          current.filter((turn) => turn.id !== placeholderId),
        );
        // Give the prompt back rather than losing someone's typing to a 503 —
        // which the Phase 0 baseline measured at roughly one cold start in
        // three. Only into a box they haven't since typed into themselves,
        // though: clobbering a half-written second prompt would be a worse
        // bug than the one this is fixing.
        setPrompt((current) => (current.length > 0 ? current : trimmedPrompt));
      };

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
          rollBack();
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

        // Replaced in place, not appended: the turn is already on screen and
        // in the right position, and all that actually changes here is that
        // its ids are now the database's rather than this client's.
        setTurns((current) =>
          current.map((turn) =>
            turn.id !== placeholderId
              ? turn
              : {
                  ...turn,
                  id: data.turnId,
                  answers: data.answers.map((answer) =>
                    blankAnswer(answer.id, answer.model, "STREAMING"),
                  ),
                },
          ),
        );

        data.answers.forEach((answer) => {
          void streamAnswer(data.turnId, answer.id);
        });
      } catch {
        rollBack();
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
