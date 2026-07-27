import {
  getMarketSnapshot,
  isMarketInterval,
  isMarketSymbol,
  MarketUnavailableError,
} from "../../../../lib/market-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const symbol = requestUrl.searchParams.get("symbol") ?? "BTCUSD";
  const interval = requestUrl.searchParams.get("interval") ?? "5min";

  if (!isMarketSymbol(symbol)) {
    return Response.json(
      { error: "Unsupported market symbol." },
      { status: 400 },
    );
  }

  if (!isMarketInterval(interval)) {
    return Response.json(
      { error: "Unsupported chart interval." },
      { status: 400 },
    );
  }

  try {
    const snapshot = await getMarketSnapshot(symbol, interval);

    return Response.json(snapshot, {
      headers: {
        "Cache-Control":
          "public, max-age=15, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    if (error instanceof MarketUnavailableError) {
      return Response.json(
        {
          availableSymbols: error.availableSymbols,
          error: error.message,
          provider: error.provider,
          source:
            error.provider === "kraken" ? "Kraken" : "Twelve Data",
          unavailable: true,
        },
        { status: 400 },
      );
    }

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to contact the live market-data provider.",
      },
      { status: 502 },
    );
  }
}
