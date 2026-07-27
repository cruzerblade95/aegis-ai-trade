import type {
  EducationalAlert,
  LearningMarketSymbol,
} from "../../db/market-watchlist";
import { supportedLearningMarkets } from "../../db/market-watchlist";
import {
  addEducationalAlert,
  removeEducationalAlert,
  updateEducationalAlert,
  updateWatchlist,
} from "../market/actions";

type MarketWatchlistPanelProps = {
  alerts: EducationalAlert[];
  selectedMarket: LearningMarketSymbol;
  watchlist: LearningMarketSymbol[];
};

export function MarketWatchlistPanel({
  alerts,
  selectedMarket,
  watchlist,
}: MarketWatchlistPanelProps) {
  return (
    <section className="watchlist-panel">
      <div className="watchlist-heading">
        <div>
          <p className="eyebrow">PERSONAL MARKET STUDY</p>
          <h2>Watchlist and learning alerts</h2>
          <p>
            Save the markets you study and create reference-price
            reminders. Alerts are educational records only and never
            place an order.
          </p>
        </div>

        <span>{watchlist.length} watched</span>
      </div>

      <div className="watchlist-grid">
        <div className="watchlist-markets">
          <h3>Markets</h3>

          <ul>
            {supportedLearningMarkets.map((market) => {
              const isWatched = watchlist.includes(market.symbol);

              return (
                <li key={market.symbol}>
                  <div>
                    <b>{market.label}</b>
                    <small>
                      {market.name}
                      {"providerDependent" in market
                        ? " · provider dependent"
                        : ""}
                    </small>
                  </div>

                  <div className="watchlist-market-actions">
                    <a
                      aria-current={
                        selectedMarket === market.symbol
                          ? "page"
                          : undefined
                      }
                      href={`/market?symbol=${market.symbol}`}
                    >
                      {selectedMarket === market.symbol
                        ? "Viewing"
                        : "View chart"}
                    </a>

                    <form action={updateWatchlist}>
                      <input
                        name="marketSymbol"
                        type="hidden"
                        value={market.symbol}
                      />
                      <input
                        name="shouldWatch"
                        type="hidden"
                        value={isWatched ? "false" : "true"}
                      />
                      <button type="submit">
                        {isWatched ? "Remove" : "Watch"}
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="alert-builder">
          <h3>Create a learning alert</h3>

          <form action={addEducationalAlert}>
            <label>
              Market
              <select
                defaultValue={selectedMarket}
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
              Reminder
              <select defaultValue="above" name="direction">
                <option value="above">Moves above</option>
                <option value="below">Moves below</option>
              </select>
            </label>

            <label>
              Reference value (USD)
              <input
                inputMode="decimal"
                max="1000000000"
                min="0.00000001"
                name="threshold"
                placeholder="Example: 100000"
                required
                step="any"
                type="number"
              />
            </label>

            <button className="button secondary" type="submit">
              Save educational alert
            </button>
          </form>

          <small>
            Saved thresholds are reviewed inside Aegis. Browser, email,
            and push notifications are not enabled in this release.
          </small>
        </div>
      </div>

      <div className="alert-list">
        <div>
          <h3>Saved alerts</h3>
          <span>{alerts.length} total</span>
        </div>

        {alerts.length > 0 ? (
          <ul>
            {alerts.map((alert) => {
              const market = supportedLearningMarkets.find(
                (item) => item.symbol === alert.marketSymbol,
              );

              return (
                <li key={alert.id}>
                  <div>
                    <b>{market?.label ?? alert.marketSymbol}</b>
                    <span>
                      Moves {alert.direction}{" "}
                      {alert.threshold.toLocaleString("en-US", {
                        maximumFractionDigits: 8,
                      })}{" "}
                      USD
                    </span>
                  </div>

                  <span
                    className={
                      alert.isEnabled
                        ? "alert-status enabled"
                        : "alert-status"
                    }
                  >
                    {alert.isEnabled ? "Enabled" : "Paused"}
                  </span>

                  <div className="alert-actions">
                    <form action={updateEducationalAlert}>
                      <input
                        name="alertId"
                        type="hidden"
                        value={alert.id}
                      />
                      <input
                        name="enabled"
                        type="hidden"
                        value={alert.isEnabled ? "false" : "true"}
                      />
                      <button type="submit">
                        {alert.isEnabled ? "Pause" : "Enable"}
                      </button>
                    </form>

                    <form action={removeEducationalAlert}>
                      <input
                        name="alertId"
                        type="hidden"
                        value={alert.id}
                      />
                      <button className="danger" type="submit">
                        Delete
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="watchlist-empty">
            No alerts yet. Add a reference threshold to start your
            study list.
          </p>
        )}
      </div>
    </section>
  );
}
