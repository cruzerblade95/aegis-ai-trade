import type {
  LearningJournalEntry,
  LearningJournalTimeframe,
} from "../../db/learning-journal";
import { learningJournalTimeframes } from "../../db/learning-journal";
import type { LearningMarketSymbol } from "../../db/market-watchlist";
import { supportedLearningMarkets } from "../../db/market-watchlist";
import {
  addLearningJournalEntry,
  editLearningJournalEntry,
  removeLearningJournalEntry,
} from "../market/actions";

type LearningJournalPanelProps = {
  entries: LearningJournalEntry[];
  selectedMarket: LearningMarketSymbol;
};

const timeframeLabels: Record<
  LearningJournalTimeframe,
  string
> = {
  "1min": "1 minute",
  "5min": "5 minutes",
  "1h": "1 hour",
  "1day": "1 day",
};

function JournalFields({
  entry,
  selectedMarket,
}: {
  entry?: LearningJournalEntry;
  selectedMarket: LearningMarketSymbol;
}) {
  return (
    <>
      <div className="journal-field-row">
        <label>
          Market
          <select
            defaultValue={entry?.marketSymbol ?? selectedMarket}
            name="marketSymbol"
          >
            {supportedLearningMarkets.map((market) => (
              <option key={market.symbol} value={market.symbol}>
                {market.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Timeframe
          <select
            defaultValue={entry?.timeframe ?? "5min"}
            name="timeframe"
          >
            {learningJournalTimeframes.map((timeframe) => (
              <option key={timeframe} value={timeframe}>
                {timeframeLabels[timeframe]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>
        Study title
        <input
          defaultValue={entry?.title}
          maxLength={100}
          name="title"
          placeholder="Example: Support level review"
          required
        />
      </label>

      <label>
        What did you observe?
        <textarea
          defaultValue={entry?.observation}
          maxLength={2000}
          name="observation"
          placeholder="Describe only what is visible in the chart."
          required
          rows={3}
        />
      </label>

      <label>
        Risk and uncertainty
        <textarea
          defaultValue={entry?.riskNotes}
          maxLength={2000}
          name="riskNotes"
          placeholder="What could make this interpretation incorrect?"
          required
          rows={3}
        />
      </label>

      <label>
        Later reflection (optional)
        <textarea
          defaultValue={entry?.reflection ?? ""}
          maxLength={2000}
          name="reflection"
          placeholder="Record what you learned after reviewing it later."
          rows={2}
        />
      </label>
    </>
  );
}

export function LearningJournalPanel({
  entries,
  selectedMarket,
}: LearningJournalPanelProps) {
  return (
    <section className="learning-journal-panel">
      <div className="learning-journal-heading">
        <div>
          <p className="eyebrow">PERSISTENT LEARNING JOURNAL</p>
          <h2>Record evidence, risk, and reflection</h2>
          <p>
            Save observations for later review. Entries are private
            educational notes and never submit or recommend an order.
          </p>
        </div>

        <span>{entries.length} saved</span>
      </div>

      <div className="learning-journal-grid">
        <form
          action={addLearningJournalEntry}
          className="journal-entry-form"
        >
          <h3>New observation</h3>
          <JournalFields selectedMarket={selectedMarket} />
          <button className="button secondary" type="submit">
            Save journal entry
          </button>
        </form>

        <div className="journal-entry-history">
          <div>
            <h3>Review history</h3>
            <span>Newest first</span>
          </div>

          {entries.length > 0 ? (
            <ul>
              {entries.map((entry) => {
                const market = supportedLearningMarkets.find(
                  (item) => item.symbol === entry.marketSymbol,
                );

                return (
                  <li key={entry.id}>
                    <article>
                      <div className="journal-entry-meta">
                        <span>
                          {market?.label ?? entry.marketSymbol}
                        </span>
                        <span>
                          {timeframeLabels[entry.timeframe]}
                        </span>
                        <time
                          dateTime={new Date(
                            entry.createdAt,
                          ).toISOString()}
                        >
                          {new Date(entry.createdAt).toLocaleDateString(
                            "en-MY",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            },
                          )}
                        </time>
                      </div>

                      <h4>{entry.title}</h4>
                      <p>{entry.observation}</p>

                      <dl>
                        <div>
                          <dt>Risk</dt>
                          <dd>{entry.riskNotes}</dd>
                        </div>

                        {entry.reflection && (
                          <div>
                            <dt>Reflection</dt>
                            <dd>{entry.reflection}</dd>
                          </div>
                        )}
                      </dl>

                      <div className="journal-entry-actions">
                        <details>
                          <summary>Edit</summary>

                          <form action={editLearningJournalEntry}>
                            <input
                              name="entryId"
                              type="hidden"
                              value={entry.id}
                            />
                            <JournalFields
                              entry={entry}
                              selectedMarket={selectedMarket}
                            />
                            <button type="submit">Save changes</button>
                          </form>
                        </details>

                        <form action={removeLearningJournalEntry}>
                          <input
                            name="entryId"
                            type="hidden"
                            value={entry.id}
                          />
                          <button className="danger" type="submit">
                            Delete
                          </button>
                        </form>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="journal-empty">
              No saved observations yet. Use the guided form to record
              what you notice and what could challenge it.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
