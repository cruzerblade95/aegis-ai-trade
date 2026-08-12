"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { UserPlan } from "../../db/plans";
import { AiAutoTrader } from "./ai-auto-trader";
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
type TradingEnvironment = "virtual" | "current";

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
  plan,
}: {
  initialState: VirtualTradingState;
  plan: UserPlan;
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
  const [takeProfit, setTakeProfit] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [activeTab, setActiveTab] =
    useState<RecordTab>("positions");
  const [environment, setEnvironment] =
    useState<TradingEnvironment>(initialState.environment);
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
  const selectedPositions = account.positions.filter(
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
      ...account.positions
        .filter((position) => position.marketSymbol === selectedKey)
        .map((position) => ({
          id: position.id,
          side: position.side,
          status: "open" as const,
          price: position.averageEntryPrice,
          quantity: position.quantity,
          time: position.openedAt,
          takeProfit: position.takeProfit,
          stopLoss: position.stopLoss,
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
    [account.orders, account.positions, selectedKey],
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
        const response = await fetch(body ? "/api/trade" : `/api/trade?environment=${environment}`, {
          method: body ? "POST" : "GET",
          cache: "no-store",
          headers: body
            ? { "Content-Type": "application/json" }
            : undefined,
          body: body ? JSON.stringify({ ...body, environment }) : undefined,
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
    [environment],
  );

  useEffect(() => { void requestAccount(undefined, { quiet: true }); }, [environment, requestAccount]);

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
      limitPrice: orderType === "limit" ? numericLimitPrice : null,
      takeProfit: takeProfit === "" ? null : Number(takeProfit),
      stopLoss: stopLoss === "" ? null : Number(stopLoss),
    });

    if (result) {
      setChartRefreshToken((current) => current + 1);
      setNotice(
        orderType === "market"
          ? `Virtual ${side} filled using the live provider price.`
          : `Virtual limit ${side} accepted. It may fill immediately if the live price already meets the limit.`,
      );
      setActiveTab(orderType === "limit" ? "orders" : "positions");
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

  async function closePosition(positionId: string, marketSymbol: MarketKey) {
    const result = await requestAccount({ action: "close", positionId });

    if (result) {
      setSelectedKey(marketSymbol);
      setChartRefreshToken((current) => current + 1);
      setNotice(
        `${formatMarket(marketSymbol)} virtual position closed at the latest provider price.`,
      );
      setActiveTab("positions");
    }
  }

  async function updateStops(positionId: string, takeProfit: number | null, stopLoss: number | null) {
    const result = await requestAccount({ action: "stops", positionId, takeProfit, stopLoss });
    if (result) { setNotice("TP/SL updated for the selected position."); setActiveTab("positions"); }
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
  const orderButtonLabel = side === "buy" ? `Place ${environment} buy` : `Place ${environment} sell`;
  const canSubmit =
    !busy &&
    quote !== null &&
    Number.isFinite(numericQuantity) &&
    numericQuantity > 0 &&
    (orderType === "market" ||
      (Number.isFinite(numericLimitPrice) &&
        numericLimitPrice > 0));

  return (
    <>
      <AiAutoTrader environment={environment} plan={plan} onState={(next) => { setAccount(next); setActiveTab("positions"); setChartRefreshToken((value) => value + 1); }} />

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
              aria-pressed={environment === "current"}
              className={
                environment === "current" ? "active real" : "real"
              }
              onClick={() => { setOrderType("market"); setEnvironment("current"); }}
              type="button"
            >
              Current
            </button>
          </div>
        </div>

        <p id="real-environment-note">
          {environment === "virtual"
            ? "Virtual orders use your separate Virtual Balance."
            : "Current environment uses your system Current Balance. It has no external payment gateway or broker connection."}
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
                : "CURRENT"
            }
            refreshToken={chartRefreshToken}
            selectedKey={selectedKey}
            showLearningBalance={false}
            showWorkspaceTabs={false}
            tradeOrders={chartTradeOrders}
          />
        </div>

        {(
          <aside className="virtual-order-ticket">
          <div className="order-ticket-heading">
            <div>
              <p className="eyebrow">ORDER TICKET</p>
              <h2>{selectedMarket.label}</h2>
            </div>

            <span>{quote?.source ?? "Connecting"}</span>
          </div>

          <div className="virtual-balance-card">
            <span>Available {environment === "virtual" ? "Virtual" : "Current"} USD</span>
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
                <option disabled={environment === "current"} value="limit">Limit{environment === "current" ? " (Virtual only)" : ""}</option>
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
            <div className="tp-sl-grid">
              <label>Take profit (USD)<input inputMode="decimal" min="0.01" onChange={(event) => setTakeProfit(event.target.value)} placeholder="Optional" step="0.01" type="number" value={takeProfit} /></label>
              <label>Stop loss (USD)<input inputMode="decimal" min="0.01" onChange={(event) => setStopLoss(event.target.value)} placeholder="Optional" step="0.01" type="number" value={stopLoss} /></label>
            </div>

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
                    selectedPositions.reduce((total, position) => total + position.availableQuantity, 0),
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
            {environment === "virtual" ? "Virtual Balance" : "Current Balance"} execution. Market orders use a server-fetched provider price. Limit orders are currently available in Virtual only.
          </p>
          </aside>
        )}
      </section>

      {(
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
              onClose={(positionId, marketSymbol) =>
                void closePosition(positionId, marketSymbol)
              }
              onUpdateStops={(positionId, takeProfit, stopLoss) =>
                void updateStops(positionId, takeProfit, stopLoss)
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
      )}
    </>
  );
}

function PositionsTable({
  busy,
  onClose,
  onUpdateStops,
  positions,
  quote,
}: {
  busy: boolean;
  onClose: (positionId: string, marketSymbol: MarketKey) => void;
  onUpdateStops: (positionId: string, takeProfit: number | null, stopLoss: number | null) => void;
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
            <th>Ticket</th>
            <th>Market</th>
            <th>Side</th>
            <th>Quantity</th>
            <th>Available</th>
            <th>Average entry</th>
            <th>Current value</th>
            <th>Unrealized P/L</th>
            <th>TP / SL</th>
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
              ? (position.side === "buy" ? currentPrice - position.averageEntryPrice : position.averageEntryPrice - currentPrice) * position.quantity
              : null;

            return (
              <tr key={position.id}>
                <td>#{position.id.slice(0, 8)}</td>
                <td>{formatMarket(position.marketSymbol)}</td>
                <td className={position.side}>{position.side}</td>
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
                <td><PositionStops position={position} busy={busy} onSave={onUpdateStops} /></td>
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
                      onClose(position.id, position.marketSymbol)
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

function PositionStops({ position, busy, onSave }: { position: VirtualTradingState["positions"][number]; busy: boolean; onSave: (id: string, tp: number | null, sl: number | null) => void }) {
  const [tp, setTp] = useState(position.takeProfit?.toString() ?? "");
  const [sl, setSl] = useState(position.stopLoss?.toString() ?? "");
  return <div className="position-stops"><input aria-label="Take profit" placeholder="TP" step="0.01" type="number" value={tp} onChange={(e)=>setTp(e.target.value)} /><input aria-label="Stop loss" placeholder="SL" step="0.01" type="number" value={sl} onChange={(e)=>setSl(e.target.value)} /><button disabled={busy} type="button" onClick={()=>onSave(position.id,tp===""?null:Number(tp),sl===""?null:Number(sl))}>Save</button></div>;
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
