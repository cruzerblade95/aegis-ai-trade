import { env } from "cloudflare:workers";

export const supportedLearningMarkets = [
  { symbol: "BTCUSD", label: "BTC/USD", name: "Bitcoin" },
  { symbol: "ETHUSD", label: "ETH/USD", name: "Ethereum" },
  { symbol: "SOLUSD", label: "SOL/USD", name: "Solana" },
  {
    symbol: "XAUUSD",
    label: "XAU/USD",
    name: "Gold",
    providerDependent: true,
  },
] as const;

export type LearningMarketSymbol =
  (typeof supportedLearningMarkets)[number]["symbol"];

export type EducationalAlert = {
  id: string;
  marketSymbol: LearningMarketSymbol;
  direction: "above" | "below";
  threshold: number;
  isEnabled: boolean;
  createdAt: number;
};

type WatchlistRow = {
  market_symbol: string;
};

type AlertRow = {
  id: string;
  market_symbol: string;
  direction: string;
  threshold: string;
  is_enabled: number;
  created_at: number;
};

export function isLearningMarketSymbol(
  value: string,
): value is LearningMarketSymbol {
  return supportedLearningMarkets.some(
    (market) => market.symbol === value,
  );
}

export async function getMarketLearningPreferences(userId: string) {
  const database = getDatabase();
  const [watchlistResult, alertResult] = await Promise.all([
    database
      .prepare(
        `
          SELECT market_symbol
          FROM user_watchlist_items
          WHERE user_id = ?
          ORDER BY created_at ASC
        `,
      )
      .bind(userId)
      .all<WatchlistRow>(),
    database
      .prepare(
        `
          SELECT
            id,
            market_symbol,
            direction,
            threshold,
            is_enabled,
            created_at
          FROM educational_price_alerts
          WHERE user_id = ?
          ORDER BY created_at DESC
          LIMIT 50
        `,
      )
      .bind(userId)
      .all<AlertRow>(),
  ]);

  const watchlist = watchlistResult.results
    .map((row) => row.market_symbol)
    .filter(isLearningMarketSymbol);

  const alerts = alertResult.results.flatMap((row) => {
    if (
      !isLearningMarketSymbol(row.market_symbol) ||
      (row.direction !== "above" && row.direction !== "below")
    ) {
      return [];
    }

    const threshold = Number(row.threshold);

    if (!Number.isFinite(threshold)) {
      return [];
    }

    return [
      {
        id: row.id,
        marketSymbol: row.market_symbol,
        direction: row.direction,
        threshold,
        isEnabled: row.is_enabled === 1,
        createdAt: row.created_at,
      } satisfies EducationalAlert,
    ];
  });

  return { alerts, watchlist };
}

export async function setWatchlistMembership(
  userId: string,
  marketSymbol: LearningMarketSymbol,
  shouldWatch: boolean,
) {
  const database = getDatabase();

  if (shouldWatch) {
    await database
      .prepare(
        `
          INSERT OR IGNORE INTO user_watchlist_items (
            user_id,
            market_symbol,
            created_at
          )
          VALUES (?, ?, ?)
        `,
      )
      .bind(userId, marketSymbol, Date.now())
      .run();
    return;
  }

  await database
    .prepare(
      `
        DELETE FROM user_watchlist_items
        WHERE user_id = ? AND market_symbol = ?
      `,
    )
    .bind(userId, marketSymbol)
    .run();
}

export async function createEducationalPriceAlert(
  userId: string,
  marketSymbol: LearningMarketSymbol,
  direction: "above" | "below",
  threshold: number,
) {
  await getDatabase()
    .prepare(
      `
        INSERT INTO educational_price_alerts (
          id,
          user_id,
          market_symbol,
          direction,
          threshold,
          is_enabled,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)
      `,
    )
    .bind(
      crypto.randomUUID(),
      userId,
      marketSymbol,
      direction,
      String(threshold),
      Date.now(),
      Date.now(),
    )
    .run();
}

export async function setEducationalAlertEnabled(
  userId: string,
  alertId: string,
  enabled: boolean,
) {
  await getDatabase()
    .prepare(
      `
        UPDATE educational_price_alerts
        SET is_enabled = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
      `,
    )
    .bind(enabled ? 1 : 0, Date.now(), alertId, userId)
    .run();
}

export async function deleteEducationalAlert(
  userId: string,
  alertId: string,
) {
  await getDatabase()
    .prepare(
      `
        DELETE FROM educational_price_alerts
        WHERE id = ? AND user_id = ?
      `,
    )
    .bind(alertId, userId)
    .run();
}

function getDatabase(): D1Database {
  return env.DB;
}
