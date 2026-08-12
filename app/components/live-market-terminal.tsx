"use client";

import {
  CandlestickSeries,
  ColorType,
  LineStyle,
  LineSeries,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";

export const liveMarkets = [
  { key: "BTCUSD", label: "BTC/USD", name: "Bitcoin" },
  { key: "ETHUSD", label: "ETH/USD", name: "Ethereum" },
  { key: "SOLUSD", label: "SOL/USD", name: "Solana" },
  { key: "XAUUSD", label: "XAU/USD", name: "Gold" },
] as const;

export type MarketKey = (typeof liveMarkets)[number]["key"];
export type LiveMarketInterval = "1min" | "5min" | "1h" | "1day";
export type TradeChartOrder = {
  id: string;
  side: "buy" | "sell";
  status: "open" | "pending";
  price: number;
  quantity: number;
  time: number;
  takeProfit?: number | null;
  stopLoss?: number | null;
};
type WorkspaceTab = "positions" | "orders" | "history" | "journal";

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

type CandleResponse = {
  availableSymbols?: MarketKey[];
  candles?: Candle[];
  displaySymbol?: string;
  error?: string;
  fetchedAt?: string;
  provider?: "kraken" | "twelve_data";
  source?: string;
  unavailable?: boolean;
};

type KrakenOhlcMessage = {
  channel?: string;
  data?: Array<{
    close?: number;
    high?: number;
    interval_begin?: string;
    low?: number;
    open?: number;
    symbol?: string;
  }>;
  type?: string;
};

const timeframeOptions: Array<{
  label: string;
  value: LiveMarketInterval;
}> = [
  { label: "1m", value: "1min" },
  { label: "5m", value: "5min" },
  { label: "1h", value: "1h" },
  { label: "1D", value: "1day" },
];

const tabOptions: Array<{
  label: string;
  value: WorkspaceTab;
}> = [
  { label: "Positions", value: "positions" },
  { label: "Orders", value: "orders" },
  { label: "History", value: "history" },
  { label: "Trade journal", value: "journal" },
];

export function LiveMarketTerminal({
  balance = 100_000,
  compact = false,
  onOpen,
  selectedKey,
  onMarketChange,
  onAvailabilityChange,
  onQuoteChange,
  paperPillLabel = "READ ONLY",
  refreshToken = 0,
  showLearningBalance = true,
  showWorkspaceTabs = true,
  tradeOrders = [],
}: {
  balance?: number;
  compact?: boolean;
  onOpen?: () => void;
  selectedKey: MarketKey;
  onMarketChange: (market: MarketKey) => void;
  onAvailabilityChange?: (markets: MarketKey[]) => void;
  onQuoteChange?: (
    quote: {
      fetchedAt: string;
      interval: LiveMarketInterval;
      price: number;
      source: string;
      symbol: MarketKey;
    } | null,
  ) => void;
  paperPillLabel?: string;
  refreshToken?: number;
  showLearningBalance?: boolean;
  showWorkspaceTabs?: boolean;
  tradeOrders?: TradeChartOrder[];
}) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef =
    useRef<ISeriesApi<"Candlestick"> | null>(null);
  const averageSeriesRef =
    useRef<ISeriesApi<"Line"> | null>(null);
  const tradePriceLinesRef = useRef<IPriceLine[]>([]);
  const fitNextDataRef = useRef(true);
  const barSpacingRef = useRef(compact ? 8 : 12);

  const [interval, setInterval] =
    useState<LiveMarketInterval>("5min");
  const [activeTab, setActiveTab] =
    useState<WorkspaceTab>("positions");
  const [showAverage, setShowAverage] = useState(false);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [provider, setProvider] =
    useState<"kraken" | "twelve_data" | null>(null);
  const [streamConnected, setStreamConnected] = useState(false);
  const [availableSymbols, setAvailableSymbols] =
    useState<MarketKey[] | null>(null);
  const [viewHistory, setViewHistory] = useState<string[]>([]);
  const [journalDraft, setJournalDraft] = useState("");
  const [journalNotes, setJournalNotes] = useState<string[]>([]);

  const selectedMarket =
    liveMarkets.find((market) => market.key === selectedKey) ??
    liveMarkets[0];

  useEffect(() => {
    const container = chartContainerRef.current;

    if (!container) {
      return;
    }

    const chart = createChart(container, {
      autoSize: true,
      height: compact ? 280 : 430,
      layout: {
        background: {
          type: ColorType.Solid,
          color: "#05141c",
        },
        textColor: "#8ca0ab",
      },
      grid: {
        horzLines: { color: "rgba(67, 116, 130, 0.12)" },
        vertLines: { color: "rgba(67, 116, 130, 0.12)" },
      },
      rightPriceScale: {
        borderColor: "#163540",
      },
      timeScale: {
        barSpacing: barSpacingRef.current,
        borderColor: "#163540",
        fixLeftEdge: false,
        fixRightEdge: false,
        lockVisibleTimeRangeOnResize: true,
        rightBarStaysOnScroll: true,
        rightOffset: 6,
        secondsVisible: false,
        timeVisible: true,
      },
      handleScale: {
        axisDoubleClickReset: true,
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
      handleScroll: {
        horzTouchDrag: true,
        mouseWheel: true,
        pressedMouseMove: true,
        vertTouchDrag: true,
      },
      crosshair: {
        horzLine: { color: "#1cceff" },
        vertLine: { color: "#1cceff" },
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      borderVisible: false,
      downColor: "#ff5d63",
      upColor: "#36e6ae",
      wickDownColor: "#ff5d63",
      wickUpColor: "#36e6ae",
    });

    const averageSeries = chart.addSeries(LineSeries, {
      color: "#1cceff",
      lineWidth: 2,
      visible: false,
    });
    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    averageSeriesRef.current = averageSeries;

    return () => {
      chartRef.current = null;
      candleSeriesRef.current = null;
      averageSeriesRef.current = null;
      tradePriceLinesRef.current = [];
      chart.remove();
    };
  }, [compact]);

  useEffect(() => {
    candleSeriesRef.current?.setData(
      candles.map((candle) => ({
        ...candle,
        time: candle.time as UTCTimestamp,
      })),
    );

    averageSeriesRef.current?.setData(
      movingAverage(candles, 20).map((point) => ({
        time: point.time as UTCTimestamp,
        value: point.value,
      })),
    );

    if (fitNextDataRef.current && candles.length > 0) {
      showDefaultChartRange(chartRef.current, candles.length);
      fitNextDataRef.current = false;
    }
  }, [candles]);

  useEffect(() => {
    averageSeriesRef.current?.applyOptions({
      visible: showAverage,
    });
  }, [showAverage]);

  useEffect(() => {
    const candleSeries = candleSeriesRef.current;

    if (!candleSeries) {
      return;
    }

    for (const priceLine of tradePriceLinesRef.current) {
      candleSeries.removePriceLine(priceLine);
    }
    tradePriceLinesRef.current = [];

    const lines: IPriceLine[] = [];

    for (const order of tradeOrders) {
      if (!Number.isFinite(order.price) || order.price <= 0) {
        continue;
      }

      const sideColor = order.side === "buy" ? "#36e6ae" : "#ff5d63";
      const ticket = order.id.slice(0, 8);

      if (order.status === "open") {
        lines.push(
          candleSeries.createPriceLine({
            axisLabelVisible: true,
            color: sideColor,
            lineStyle: LineStyle.Solid,
            lineWidth: 1,
            price: order.price,
            title: `#${ticket} ${order.side.toUpperCase()} ${formatMarkerQuantity(order.quantity)}`,
          }),
        );

        if (order.takeProfit && Number.isFinite(order.takeProfit)) {
          lines.push(
            candleSeries.createPriceLine({
              axisLabelVisible: true,
              color: "#36e6ae",
              lineStyle: LineStyle.Dashed,
              lineWidth: 1,
              price: order.takeProfit,
              title: `#${ticket} TP`,
            }),
          );
        }

        if (order.stopLoss && Number.isFinite(order.stopLoss)) {
          lines.push(
            candleSeries.createPriceLine({
              axisLabelVisible: true,
              color: "#ffb84d",
              lineStyle: LineStyle.Dashed,
              lineWidth: 1,
              price: order.stopLoss,
              title: `#${ticket} SL`,
            }),
          );
        }
      } else {
        lines.push(
          candleSeries.createPriceLine({
            axisLabelVisible: true,
            color: sideColor,
            lineStyle: LineStyle.Dashed,
            lineWidth: 1,
            price: order.price,
            title: `#${ticket} ${order.side.toUpperCase()} LIMIT`,
          }),
        );
      }
    }

    tradePriceLinesRef.current = lines;
  }, [tradeOrders]);

  useEffect(() => {
    let active = true;
    let currentController: AbortController | null = null;

    async function loadCandles(backgroundRefresh = false) {
      currentController?.abort();
      const controller = new AbortController();
      currentController = controller;

      if (backgroundRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setCandles([]);
        fitNextDataRef.current = true;
      }
      setError(null);

      try {
        const query = new URLSearchParams({
          interval,
          symbol: selectedKey,
        });
        const response = await fetch(
          `/api/market/candles?${query.toString()}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );
        const data = (await response.json()) as CandleResponse;

        if (data.availableSymbols) {
          setAvailableSymbols(data.availableSymbols);
          onAvailabilityChange?.(data.availableSymbols);
        }

        if (data.source) {
          setSource(data.source);
        }
        if (data.provider) {
          setProvider(data.provider);
        }

        if (!response.ok || !data.candles) {
          throw new Error(
            data.error ?? "Unable to load live market data.",
          );
        }

        if (!active) {
          return;
        }

        setCandles(data.candles);
        setFetchedAt(data.fetchedAt ?? new Date().toISOString());
        setSource(data.source ?? "Live provider");
        setViewHistory((history) => {
          const entry = `${selectedMarket.label} · ${timeframeLabel(interval)}`;
          return [entry, ...history.filter((item) => item !== entry)].slice(
            0,
            5,
          );
        });
      } catch (requestError) {
        if (
          active &&
          requestError instanceof Error &&
          requestError.name !== "AbortError"
        ) {
          setError(requestError.message);
        }
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    void loadCandles();
    const timer = window.setInterval(
      () => void loadCandles(true),
      30_000,
    );

    return () => {
      active = false;
      currentController?.abort();
      window.clearInterval(timer);
    };
  }, [
    interval,
    onAvailabilityChange,
    refreshToken,
    selectedKey,
    selectedMarket.label,
  ]);

  useEffect(() => {
    if (
      provider !== "kraken" ||
      selectedKey === "XAUUSD" ||
      typeof WebSocket === "undefined"
    ) {
      return;
    }

    let active = true;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;

    function connect() {
      if (!active) {
        return;
      }

      socket = new WebSocket("wss://ws.kraken.com/v2");

      socket.addEventListener("open", () => {
        if (!active || !socket) {
          return;
        }

        setStreamConnected(true);
        socket.send(
          JSON.stringify({
            method: "subscribe",
            params: {
              channel: "ohlc",
              interval: krakenStreamInterval(interval),
              snapshot: false,
              symbol: [selectedMarket.label],
            },
            req_id: 1,
          }),
        );
      });

      socket.addEventListener("message", (event) => {
        if (!active || typeof event.data !== "string") {
          return;
        }

        try {
          const message = JSON.parse(event.data) as KrakenOhlcMessage;

          if (message.channel !== "ohlc" || !message.data) {
            return;
          }

          for (const update of message.data) {
            const candle = parseKrakenStreamCandle(update);

            if (
              !candle ||
              (update.symbol &&
                update.symbol !== selectedMarket.label)
            ) {
              continue;
            }

            setCandles((current) =>
              mergeStreamingCandle(current, candle),
            );
            setFetchedAt(new Date().toISOString());
            setSource("Kraken WebSocket");
          }
        } catch {
          // Ignore malformed stream frames and keep the REST fallback active.
        }
      });

      socket.addEventListener("error", () => {
        setStreamConnected(false);
      });

      socket.addEventListener("close", () => {
        setStreamConnected(false);

        if (active) {
          reconnectTimer = window.setTimeout(connect, 5_000);
        }
      });
    }

    connect();

    return () => {
      active = false;
      setStreamConnected(false);

      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }

      socket?.close();
    };
  }, [interval, provider, selectedKey, selectedMarket.label]);

  const latest = candles.at(-1);
  const previous = candles.at(-2);
  const changePercent =
    latest && previous
      ? ((latest.close - previous.close) / previous.close) * 100
      : null;
  const decimals = selectedKey === "XAUUSD" ? 2 : 2;
  const statusLabel = error
    ? "Provider unavailable"
    : loading
      ? "Connecting"
      : refreshing
        ? "Refreshing"
        : streamConnected
          ? "Live stream connected"
        : "Live data connected";

  useEffect(() => {
    if (!latest || !fetchedAt || error) {
      onQuoteChange?.(null);
      return;
    }

    onQuoteChange?.({
      fetchedAt,
      interval,
      price: latest.close,
      source: source ?? "Live provider",
      symbol: selectedKey,
    });
  }, [
    error,
    fetchedAt,
    interval,
    latest,
    onQuoteChange,
    selectedKey,
    source,
  ]);

  const journalPlaceholder = useMemo(
    () =>
      `Write an observation about ${selectedMarket.label} on the ${timeframeLabel(interval)} chart…`,
    [interval, selectedMarket.label],
  );

  function zoomChart(direction: "in" | "out") {
    const nextSpacing = Math.min(32, Math.max(4,
      barSpacingRef.current + (direction === "in" ? 2 : -2),
    ));

    barSpacingRef.current = nextSpacing;
    chartRef.current?.timeScale().applyOptions({
      barSpacing: nextSpacing,
    });
  }

  function resetChartView() {
    barSpacingRef.current = compact ? 8 : 12;
    chartRef.current?.timeScale().applyOptions({
      barSpacing: barSpacingRef.current,
      rightOffset: 6,
    });
    showDefaultChartRange(chartRef.current, candles.length);
  }

  function saveJournalNote() {
    const note = journalDraft.trim();

    if (!note) {
      return;
    }

    setJournalNotes((notes) => [
      `${selectedMarket.label} · ${timeframeLabel(interval)} — ${note}`,
      ...notes,
    ]);
    setJournalDraft("");
  }

  return (
    <section
      className={`terminal-card live-terminal ${compact ? "compact" : ""}`}
    >
      <div className="terminal-top">
        <label>
          <span className="asset-dot">
            {selectedMarket.label.slice(0, 2)}
          </span>
          <select
            aria-label="Market"
            onChange={(event) =>
              onMarketChange(event.target.value as MarketKey)
            }
            value={selectedKey}
          >
            {liveMarkets.map((market) => (
              <option
                disabled={
                  availableSymbols !== null &&
                  !availableSymbols.includes(market.key)
                }
                key={market.key}
                value={market.key}
              >
                {market.label}
                {availableSymbols !== null &&
                !availableSymbols.includes(market.key)
                  ? " — Unavailable"
                  : ""}
              </option>
            ))}
          </select>
          <small>{selectedMarket.name}</small>
        </label>

        <span className="paper-pill">{paperPillLabel}</span>

        {showLearningBalance && (
          <div className="mini-balance">
            <small>Virtual learning balance</small>
            <b>{balance.toLocaleString()} USD</b>
          </div>
        )}
      </div>

      <div className="chart-controls">
        <div aria-label="Chart timeframe">
          {timeframeOptions.map((timeframe) => (
            <button
              aria-pressed={interval === timeframe.value}
              className={
                interval === timeframe.value ? "active" : undefined
              }
              key={timeframe.value}
              onClick={() => setInterval(timeframe.value)}
              type="button"
            >
              {timeframe.label}
            </button>
          ))}
        </div>

        <button
          aria-pressed={showAverage}
          className={showAverage ? "active" : undefined}
          onClick={() => setShowAverage((current) => !current)}
          type="button"
        >
          SMA 20
        </button>

        <div aria-label="Chart zoom" className="chart-zoom-controls">
          <button
            aria-label="Zoom chart out"
            onClick={() => zoomChart("out")}
            title="Zoom out"
            type="button"
          >
            −
          </button>
          <button
            aria-label="Reset chart zoom"
            onClick={resetChartView}
            title="Reset chart view"
            type="button"
          >
            Reset
          </button>
          <button
            aria-label="Zoom chart in"
            onClick={() => zoomChart("in")}
            title="Zoom in"
            type="button"
          >
            +
          </button>
        </div>

        <span className={`connection-state ${error ? "error" : ""}`}>
          <i />
          {statusLabel}
        </span>
      </div>

      <div className="ohlc">
        <span>O {formatPrice(latest?.open, decimals)}</span>
        <span>H {formatPrice(latest?.high, decimals)}</span>
        <span>L {formatPrice(latest?.low, decimals)}</span>
        <span
          className={
            changePercent !== null && changePercent < 0 ? "down" : "up"
          }
        >
          C {formatPrice(latest?.close, decimals)}
          {changePercent !== null
            ? ` ${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%`
            : ""}
        </span>
      </div>

      <div className="chart live-candle-chart">
        <div
          aria-label={`${selectedMarket.label} live candlestick chart`}
          className="live-chart-container"
          ref={chartContainerRef}
          role="img"
        />

        {loading && (
          <div className="chart-message" role="status">
            Loading {timeframeLabel(interval)} candles…
          </div>
        )}

        {error && (
          <div className="chart-message chart-message-error" role="alert">
            <b>Live chart unavailable</b>
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && (
          <span className="live-label">
            <i /> {source ?? "LIVE DATA"} ·{" "}
            {fetchedAt
              ? `updated ${new Date(fetchedAt).toLocaleTimeString()}`
              : "connected"}
          </span>
        )}
      </div>

      {showWorkspaceTabs && (
        <>
          <div
            aria-label="Market workspace panels"
            className="terminal-tabs"
            role="tablist"
          >
            {tabOptions.map((tab) => (
              <button
                aria-controls={`terminal-panel-${tab.value}`}
                aria-selected={activeTab === tab.value}
                className={
                  activeTab === tab.value ? "active" : undefined
                }
                id={`terminal-tab-${tab.value}`}
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                role="tab"
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div
            aria-labelledby={`terminal-tab-${activeTab}`}
            className="terminal-tab-panel"
            id={`terminal-panel-${activeTab}`}
            role="tabpanel"
          >
            {activeTab === "positions" && (
              <TerminalEmptyState
                action={onOpen}
                actionLabel="Open full terminal"
                description="This read-only workspace does not open or execute market positions."
                icon="⌁"
                title="No open educational positions"
              />
            )}

            {activeTab === "orders" && (
              <TerminalEmptyState
                description="Order entry is intentionally disabled. Use the chart to study price movement without placing trades."
                icon="▤"
                title="No executable orders"
              />
            )}

            {activeTab === "history" && (
              <div className="terminal-history">
                <b>Recently viewed charts</b>
                {viewHistory.length > 0 ? (
                  <ul>
                    {viewHistory.map((entry) => (
                      <li key={entry}>{entry}</li>
                    ))}
                  </ul>
                ) : (
                  <small>Your viewed markets will appear here.</small>
                )}
              </div>
            )}

            {activeTab === "journal" && (
              <div className="terminal-journal">
                <label htmlFor={`journal-${compact ? "compact" : "full"}`}>
                  Chart observation
                </label>
                <textarea
                  id={`journal-${compact ? "compact" : "full"}`}
                  onChange={(event) =>
                    setJournalDraft(event.target.value)
                  }
                  placeholder={journalPlaceholder}
                  value={journalDraft}
                />
                <button
                  className="button secondary"
                  disabled={!journalDraft.trim()}
                  onClick={saveJournalNote}
                  type="button"
                >
                  Save observation
                </button>
                {journalNotes.length > 0 && (
                  <ul>
                    {journalNotes.map((note, index) => (
                      <li key={`${note}-${index}`}>{note}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </>
      )}

      <div className="terminal-attribution">
        Real reference data may be delayed. Charts powered by{" "}
        <a
          href="https://www.tradingview.com/"
          rel="noreferrer"
          target="_blank"
        >
          TradingView Lightweight Charts
        </a>
        .
      </div>
    </section>
  );
}

function TerminalEmptyState({
  action,
  actionLabel,
  description,
  icon,
  title,
}: {
  action?: () => void;
  actionLabel?: string;
  description: string;
  icon: string;
  title: string;
}) {
  return (
    <div className="empty-state">
      <span aria-hidden="true">{icon}</span>
      <div>
        <b>{title}</b>
        <small>{description}</small>
      </div>
      {action && actionLabel && (
        <button
          className="button secondary"
          onClick={action}
          type="button"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function formatMarkerQuantity(value: number): string {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 6,
  });
}



function krakenStreamInterval(
  interval: LiveMarketInterval,
): number {
  if (interval === "1min") return 1;
  if (interval === "5min") return 5;
  if (interval === "1h") return 60;
  return 1_440;
}

function parseKrakenStreamCandle(
  update: NonNullable<KrakenOhlcMessage["data"]>[number],
): Candle | null {
  const time = update.interval_begin
    ? Math.floor(Date.parse(update.interval_begin) / 1000)
    : Number.NaN;
  const candle = {
    time,
    open: Number(update.open),
    high: Number(update.high),
    low: Number(update.low),
    close: Number(update.close),
  };

  return Object.values(candle).every(
    (value) => Number.isFinite(value) && value > 0,
  )
    ? candle
    : null;
}

function mergeStreamingCandle(
  candles: Candle[],
  update: Candle,
): Candle[] {
  const existingIndex = candles.findIndex(
    (candle) => candle.time === update.time,
  );

  if (existingIndex >= 0) {
    const next = [...candles];
    next[existingIndex] = update;
    return next;
  }

  return [...candles, update]
    .sort((left, right) => left.time - right.time)
    .slice(-720);
}

function formatPrice(value: number | undefined, decimals: number) {
  return value === undefined
    ? "—"
    : value.toLocaleString("en-US", {
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals,
      });
}

function timeframeLabel(interval: LiveMarketInterval) {
  return (
    timeframeOptions.find((option) => option.value === interval)?.label ??
    interval
  );
}

function showDefaultChartRange(
  chart: IChartApi | null,
  candleCount: number,
) {
  if (!chart || candleCount <= 0) {
    return;
  }

  const visibleBars = Math.min(72, candleCount);
  chart.timeScale().setVisibleLogicalRange({
    from: Math.max(0, candleCount - visibleBars),
    to: candleCount + 5,
  });
}

function movingAverage(candles: Candle[], period: number) {
  return candles.flatMap((candle, index) => {
    if (index < period - 1) {
      return [];
    }

    const window = candles.slice(index - period + 1, index + 1);
    const value =
      window.reduce((sum, item) => sum + item.close, 0) / period;

    return [{ time: candle.time, value }];
  });
}
