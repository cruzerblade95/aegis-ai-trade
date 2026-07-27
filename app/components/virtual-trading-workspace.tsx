"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type {
  VirtualOrderSide,
  VirtualOrderType,
  VirtualTradingState,
} from "../../db/virtual-trading";
import {
  LiveMarketTerminal,
  liveMarkets,
  type LiveMarketInterval,
  type MarketKey,
  type TradeChartOrder,
} from "./live-market-terminal";

type RecordTab = "positions" | "orders" | "history" | "journal";
type TradingEnvironment = "virtual" | "real";

type LiveQuote = {
  fetchedAt: string;
  interval: LiveMarketInterval;
  price: number;
  source: string;
  symbol: MarketKey;
};

const recordTabs: Array<{ label: string; value: RecordTab }> = [
  { label: "Positions", value: "positions" },
  { label: "Orders", value: "orders" },
  { label: "History", value: "history" },
  { label: "Trade Journal", value: "journal" },
];

export function VirtualTradingWorkspace({
  initialState,
}: {
  initialState: VirtualTradingState;
}) {
  const [account, setAccount] = useState(initialState);
  const [selectedKey, setSelectedKey] =
    useState<MarketKey>("BTCUSD");
  const [quote, setQuote] = useState<LiveQuote | null>(null);
  const [side, setSide] = useState<VirtualOrderSide>("buy");
  const [orderType, setOrderType] =
    useState<VirtualOrderType>("market");
  const [quantity, setQuantity] = useState("0.01");
  const [limitPrice, setLimitPrice] = useState("");
  const [activeTab, setActiveTab] =
    useState<RecordTab>("positions");
  const [environment, setEnvironment] =
    useState<TradingEnvironment>("virtual");
  const [chartRefreshToken, setChartRefreshToken] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [journalTitle, setJournalTitle] = useState("");
  const [journalObservation, setJournalObservation] = useState("");
  const [journalRisk, setJournalRisk] = useState("");
  const lastSyncedQuote = useRef<string | null>(null);
  const lastLimitSyncAt = useRef(0);

  const selectedMarket =
    liveMarkets.find((market) => market.key === selectedKey) ??
    liveMarkets[0];
  const selectedPosition = account.positions.find(
    (position) => position.marketSymbol === selectedKey,
  );
  const numericQuantity = Number(quantity);
  const numericLimitPrice = Number(limitPrice);
  const estimatedPrice =
    orderType === "market" ? quote?.price : numericLimitPrice;
  const estimatedValue =
    Number.isFinite(numericQuantity) &&
    numericQuantity > 0 &&
    estimatedPrice &&
    Number.isFinite(estimatedPrice)
      ? numericQuantity * estimatedPrice
      : null;
  const chartTradeOrders = useMemo<TradeChartOrder[]>(
    () => [
      ...account.history
        .filter(
          (order) =>
            order.marketSymbol === selectedKey &&
            order.status === "filled" &&
            order.executedPrice !== null,
        )
        .map((order) => ({
          id: order.id,
          side: order.side,
          status: "filled" as const,
          price: order.executedPrice as number,
          quantity: order.quantity,
          time: order.filledAt ?? order.createdAt,
        })),
      ...account.orders
        .filter(
          (order) =>
            order.marketSymbol === selectedKey &&
            order.limitPrice !== null,
        )
        .map((order) => ({
          id: order.id,
          side: order.side,
          status: "pending" as const,
          price: order.limitPrice as number,
          quantity: order.quantity,
          time: order.createdAt,
        })),
    ],
    [account.history, account.orders, selectedKey],
  );

  const requestAccount = useCallback(
    async (
      body?: Record<string, unknown>,
      options: { quiet?: boolean } = {},
    ) => {
      if (!options.quiet) {
        setBusy(true);
        setError(null);
        setNotice(null);
      }

      try {
        const response = await fetch("/api/trade", {
          method: body ? "POST" : "GET",
          cache: "no-store",
          headers: body
            ? { "Content-Type": "application/json" }
            : undefined,
          body: body ? JSON.stringify(body) : undefined,
        });
        const data = (await response.json()) as
          | VirtualTradingState
          | { error?: string };

        if (!response.ok || !("wallet" in data)) {
          throw new Error(
            "error" in data && data.error
              ? data.error
              : "Unable to update the virtual account.",
          );
        }

        setAccount(data);
        return data;
      } catch (requestError) {
        if (!options.quiet) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to update the virtual account.",
          );
        }
        return null;
      } finally {
        if (!options.quiet) {
          setBusy(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (
      !quote ||
      lastSyncedQuote.current === quote.fetchedAt ||
      Date.now() - lastLimitSyncAt.current < 15_000
    ) {
      return;
    }

    lastSyncedQuote.current = quote.fetchedAt;
    lastLimitSyncAt.current = Date.now();
    void requestAccount({ action: "sync" }, { quiet: true });
  }, [quote, requestAccount]);

  const handleQuoteChange = useCallback(
    (nextQuote: LiveQuote | null) => {
      setQuote(nextQuote);
    },
    [],
  );

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = await requestAccount({
      action: "place",
      marketSymbol: selectedKey,
      side,
      orderType,
      quantity: numericQuantity,
      limitPrice:
        orderType === "limit" ? numericLimitPrice : null,
    });

    if (result) {
      setChartRefreshToken((current) => current + 1);
      setNotice(
        orderType === "market"
          ? `Virtual ${side} filled using the live provider price.`
          : `Virtual limit ${side} accepted. It may fill immediately if the live price already meets the limit.`,
      );
      setActiveTab(orderType === "limit" ? "orders" : "history");
    }
  }

  async function cancelOrder(orderId: string) {
    const result = await requestAccount({
      action: "cancel",
      orderId,
    });

    if (result) {
      setChartRefreshToken((current) => current + 1);
      setNotice("Virtual limit order cancelled.");
    }
  }

  async function closePosition(marketSymbol: MarketKey) {
    const result = await requestAccount({
      action: "close",
      marketSymbol,
    });

    if (result) {
      setSelectedKey(marketSymbol);
      setChartRefreshToken((current) => current + 1);
      setNotice(
        `${formatMarket(marketSymbol)} virtual position closed at the latest provider price.`,
      );
      setActiveTab("history");
    }
  }

  async function submitJournal(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const result = await requestAccount({
      action: "journal-create",
      marketSymbol: selectedKey,
      timeframe: quote?.interval ?? "5min",
      title: journalTitle,
      observation: journalObservation,
      riskNotes: journalRisk,
    });

    if (result) {
      setJournalTitle("");
      setJournalObservation("");
      setJournalRisk("");
      setNotice("Trade journal entry saved.");
    }
  }

  async function deleteJournal(entryId: string) {
    const result = await requestAccount({
      action: "journal-delete",
      orderId: entryId,
    });

    if (result) {
      setNotice("Trade journal entry deleted.");
    }
  }

  const buyingPower = formatCurrency(
    account.wallet.balanceMinor / 100,
  );
  const orderButtonLabel =
    side === "buy" ? "Place virtual buy" : "Place virtual sell";
  const canSubmit =
    environment === "virtual" &&
    !busy &&
    quote !== null &&
    Number.isFinite(numericQuantity) &&
    numericQuantity > 0 &&
    (orderType === "market" ||
      (Number.isFinite(numericLimitPrice) &&
        numericLimitPrice > 0));

  return (
    <>
      <section className="trade-environment-bar">
        <div>
          <span>Trading environment</span>
          <div
            aria-label="Trading environment"
            className="environment-switch"
            role="group"
          >
            <button
              aria-pressed={environment === "virtual"}
              className={
                environment === "virtual" ? "active" : undefined
              }
              onClick={() => setEnvironment("virtual")}
              type="button"
            >
              Virtual
            </button>
            <button
              aria-describedby="real-environment-note"
              aria-pressed={environment === "real"}
              className={
                environment === "real" ? "active real" : "real"
              }
              onClick={() => setEnvironment("real")}
              type="button"
            >
              Real
            </button>
          </div>
        </div>

        <p id="real-environment-note">
          {environment === "virtual"
            ? "Virtual orders use your separate simulated USD balance."
            : "Real environment selected. Connect a broker account before real balances or order execution can be enabled."}
        </p>
      </section>

      <section className="virtual-trade-grid">
        <div className="virtual-chart-column">
          <LiveMarketTerminal
            onMarketChange={setSelectedKey}
            onQuoteChange={handleQuoteChange}
            paperPillLabel={
              environment === "virtual"
                ? "VIRTUAL"
                : "REAL · NOT CONNECTED"
            }
            refreshToken={chartRefreshToken}
            selectedKey={selectedKey}
            showLearningBalance={false}
            showWorkspaceTabs={false}
            tradeOrders={
              environment === "virtual" ? chartTradeOrders : []
            }
          />
        </div>

        {environment === "virtual" ? (
          <aside className="virtual-order-ticket">
          <div className="order-ticket-heading">
            <div>
              <p className="eyebrow">ORDER TICKET</p>
              <h2>{selectedMarket.label}</h2>
            </div>

            <span>{quote?.source ?? "Connecting"}</span>
          </div>

          <div className="virtual-balance-card">
            <span>Available virtual USD</span>
            <strong>{buyingPower}</strong>
            <small>
              Reserved limit-buy funds are already excluded.
            </small>
          </div>

          <form onSubmit={submitOrder}>
            <div className="order-side-switch">
              <button
                aria-pressed={side === "buy"}
                className={side === "buy" ? "buy active" : "buy"}
                onClick={() => setSide("buy")}
                type="button"
              >
                Buy
              </button>
              <button
                aria-pressed={side === "sell"}
                className={
                  side === "sell" ? "sell active" : "sell"
                }
                onClick={() => setSide("sell")}
                type="button"
              >
                Sell
              </button>
            </div>

            <label>
              Order type
              <select
                onChange={(event) =>
                  setOrderType(
                    event.target.value as VirtualOrderType,
                  )
                }
                value={orderType}
              >
                <option value="market">Market</option>
                <option value="limit">Limit</option>
              </select>
            </label>

            <label>
              Quantity ({assetCode(selectedKey)})
              <input
                inputMode="decimal"
                min="0.00000001"
                onChange={(event) =>
                  setQuantity(event.target.value)
                }
                required
                step="0.00000001"
                type="number"
                value={quantity}
              />
            </label>

            {orderType === "limit" && (
              <label>
                Limit price (USD)
                <input
                  inputMode="decimal"
                  min="0.01"
                  onChange={(event) =>
                    setLimitPrice(event.target.value)
                  }
                  placeholder={
                    quote ? quote.price.toFixed(2) : "0.00"
                  }
                  required
                  step="0.01"
                  type="number"
                  value={limitPrice}
                />
              </label>
            )}

            <dl className="order-summary">
              <div>
                <dt>Live reference</dt>
                <dd>
                  {quote
                    ? formatCurrency(quote.price)
                    : "Unavailable"}
                </dd>
              </div>
              <div>
                <dt>Estimated value</dt>
                <dd>
                  {estimatedValue
                    ? formatCurrency(estimatedValue)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Available to sell</dt>
                <dd>
                  {formatQuantity(
                    selectedPosition?.availableQuantity ?? 0,
                  )}{" "}
                  {assetCode(selectedKey)}
                </dd>
              </div>
            </dl>

            <button
              className={`virtual-submit ${side}`}
              disabled={!canSubmit}
              type="submit"
            >
              {busy ? "Processing…" : orderButtonLabel}
            </button>
          </form>

          {error && (
            <p className="trade-feedback error" role="alert">
              {error}
            </p>
          )}

          {notice && !error && (
            <p className="trade-feedback success" role="status">
              {notice}
            </p>
          )}

          <p className="virtual-order-disclaimer">
            Virtual execution only. Market orders use a server-fetched
            provider price; limit orders are checked whenever live data
            refreshes.
          </p>
          </aside>
        ) : (
          <aside
            aria-live="polite"
            className="virtual-order-ticket real-account-panel"
          >
            <div className="order-ticket-heading">
              <div>
                <p className="eyebrow">REAL ENVIRONMENT</p>
                <h2>Broker connection required</h2>
              </div>
              <span>Not connected</span>
            </div>

            <div className="real-account-status">
              <span>Real USD balance</span>
              <strong>Unavailable</strong>
              <small>
                Aegis will only show a real balance returned by an
                authenticated broker or exchange account.
              </small>
            </div>

            <dl className="order-summary">
              <div>
                <dt>Trading provider</dt>
                <dd>Not configured</dd>
              </div>
              <div>
                <dt>Order execution</dt>
                <dd>Disabled</dd>
              </div>
              <div>
                <dt>Market chart</dt>
                <dd>Live reference data</dd>
              </div>
            </dl>

            <p className="virtual-order-disclaimer">
              Select the broker or exchange first. Real balances,
              authentication, order rules, and execution APIs differ by
              provider and cannot be safely guessed.
            </p>

            <button
              className="button secondary real-return-button"
              onClick={() => setEnvironment("virtual")}
              type="button"
            >
              Return to Virtual
            </button>
          </aside>
        )}
      </section>

      {environment === "virtual" ? (
        <section className="virtual-records">
        <div className="virtual-record-tabs" role="tablist">
          {recordTabs.map((tab) => (
            <button
              aria-controls={`virtual-record-panel-${tab.value}`}
              aria-selected={activeTab === tab.value}
              className={activeTab === tab.value ? "active" : ""}
              id={`virtual-record-tab-${tab.value}`}
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              role="tab"
              type="button"
            >
              {tab.label}
              <span>{recordCount(tab.value, account)}</span>
            </button>
          ))}

          <button
            className="records-refresh"
            disabled={busy}
            onClick={() => void requestAccount()}
            type="button"
          >
            Refresh
          </button>
        </div>

        <div
          aria-labelledby={`virtual-record-tab-${activeTab}`}
          className="virtual-record-panel"
          id={`virtual-record-panel-${activeTab}`}
          role="tabpanel"
        >
          {activeTab === "positions" && (
            <PositionsTable
              busy={busy}
              onClose={(marketSymbol) =>
                void closePosition(marketSymbol)
              }
              positions={account.positions}
              quote={quote}
            />
          )}

          {activeTab === "orders" && (
            <OrdersTable
              onCancel={(orderId) => void cancelOrder(orderId)}
              orders={account.orders}
            />
          )}

          {activeTab === "history" && (
            <HistoryTable history={account.history} />
          )}

          {activeTab === "journal" && (
            <div className="virtual-journal-grid">
              <form onSubmit={submitJournal}>
                <h3>New trade note</h3>
                <label>
                  Title
                  <input
                    maxLength={100}
                    onChange={(event) =>
                      setJournalTitle(event.target.value)
                    }
                    placeholder="Why I placed or skipped this trade"
                    required
                    value={journalTitle}
                  />
                </label>
                <label>
                  Observation
                  <textarea
                    maxLength={2000}
                    onChange={(event) =>
                      setJournalObservation(event.target.value)
                    }
                    placeholder="What did the chart and order setup show?"
                    required
                    rows={3}
                    value={journalObservation}
                  />
                </label>
                <label>
                  Risk notes
                  <textarea
                    maxLength={2000}
                    onChange={(event) =>
                      setJournalRisk(event.target.value)
                    }
                    placeholder="What could make the virtual trade fail?"
                    required
                    rows={3}
                    value={journalRisk}
                  />
                </label>
                <button disabled={busy} type="submit">
                  Save trade note
                </button>
              </form>

              <div className="virtual-journal-list">
                {account.journalEntries.length > 0 ? (
                  account.journalEntries.map((entry) => (
                    <article key={entry.id}>
                      <div>
                        <span>{entry.marketSymbol}</span>
                        <time>
                          {new Date(entry.createdAt).toLocaleString(
                            "en-MY",
                          )}
                        </time>
                      </div>
                      <h3>{entry.title}</h3>
                      <p>{entry.observation}</p>
                      <small>Risk: {entry.riskNotes}</small>
                      <button
                        disabled={busy}
                        onClick={() => void deleteJournal(entry.id)}
                        type="button"
                      >
                        Delete
                      </button>
                    </article>
                  ))
                ) : (
                  <EmptyRecords
                    description="Save a note after reviewing a virtual setup."
                    title="No trade journal entries yet"
                  />
                )}
              </div>
            </div>
          )}
        </div>
        </section>
      ) : (
        <section className="virtual-records real-records-placeholder">
          <div className="virtual-record-panel">
            <EmptyRecords
              description="Connect a supported broker or exchange before Aegis can retrieve real positions, orders, history, and account balance."
              title="No real account connected"
            />
          </div>
        </section>
      )}
    </>
  );
}

function PositionsTable({
  busy,
  onClose,
  positions,
  quote,
}: {
  busy: boolean;
  onClose: (marketSymbol: MarketKey) => void;
  positions: VirtualTradingState["positions"];
  quote: LiveQuote | null;
}) {
  if (positions.length === 0) {
    return (
      <EmptyRecords
        description="Filled virtual buy orders will create positions here."
        title="No open virtual positions"
      />
    );
  }

  return (
    <div className="virtual-table-scroll">
      <table>
        <thead>
          <tr>
            <th>Market</th>
            <th>Quantity</th>
            <th>Available</th>
            <th>Average entry</th>
            <th>Current value</th>
            <th>Unrealized P/L</th>
            <th>Realized P/L</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((position) => {
            const currentPrice =
              quote?.symbol === position.marketSymbol
                ? quote.price
                : null;
            const currentValue = currentPrice
              ? currentPrice * position.quantity
              : null;
            const unrealized = currentPrice
              ? (currentPrice - position.averageEntryPrice) *
                position.quantity
              : null;

            return (
              <tr key={position.marketSymbol}>
                <td>{formatMarket(position.marketSymbol)}</td>
                <td>{formatQuantity(position.quantity)}</td>
                <td>
                  {formatQuantity(position.availableQuantity)}
                </td>
                <td>
                  {formatCurrency(position.averageEntryPrice)}
                </td>
                <td>
                  {currentValue
                    ? formatCurrency(currentValue)
                    : "Select market"}
                </td>
                <td className={pnlClass(unrealized)}>
                  {unrealized === null
                    ? "—"
                    : formatSignedCurrency(unrealized)}
                </td>
                <td
                  className={pnlClass(
                    position.realizedPnlMinor / 100,
                  )}
                >
                  {formatSignedCurrency(
                    position.realizedPnlMinor / 100,
                  )}
                </td>
                <td>
                  <button
                    className="close-virtual-position"
                    disabled={
                      busy || position.availableQuantity <= 0
                    }
                    onClick={() =>
                      onClose(position.marketSymbol)
                    }
                    type="button"
                  >
                    {position.availableQuantity < position.quantity
                      ? "Close available"
                      : "Close position"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OrdersTable({
  orders,
  onCancel,
}: {
  orders: VirtualTradingState["orders"];
  onCancel: (orderId: string) => void;
}) {
  if (orders.length === 0) {
    return (
      <EmptyRecords
        description="Limit orders waiting for their target price will appear here."
        title="No pending virtual orders"
      />
    );
  }

  return (
    <div className="virtual-table-scroll">
      <table>
        <thead>
          <tr>
            <th>Created</th>
            <th>Market</th>
            <th>Side</th>
            <th>Type</th>
            <th>Quantity</th>
            <th>Limit</th>
            <th>Reserved USD</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>{formatDate(order.createdAt)}</td>
              <td>{formatMarket(order.marketSymbol)}</td>
              <td className={order.side}>{order.side}</td>
              <td>{order.orderType}</td>
              <td>{formatQuantity(order.quantity)}</td>
              <td>
                {order.limitPrice
                  ? formatCurrency(order.limitPrice)
                  : "—"}
              </td>
              <td>
                {formatCurrency(order.reservedQuoteMinor / 100)}
              </td>
              <td>
                <button
                  className="cancel-virtual-order"
                  onClick={() => onCancel(order.id)}
                  type="button"
                >
                  Cancel
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HistoryTable({
  history,
}: {
  history: VirtualTradingState["history"];
}) {
  if (history.length === 0) {
    return (
      <EmptyRecords
        description="Filled and cancelled virtual orders will appear here."
        title="No virtual order history"
      />
    );
  }

  return (
    <div className="virtual-table-scroll">
      <table>
        <thead>
          <tr>
            <th>Updated</th>
            <th>Market</th>
            <th>Side</th>
            <th>Type</th>
            <th>Quantity</th>
            <th>Execution</th>
            <th>Value</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {history.map((order) => (
            <tr key={order.id}>
              <td>
                {formatDate(
                  order.filledAt ??
                    order.cancelledAt ??
                    order.createdAt,
                )}
              </td>
              <td>{formatMarket(order.marketSymbol)}</td>
              <td className={order.side}>{order.side}</td>
              <td>{order.orderType}</td>
              <td>{formatQuantity(order.quantity)}</td>
              <td>
                {order.executedPrice
                  ? formatCurrency(order.executedPrice)
                  : "—"}
              </td>
              <td>
                {order.quoteAmountMinor
                  ? formatCurrency(order.quoteAmountMinor / 100)
                  : "—"}
              </td>
              <td>
                <span className={`virtual-status ${order.status}`}>
                  {order.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyRecords({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="virtual-record-empty">
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

function recordCount(
  tab: RecordTab,
  account: VirtualTradingState,
) {
  if (tab === "positions") return account.positions.length;
  if (tab === "orders") return account.orders.length;
  if (tab === "history") return account.history.length;
  return account.journalEntries.length;
}

function assetCode(symbol: MarketKey) {
  return symbol.replace("USD", "");
}

function formatMarket(symbol: MarketKey) {
  return `${assetCode(symbol)}/USD`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatSignedCurrency(value: number) {
  const formatted = formatCurrency(Math.abs(value));
  return `${value >= 0 ? "+" : "-"}${formatted}`;
}

function formatQuantity(value: number) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 8,
  });
}

function formatDate(value: number) {
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function pnlClass(value: number | null) {
  if (value === null || value === 0) return "";
  return value > 0 ? "positive" : "negative";
}
