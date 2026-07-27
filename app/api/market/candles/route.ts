import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

const symbols = {
  BTCUSD: "BTC/USD",
  ETHUSD: "ETH/USD",
  SOLUSD: "SOL/USD",
  XAUUSD: "XAU/USD",
} as const;

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

const intervals = new Set(["1min", "5min", "1h", "1day"]);
const allSymbols = Object.keys(symbols);
const krakenSymbols = Object.keys(krakenPairs);

type ProviderName = "kraken" | "twelve_data";

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

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

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const symbolKey = requestUrl.searchParams.get("symbol") ?? "BTCUSD";
  const interval = requestUrl.searchParams.get("interval") ?? "5min";
  const providerSymbol = symbols[symbolKey as keyof typeof symbols];

  if (!providerSymbol) {
    return Response.json(
      { error: "Unsupported market symbol." },
      { status: 400 },
    );
  }

  if (!intervals.has(interval)) {
    return Response.json(
      { error: "Unsupported chart interval." },
      { status: 400 },
    );
  }

  const runtimeEnv = env as unknown as RuntimeEnv;
  const provider = resolveProvider(runtimeEnv.MARKET_DATA_PROVIDER);

  if (!provider) {
    return Response.json(
      {
        error:
          "MARKET_DATA_PROVIDER must be either kraken or twelve_data.",
      },
      { status: 503 },
    );
  }

  const availableSymbols =
    provider === "kraken" ? krakenSymbols : allSymbols;

  if (!availableSymbols.includes(symbolKey)) {
    return Response.json(
      {
        availableSymbols,
        error:
          "Gold is unavailable while Kraken is selected. Change MARKET_DATA_PROVIDER to twelve_data to enable XAU/USD.",
        provider,
        source: "Kraken",
        unavailable: true,
      },
      { status: 400 },
    );
  }

  try {
    const result =
      provider === "kraken"
        ? await fetchKrakenCandles(symbolKey, interval)
        : await fetchTwelveDataCandles(
            providerSymbol,
            interval,
            runtimeEnv.TWELVE_DATA_API_KEY,
          );

    return Response.json(
      {
        availableSymbols,
        candles: result.candles,
        displaySymbol: providerSymbol,
        fetchedAt: new Date().toISOString(),
        interval,
        provider,
        source: result.source,
        symbol: symbolKey,
      },
      {
        headers: {
          "Cache-Control":
            "public, max-age=15, stale-while-revalidate=30",
        },
      },
    );
  } catch (error) {
    return Response.json(
      {
        availableSymbols,
        error:
          error instanceof Error
            ? error.message
            : "Unable to contact the live market-data provider.",
        provider,
        source: provider === "kraken" ? "Kraken" : "Twelve Data",
      },
      { status: 502 },
    );
  }
}

function resolveProvider(value: string | undefined): ProviderName | null {
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
  symbolKey: string,
  interval: string,
): Promise<{ candles: Candle[]; source: string }> {
  const pair = krakenPairs[symbolKey as keyof typeof krakenPairs];
  const providerInterval =
    krakenIntervals[interval as keyof typeof krakenIntervals];
  const providerUrl = new URL(
    "https://api.kraken.com/0/public/OHLC",
  );
  providerUrl.searchParams.set("pair", pair);
  providerUrl.searchParams.set(
    "interval",
    String(providerInterval),
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
    .filter((candle): candle is Candle => candle !== null)
    .sort((left, right) => left.time - right.time);

  if (candles.length === 0) {
    throw new Error("Kraken returned no usable candles.");
  }

  return { candles, source: "Kraken" };
}

async function fetchTwelveDataCandles(
  providerSymbol: string,
  interval: string,
  key: string | undefined,
): Promise<{ candles: Candle[]; source: string }> {
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

function parseKrakenCandle(value: unknown): Candle | null {
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

function isValidCandle(candle: Candle) {
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
