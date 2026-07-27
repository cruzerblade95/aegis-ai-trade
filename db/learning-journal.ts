import { env } from "cloudflare:workers";
import {
  isLearningMarketSymbol,
  type LearningMarketSymbol,
} from "./market-watchlist";

export const learningJournalTimeframes = [
  "1min",
  "5min",
  "1h",
  "1day",
] as const;

export type LearningJournalTimeframe =
  (typeof learningJournalTimeframes)[number];

export type LearningJournalEntry = {
  id: string;
  marketSymbol: LearningMarketSymbol;
  timeframe: LearningJournalTimeframe;
  title: string;
  observation: string;
  riskNotes: string;
  reflection: string | null;
  createdAt: number;
  updatedAt: number;
};

type LearningJournalRow = {
  id: string;
  market_symbol: string;
  timeframe: string;
  title: string;
  thesis: string;
  risk_notes: string;
  reflection: string | null;
  created_at: number;
  updated_at: number;
};

export function isLearningJournalTimeframe(
  value: string,
): value is LearningJournalTimeframe {
  return learningJournalTimeframes.includes(
    value as LearningJournalTimeframe,
  );
}

export async function getLearningJournalEntries(
  userId: string,
): Promise<LearningJournalEntry[]> {
  const result = await getDatabase()
    .prepare(
      `
        SELECT
          id,
          market_symbol,
          timeframe,
          title,
          thesis,
          risk_notes,
          reflection,
          created_at,
          updated_at
        FROM trade_journal_entries
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 100
      `,
    )
    .bind(userId)
    .all<LearningJournalRow>();

  return result.results.flatMap((row) => {
    if (
      !isLearningMarketSymbol(row.market_symbol) ||
      !isLearningJournalTimeframe(row.timeframe)
    ) {
      return [];
    }

    return [
      {
        id: row.id,
        marketSymbol: row.market_symbol,
        timeframe: row.timeframe,
        title: row.title,
        observation: row.thesis,
        riskNotes: row.risk_notes,
        reflection: row.reflection,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    ];
  });
}

export async function createLearningJournalEntry(
  userId: string,
  entry: Omit<
    LearningJournalEntry,
    "id" | "createdAt" | "updatedAt"
  >,
) {
  const now = Date.now();

  await getDatabase()
    .prepare(
      `
        INSERT INTO trade_journal_entries (
          id,
          user_id,
          paper_trade_id,
          market_symbol,
          timeframe,
          title,
          thesis,
          risk_notes,
          reflection,
          created_at,
          updated_at
        )
        VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .bind(
      crypto.randomUUID(),
      userId,
      entry.marketSymbol,
      entry.timeframe,
      entry.title,
      entry.observation,
      entry.riskNotes,
      entry.reflection,
      now,
      now,
    )
    .run();
}

export async function updateLearningJournalEntry(
  userId: string,
  entryId: string,
  entry: Omit<
    LearningJournalEntry,
    "id" | "createdAt" | "updatedAt"
  >,
) {
  await getDatabase()
    .prepare(
      `
        UPDATE trade_journal_entries
        SET
          market_symbol = ?,
          timeframe = ?,
          title = ?,
          thesis = ?,
          risk_notes = ?,
          reflection = ?,
          updated_at = ?
        WHERE id = ? AND user_id = ?
      `,
    )
    .bind(
      entry.marketSymbol,
      entry.timeframe,
      entry.title,
      entry.observation,
      entry.riskNotes,
      entry.reflection,
      Date.now(),
      entryId,
      userId,
    )
    .run();
}

export async function deleteLearningJournalEntry(
  userId: string,
  entryId: string,
) {
  await getDatabase()
    .prepare(
      `
        DELETE FROM trade_journal_entries
        WHERE id = ? AND user_id = ?
      `,
    )
    .bind(entryId, userId)
    .run();
}

function getDatabase(): D1Database {
  return env.DB;
}
