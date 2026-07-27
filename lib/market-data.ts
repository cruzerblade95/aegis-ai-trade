import { env } from "cloudflare:workers";

export const marketSymbols = {
  BTCUSD: "BTC/USD",
  ETHUSD: "ETH/USD",
  SOLUSD: "SOL/USD",
  XAUUSD: "XAU/USD",
} as const;

export type MarketSymbol = keyof typeof marketSymbols;
export type MarketInterval = "1min" | "5min" | "1h" | "1day";
export type MarketProvider = "kraken" | "twelve_data";

export type MarketCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type MarketSnapshot = {
  availableSymbols: MarketSymbol[];
  candles: MarketCandle[];
  displaySymbol: string;
  fetchedAt: string;
  interval: MarketInterval;
  provider: MarketProvider;
  source: string;
  symbol: MarketSymbol;
};

const krakenPairs = {
  BTCUSD: "XBTUSD",
  ETHUSD: "ETHUSD",
  SOLUSD: "SOLUSD",
} as const;

const krakenIntervals = {
  "1min": 1,
  "5min": 5,
  "1h": 60,
  "1day": 1440,
} as const;

const supportedIntervals = new Set<MarketInterval>([
  "1min",
  "5min",
  "1h",
  "1day",
]);

type TwelveDataValue = {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
};

type TwelveDataResponse = {
  message?: string;
  status?: string;
  values?: TwelveDataValue[];
};

type KrakenResponse = {
  error?: string[];
  result?: Record<string, unknown>;
};

type RuntimeEnv = {
  MARKET_DATA_PROVIDER?: string;
  TWELVE_DATA_API_KEY?: string;
};

export function isMarketSymbol(value: string): value is MarketSymbol {
  return value in marketSymbols;
}

export function isMarketInterval(
  value: string,
): value is MarketInterval {
  return supportedIntervals.has(value as MarketInterval);
}

export async function getMarketSnapshot(
  symbol: MarketSymbol,
  interval: MarketInterval,
): Promise<MarketSnapshot> {
  const runtimeEnv = env as unknown as RuntimeEnv;
  const provider = resolveProvider(runtimeEnv.MARKET_DATA_PROVIDER);

  if (!provider) {
    throw new Error(
      "MARKET_DATA_PROVIDER must be either kraken or twelve_data.",
    );
  }

  const availableSymbols =
    provider === "kraken"
      ? (Object.keys(krakenPairs) as MarketSymbol[])
      : (Object.keys(marketSymbols) as MarketSymbol[]);

  if (!availableSymbols.includes(symbol)) {
    throw new MarketUnavailableError(
      "Gold is unavailable while Kraken is selected. Change MARKET_DATA_PROVIDER to twelve_data to enable XAU/USD.",
      availableSymbols,
      provider,
    );
  }

  const result =
    provider === "kraken"
      ? await fetchKrakenCandles(symbol, interval)
      : await fetchTwelveDataCandles(
          marketSymbols[symbol],
          interval,
          runtimeEnv.TWELVE_DATA_API_KEY,
        );

  return {
    availableSymbols,
    candles: result.candles,
    displaySymbol: marketSymbols[symbol],
    fetchedAt: new Date().toISOString(),
    interval,
    provider,
    source: result.source,
    symbol,
  };
}

export async function getLatestMarketPrice(
  symbol: MarketSymbol,
): Promise<{
  fetchedAt: string;
  price: number;
  provider: MarketProvider;
  source: string;
}> {
  const snapshot = await getMarketSnapshot(symbol, "1min");
  const latest = snapshot.candles.at(-1);

  if (!latest || !Number.isFinite(latest.close) || latest.close <= 0) {
    throw new Error("The live provider returned no usable market price.");
  }

  return {
    fetchedAt: snapshot.fetchedAt,
    price: latest.close,
    provider: snapshot.provider,
    source: snapshot.source,
  };
}

export class MarketUnavailableError extends Error {
  constructor(
    message: string,
    public readonly availableSymbols: MarketSymbol[],
    public readonly provider: MarketProvider,
  ) {
    super(message);
    this.name = "MarketUnavailableError";
  }
}

function resolveProvider(
  value: string | undefined,
): MarketProvider | null {
  const normalized = (value ?? "kraken")
    .trim()
    .toLowerCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");

  if (normalized === "kraken") {
    return "kraken";
  }

  if (
    normalized === "twelve_data" ||
    normalized === "twelvedata"
  ) {
    return "twelve_data";
  }

  return null;
}

async function fetchKrakenCandles(
  symbol: MarketSymbol,
  interval: MarketInterval,
): Promise<{ candles: MarketCandle[]; source: string }> {
  if (!(symbol in krakenPairs)) {
    throw new Error("Kraken does not provide this Aegis market.");
  }

  const pair = krakenPairs[symbol as keyof typeof krakenPairs];
  const providerUrl = new URL(
    "https://api.kraken.com/0/public/OHLC",
  );
  providerUrl.searchParams.set("pair", pair);
  providerUrl.searchParams.set(
    "interval",
    String(krakenIntervals[interval]),
  );

  const response = await fetch(providerUrl, {
    headers: { Accept: "application/json" },
  });
  const data = (await response.json()) as KrakenResponse;

  if (!response.ok || (data.error?.length ?? 0) > 0 || !data.result) {
    throw new Error(
      data.error?.join(", ") ||
        "Kraken rejected this market-data request.",
    );
  }

  const candleRows = Object.entries(data.result).find(
    ([key, value]) => key !== "last" && Array.isArray(value),
  )?.[1];

  if (!Array.isArray(candleRows)) {
    throw new Error("Kraken returned no OHLC candle series.");
  }

  const candles = candleRows
    .map((row) => parseKrakenCandle(row))
    .filter((candle): candle is MarketCandle => candle !== null)
    .sort((left, right) => left.time - right.time);

  if (candles.length === 0) {
    throw new Error("Kraken returned no usable candles.");
  }

  return { candles, source: "Kraken" };
}

async function fetchTwelveDataCandles(
  providerSymbol: string,
  interval: MarketInterval,
  key: string | undefined,
): Promise<{ candles: MarketCandle[]; source: string }> {
  const apiKey = key?.trim();

  if (!apiKey) {
    throw new Error(
      "Twelve Data is selected but TWELVE_DATA_API_KEY is missing from .dev.vars.",
    );
  }

  const providerUrl = new URL(
    "https://api.twelvedata.com/time_series",
  );
  providerUrl.searchParams.set("symbol", providerSymbol);
  providerUrl.searchParams.set("interval", interval);
  providerUrl.searchParams.set("outputsize", "180");
  providerUrl.searchParams.set("timezone", "UTC");
  providerUrl.searchParams.set("order", "ASC");
  providerUrl.searchParams.set("apikey", apiKey);

  const response = await fetch(providerUrl, {
    headers: { Accept: "application/json" },
  });
  const data = (await response.json()) as TwelveDataResponse;

  if (
    !response.ok ||
    data.status === "error" ||
    !Array.isArray(data.values)
  ) {
    throw new Error(
      data.message ??
        "Twelve Data rejected this market-data request.",
    );
  }

  const candles = data.values
    .map((value) => ({
      time: parseTwelveDataTime(value.datetime),
      open: Number(value.open),
      high: Number(value.high),
      low: Number(value.low),
      close: Number(value.close),
    }))
    .filter(isValidCandle)
    .sort((left, right) => left.time - right.time);

  if (candles.length === 0) {
    throw new Error("Twelve Data returned no usable candles.");
  }

  return { candles, source: "Twelve Data" };
}

function parseKrakenCandle(value: unknown): MarketCandle | null {
  if (!Array.isArray(value) || value.length < 5) {
    return null;
  }

  const candle = {
    time: Number(value[0]),
    open: Number(value[1]),
    high: Number(value[2]),
    low: Number(value[3]),
    close: Number(value[4]),
  };

  return isValidCandle(candle) ? candle : null;
}

function isValidCandle(candle: MarketCandle) {
  return (
    Number.isFinite(candle.time) &&
    Number.isFinite(candle.open) &&
    Number.isFinite(candle.high) &&
    Number.isFinite(candle.low) &&
    Number.isFinite(candle.close)
  );
}

function parseTwelveDataTime(datetime: string): number {
  const isoValue = datetime.includes(" ")
    ? `${datetime.replace(" ", "T")}Z`
    : `${datetime}T00:00:00Z`;

  return Math.floor(Date.parse(isoValue) / 1000);
}
