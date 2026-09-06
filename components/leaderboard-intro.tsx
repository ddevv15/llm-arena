/**
 * The copy at the top of `/leaderboard` that doesn't depend on a single vote.
 *
 * Shared with the route's `loading.tsx` on purpose. None of this is waiting on
 * the database, so greying it out while the counts are read would be inventing
 * uncertainty — the reader can start on the sentence that explains the page
 * while the rows are still coming. It also means the two can't drift into
 * saying slightly different things.
 *
 * The wordmark and the page title used to live here too. Feature #12 put the
 * page under the app shell, which carries both — the sidebar has the wordmark,
 * `PageBar` has the title — so keeping them would have printed each twice.
 */
export function LeaderboardIntro() {
  return (
    <div className="flex flex-col gap-2">
      <p className="max-w-prose text-muted-foreground">
        Which model wins when someone picks between real answers to the same
        prompt. A model is only counted in rounds it actually answered and
        someone voted on.
      </p>
      <p className="max-w-prose text-sm text-muted-foreground">
        Speed and time-to-first-token aren&apos;t here yet. Both are currently
        measured in a way that misreports models which reason before answering,
        and a wrong number averaged across models would be worse than no number.
      </p>
    </div>
  );
}
