import { requireUser } from "../auth/session";
import { ProtectedLayout } from "../components/protected-layout";
import { MarketWorkspace } from "../components/market-workspace";
import { LessonCompletionForm } from "../components/lesson-completion-form";
import { MarketWatchlistPanel } from "../components/market-watchlist-panel";
import { LearningJournalPanel } from "../components/learning-journal-panel";
import { getLearningProgress } from "../../db/learning-progress";
import { getLearningJournalEntries } from "../../db/learning-journal";
import {
  getMarketLearningPreferences,
  isLearningMarketSymbol,
} from "../../db/market-watchlist";

export const dynamic = "force-dynamic";

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string }>;
}) {
  const user = await requireUser("/market");
  const params = await searchParams;
  const selectedMarket =
    typeof params.symbol === "string" &&
    isLearningMarketSymbol(params.symbol)
      ? params.symbol
      : "BTCUSD";
  const [lessons, marketPreferences, journalEntries] = await Promise.all([
    getLearningProgress(user.id),
    getMarketLearningPreferences(user.id),
    getLearningJournalEntries(user.id),
  ]);

  const marketLesson = lessons.find(
    (lesson) => lesson.slug === "market-basics",
  );

  return (
    <ProtectedLayout user={user}>
      <section className="market-content">
        <header className="market-heading">
          <div>
            <p className="eyebrow">LIVE MARKET LAB</p>

            <h1>Study real market movement.</h1>

            <p>
              Review provider-sourced reference candles for Bitcoin,
              Ethereum, Solana, and gold. The workspace is read-only
              and cannot execute trades.
            </p>
          </div>

          <span className="simulation-badge">
            Read-only learning
          </span>
        </header>

        <aside className="market-warning">
          <strong>Market-data notice</strong>

          <p>
            Prices may be delayed or temporarily unavailable. This
            educational workspace does not provide financial advice,
            brokerage access, deposits, withdrawals, or order
            execution.
          </p>
        </aside>

        <MarketWatchlistPanel
          alerts={marketPreferences.alerts}
          selectedMarket={selectedMarket}
          watchlist={marketPreferences.watchlist}
        />

        <MarketWorkspace initialSelectedKey={selectedMarket} />

        <LearningJournalPanel
          entries={journalEntries}
          selectedMarket={selectedMarket}
        />

        {marketLesson && (
        <section className="inline-lesson-panel">
            <div>
            <p className="eyebrow">LESSON PROGRESS</p>
            <h2>Fictional market basics</h2>

            <p>
                After reviewing the fictional market examples, record
                your completion for this educational lesson.
            </p>
            </div>

            <div className="inline-lesson-action">
            <span
                className={
                marketLesson.completed
                    ? "inline-lesson-status inline-lesson-status-completed"
                    : "inline-lesson-status"
                }
            >
                {marketLesson.completed
                ? "Completed"
                : "Not completed"}
            </span>

            <LessonCompletionForm
                completed={marketLesson.completed}
                lessonSlug={marketLesson.slug}
            />
            </div>
        </section>
        )}

        <section className="market-next-lesson">
          <div>
            <p className="eyebrow">NEXT LESSON</p>
            <h2>Risk before returns</h2>

            <p>
              The Risk Lab explains position sizing,
              diversification, and maximum simulated loss using
              educational examples.
            </p>
          </div>

          <span>Available now</span>
        </section>
      </section>
    </ProtectedLayout>
  );
}
