"use client";

import { useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignInButton } from "@clerk/nextjs";
import { ArrowUp } from "lucide-react";
import { ModelPicker } from "@/components/model-picker";
import { ReceiptFooter } from "@/components/receipt-footer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { CatalogModel } from "@/lib/model-catalog";
import type { FreeModelId } from "@/lib/models";
import type { ViewerRole } from "@/lib/thread-view";
import type { ArenaAnswer, ArenaController, ArenaTurn } from "./use-arena";

const MIN_ANSWERED_TO_VOTE = 2;

/**
 * Column count is the number of models asked, per the wireframe. Written as
 * whole class names rather than built from a template string, because Tailwind
 * only ships classes it can see in the source.
 *
 * Every width stacks to one column below `md` — three columns of prose on a
 * phone is three unreadable columns.
 */
const COLUMN_CLASS: Record<number, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
};

type ArenaProps = {
  catalog: CatalogModel[];
  arena: ArenaController;
  selectedIds: FreeModelId[];
  onSelectionChange: (ids: FreeModelId[]) => void;
  viewer: ViewerRole;
};

const humanNumber = (value: number | null, digits = 0) =>
  value === null ? "—" : value.toFixed(digits);

export function Arena({
  catalog,
  arena,
  selectedIds,
  onSelectionChange,
  viewer,
}: ArenaProps) {
  const { turns, prompt, setPrompt, submitting, submitError, submit, vote } =
    arena;

  const isOwner = viewer === "owner";

  const modelName = useCallback(
    (id: string) => catalog.find((model) => model.id === id)?.name ?? id,
    [catalog],
  );

  const send = () => void submit(selectedIds);

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col">
      <div className="flex flex-1 flex-col gap-10 px-4 py-8">
        {turns.length === 0 ? (
          <EmptyState isOwner={isOwner} />
        ) : (
          turns.map((turn) => (
            <TurnPanel
              key={turn.id}
              turn={turn}
              modelName={modelName}
              canVote={isOwner}
              onVote={vote}
            />
          ))
        )}
      </div>

      <div className="sticky bottom-0 bg-background px-4 pb-4">
        {isOwner ? (
          <Composer
            catalog={catalog}
            selectedIds={selectedIds}
            onSelectionChange={onSelectionChange}
            prompt={prompt}
            setPrompt={setPrompt}
            submitting={submitting}
            submitError={submitError}
            onSend={send}
          />
        ) : (
          <ReaderCallToAction viewer={viewer} />
        )}
      </div>
    </div>
  );
}

function EmptyState({ isOwner }: { isOwner: boolean }) {
  if (!isOwner) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        Nothing has been asked in this thread yet.
      </p>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
      <h2 className="font-display text-2xl font-medium">
        Ask three models at once
      </h2>
      <p className="max-w-prose text-muted-foreground">
        One prompt, up to three answers side by side, with the real numbers
        underneath each one.
      </p>
    </div>
  );
}

type TurnPanelProps = {
  turn: ArenaTurn;
  modelName: (id: string) => string;
  /** Whether this viewer may vote at all — the owner, and nobody else. */
  canVote: boolean;
  onVote: (turnId: string, answerId: string) => void;
};

function TurnPanel({ turn, modelName, canVote, onVote }: TurnPanelProps) {
  const completedCount = turn.answers.filter(
    (answer) => answer.status === "COMPLETE",
  ).length;
  // A reader sees the winner badge on a voted turn exactly as the owner does;
  // what they don't get is the control that would cast one.
  const showVote =
    canVote && completedCount >= MIN_ANSWERED_TO_VOTE && !turn.voteAnswerId;

  return (
    <div className="flex flex-col gap-4">
      {/* The prompt reads as something you said, so it sits on your side of
          the page. The answers are the page's real content and stay full
          width beneath it. */}
      <p className="ml-auto max-w-[75%] rounded-md rounded-br-none bg-secondary px-3 py-2 text-sm text-secondary-foreground">
        {turn.prompt}
      </p>

      {/* One ruled frame, not three floating cards: these are columns of the
          same ledger page, and the hairlines between them say so. */}
      <div className="overflow-hidden rounded-md border border-border bg-card">
        <div
          className={cn(
            "grid grid-cols-1 divide-y divide-border md:divide-x md:divide-y-0",
            COLUMN_CLASS[turn.answers.length] ?? "md:grid-cols-3",
          )}
        >
          {turn.answers.map((answer) => (
            <AnswerColumn
              key={answer.id}
              answer={answer}
              modelName={modelName(answer.model)}
              isWinner={turn.voteAnswerId === answer.id}
              canVote={showVote}
              votePending={turn.votePending}
              onVote={() => onVote(turn.id, answer.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

type AnswerColumnProps = {
  answer: ArenaAnswer;
  modelName: string;
  isWinner: boolean;
  canVote: boolean;
  votePending: boolean;
  onVote: () => void;
};

function AnswerColumn({
  answer,
  modelName,
  isWinner,
  canVote,
  votePending,
  onVote,
}: AnswerColumnProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col",
        isWinner && "bg-success/10 ring-1 ring-success ring-inset",
      )}
    >
      <div className="flex items-center gap-2 px-3 pt-3">
        <span
          aria-hidden="true"
          className="grid size-5 shrink-0 place-items-center rounded-full bg-secondary font-mono text-[10px] text-secondary-foreground"
        >
          {modelName.trim().charAt(0).toUpperCase()}
        </span>
        <h3 className="min-w-0 flex-1 truncate font-display text-sm font-medium">
          {modelName}
        </h3>

        {/* One slot, two states: the control that picks a winner, and the mark
            that says one was picked. */}
        {isWinner ? (
          <span className="shrink-0 rounded-full bg-success px-2 py-0.5 font-mono text-[10px] tracking-wide text-success-foreground uppercase">
            Winner
          </span>
        ) : canVote ? (
          <Button
            variant="outline"
            size="sm"
            className="h-6 shrink-0 px-2 text-xs"
            disabled={votePending}
            onClick={onVote}
          >
            Pick<span className="sr-only"> {modelName} as the winner</span>
          </Button>
        ) : null}
      </div>

      <div className="min-h-32 flex-1 px-3 py-3 text-sm whitespace-pre-wrap">
        {answer.status === "ERROR" ? (
          <p className="text-destructive">
            This model didn&apos;t respond. Try again.
          </p>
        ) : answer.status === "UNFINISHED" ? (
          <p className="text-muted-foreground">
            This model didn&apos;t finish answering.
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
        <ReceiptFooter
          headline={{
            label: "tokens/s",
            value: humanNumber(answer.tokensPerSecond, 1),
          }}
          rows={[
            { label: "ttft", value: `${humanNumber(answer.ttft)}ms` },
            { label: "tokens", value: humanNumber(answer.outputTokens) },
            { label: "cost", value: "$0.0000" },
          ]}
        />
      ) : (
        // Keeps the ledger's footing rule running across every column, even
        // the ones with no numbers to print yet.
        <div className="border-t border-dashed border-border" />
      )}
    </div>
  );
}

type ComposerProps = {
  catalog: CatalogModel[];
  selectedIds: FreeModelId[];
  onSelectionChange: (ids: FreeModelId[]) => void;
  prompt: string;
  setPrompt: (value: string) => void;
  submitting: boolean;
  submitError: string | null;
  onSend: () => void;
};

function Composer({
  catalog,
  selectedIds,
  onSelectionChange,
  prompt,
  setPrompt,
  submitting,
  submitError,
  onSend,
}: ComposerProps) {
  const canSend =
    !submitting && prompt.trim().length > 0 && selectedIds.length > 0;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-2">
      <Textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSend();
          }
        }}
        placeholder="Ask anything. Enter to send, shift + enter for a new line"
        rows={2}
        aria-label="Prompt"
        className="resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
      />

      {submitError ? (
        <p role="alert" className="px-2 text-sm text-destructive">
          {submitError}
        </p>
      ) : null}

      <div className="flex items-end justify-between gap-2">
        <ModelPicker
          catalog={catalog}
          selectedIds={selectedIds}
          onChange={onSelectionChange}
        />
        <Button
          size="icon"
          className="size-9 shrink-0"
          onClick={onSend}
          disabled={!canSend}
          aria-label={submitting ? "Sending prompt" : "Send prompt"}
        >
          <ArrowUp className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * What sits where the composer would be, for someone reading a thread they
 * don't own.
 *
 * Not a disabled composer: a greyed-out text box implies the thing might
 * become usable, and it never will here. The way to use the arena is to start
 * a thread of your own, so that's what this offers.
 */
function ReaderCallToAction({ viewer }: { viewer: ViewerRole }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border p-5 text-center">
      <p className="text-sm text-muted-foreground">
        You&apos;re reading a shared thread. Run the same prompt against your
        own three models.
      </p>
      {viewer === "anonymous" ? (
        <SignInButton forceRedirectUrl={pathname}>
          <Button>Sign in to run your own arena</Button>
        </SignInButton>
      ) : (
        <Button asChild>
          <Link href="/">Start a thread of your own</Link>
        </Button>
      )}
    </div>
  );
}
