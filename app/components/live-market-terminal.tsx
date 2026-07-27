"use client";

import {
  CandlestickSeries,
  ColorType,
  LineSeries,
  createChart,
  type IChartApi,
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
type Interval = "1min" | "5min" | "1h" | "1day";
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

const timeframeOptions: Array<{
  label: string;
  value: Interval;
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
}: {
  balance?: number;
  compact?: boolean;
  onOpen?: () => void;
  selectedKey: MarketKey;
  onMarketChange: (market: MarketKey) => void;
  onAvailabilityChange?: (markets: MarketKey[]) => void;
}) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef =
    useRef<ISeriesApi<"Candlestick"> | null>(null);
  const averageSeriesRef =
    useRef<ISeriesApi<"Line"> | null>(null);
  const fitNextDataRef = useRef(true);

  const [interval, setInterval] = useState<Interval>("5min");
  const [activeTab, setActiveTab] =
    useState<WorkspaceTab>("positions");
  const [showAverage, setShowAverage] = useState(false);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
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
      height: compact ? 245 : 310,
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
        borderColor: "#163540",
        secondsVisible: false,
        timeVisible: true,
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
      chartRef.current?.timeScale().fitContent();
      fitNextDataRef.current = false;
    }
  }, [candles]);

  useEffect(() => {
    averageSeriesRef.current?.applyOptions({
      visible: showAverage,
    });
  }, [showAverage]);

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
    selectedKey,
    selectedMarket.label,
  ]);

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
        : "Live data connected";

  const journalPlaceholder = useMemo(
    () =>
      `Write an observation about ${selectedMarket.label} on the ${timeframeLabel(interval)} chart…`,
    [interval, selectedMarket.label],
  );

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

        <span className="paper-pill">READ ONLY</span>

        <div className="mini-balance">
          <small>Virtual learning balance</small>
          <b>{balance.toLocaleString()} USD</b>
        </div>
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

      <div
        aria-label="Market workspace panels"
        className="terminal-tabs"
        role="tablist"
      >
        {tabOptions.map((tab) => (
          <button
            aria-controls={`terminal-panel-${tab.value}`}
            aria-selected={activeTab === tab.value}
            className={activeTab === tab.value ? "active" : undefined}
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
              onChange={(event) => setJournalDraft(event.target.value)}
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

function formatPrice(value: number | undefined, decimals: number) {
  return value === undefined
    ? "—"
    : value.toLocaleString("en-US", {
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals,
      });
}

function timeframeLabel(interval: Interval) {
  return (
    timeframeOptions.find((option) => option.value === interval)?.label ??
    interval
  );
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
