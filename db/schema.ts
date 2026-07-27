import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

/**
 * Main application users.
 *
 * Authentication credentials are not stored here. ChatGPT authentication
 * identifies the user through trusted server-side headers.
 */
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),

    role: text("role", {
      enum: ["user", "admin"],
    })
      .notNull()
      .default("user"),

    status: text("status", {
      enum: ["active", "review", "suspended"],
    })
      .notNull()
      .default("active"),

    emailVerifiedAt: integer("email_verified_at", {
      mode: "timestamp_ms",
    }),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email),
    index("users_role_idx").on(table.role),
    index("users_status_idx").on(table.status),
  ],
);

/**
 * Stores password authentication information separately from user profiles.
 *
 * Password hashes and salts are generated using PBKDF2-SHA-256.
 * Plaintext passwords must never be stored.
 */
export const userCredentials = sqliteTable(
  "user_credentials",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    passwordHash: text("password_hash").notNull(),
    passwordSalt: text("password_salt").notNull(),

    passwordIterations: integer("password_iterations")
      .notNull()
      .default(600000),

    passwordUpdatedAt: integer("password_updated_at").notNull(),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
);

/**
 * Stores revocable server-side login sessions.
 *
 * Only the SHA-256 hash of the session token is stored in D1.
 */
export const userSessions = sqliteTable(
  "user_sessions",
  {
    id: text("id").primaryKey(),

    userId: text("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    tokenHash: text("token_hash").notNull(),

    expiresAt: integer("expires_at").notNull(),
    lastSeenAt: integer("last_seen_at").notNull(),

    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("user_sessions_token_hash_idx").on(
      table.tokenHash,
    ),
    index("user_sessions_user_expires_idx").on(
      table.userId,
      table.expiresAt,
    ),
  ],
);

/**
 * Educational AI plan catalogue.
 *
 * Prices and credits remain simulated in v0.2.0.
 */
export const plans = sqliteTable(
  "plans",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),

    monthlyVirtualCredits: integer("monthly_virtual_credits")
      .notNull()
      .default(0),

    priceMinor: integer("price_minor").notNull().default(0),
    currency: text("currency").notNull().default("USD"),

    isActive: integer("is_active", {
      mode: "boolean",
    })
      .notNull()
      .default(true),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("plans_code_unique").on(table.code),
    index("plans_active_idx").on(table.isActive),
  ],
);

/**
 * Connects a user to an educational plan.
 */
export const subscriptions = sqliteTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),

    userId: text("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    planId: text("plan_id")
      .notNull()
      .references(() => plans.id, {
        onDelete: "restrict",
      }),

    status: text("status", {
      enum: ["active", "cancelled", "expired"],
    })
      .notNull()
      .default("active"),

    startedAt: integer("started_at", {
      mode: "timestamp_ms",
    }).notNull(),

    endsAt: integer("ends_at", {
      mode: "timestamp_ms",
    }),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("subscriptions_active_user_unique").on(table.userId),
    index("subscriptions_plan_idx").on(table.planId),
    index("subscriptions_status_idx").on(table.status),
  ],
);

/**
 * Simulated wallet. It cannot hold or transfer real money.
 *
 * balanceMinor stores virtual cents:
 * 10000 = 100.00 virtual USD.
 */
export const virtualWallets = sqliteTable(
  "virtual_wallets",
  {
    id: text("id").primaryKey(),

    userId: text("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    currency: text("currency").notNull().default("USD"),

    balanceMinor: integer("balance_minor")
      .notNull()
      .default(10_000_000),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("virtual_wallet_user_currency_unique").on(
      table.userId,
      table.currency,
    ),
  ],
);

/**
 * Immutable history of simulated wallet changes.
 */
export const virtualLedgerEntries = sqliteTable(
  "virtual_ledger_entries",
  {
    id: text("id").primaryKey(),

    walletId: text("wallet_id")
      .notNull()
      .references(() => virtualWallets.id, {
        onDelete: "cascade",
      }),

    type: text("type", {
      enum: [
        "opening_balance",
        "virtual_deposit",
        "virtual_withdrawal",
        "plan_purchase",
        "paper_trade",
        "adjustment",
      ],
    }).notNull(),

    amountMinor: integer("amount_minor").notNull(),
    balanceAfterMinor: integer("balance_after_minor").notNull(),

    referenceId: text("reference_id"),
    note: text("note"),

    createdAt: createdAt(),
  },
  (table) => [
    index("virtual_ledger_wallet_created_idx").on(
      table.walletId,
      table.createdAt,
    ),
    index("virtual_ledger_reference_idx").on(table.referenceId),
  ],
);

/**
 * Simulated trade records only.
 */
export const paperTrades = sqliteTable(
  "paper_trades",
  {
    id: text("id").primaryKey(),

    userId: text("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    marketSymbol: text("market_symbol").notNull(),

    side: text("side", {
      enum: ["buy", "sell"],
    }).notNull(),

    status: text("status", {
      enum: ["open", "closed", "cancelled"],
    })
      .notNull()
      .default("open"),

    quantity: text("quantity").notNull(),
    entryPrice: text("entry_price").notNull(),
    exitPrice: text("exit_price"),

    openedAt: integer("opened_at", {
      mode: "timestamp_ms",
    }).notNull(),

    closedAt: integer("closed_at", {
      mode: "timestamp_ms",
    }),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("paper_trades_user_status_idx").on(
      table.userId,
      table.status,
    ),
    index("paper_trades_market_idx").on(table.marketSymbol),
  ],
);

/**
 * Learning journal attached to optional paper trades.
 */
export const tradeJournalEntries = sqliteTable(
  "trade_journal_entries",
  {
    id: text("id").primaryKey(),

    userId: text("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    paperTradeId: text("paper_trade_id").references(
      () => paperTrades.id,
      {
        onDelete: "set null",
      },
    ),

    title: text("title").notNull(),
    thesis: text("thesis").notNull(),
    riskNotes: text("risk_notes").notNull(),
    reflection: text("reflection"),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("trade_journal_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    index("trade_journal_trade_idx").on(table.paperTradeId),
  ],
);

/**
 * Stores educational AI explanations for later review.
 */
export const aiExplanationHistory = sqliteTable(
  "ai_explanation_history",
  {
    id: text("id").primaryKey(),

    userId: text("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    marketSymbol: text("market_symbol").notNull(),
    prompt: text("prompt").notNull(),
    explanation: text("explanation").notNull(),

    riskLevel: text("risk_level", {
      enum: ["low", "moderate", "high"],
    }).notNull(),

    model: text("model").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("ai_history_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    index("ai_history_market_idx").on(table.marketSymbol),
  ],
);

/**
 * Records sensitive admin actions.
 */
export const adminAuditLogs = sqliteTable(
  "admin_audit_logs",
  {
    id: text("id").primaryKey(),

    actorUserId: text("actor_user_id").references(
      () => users.id,
      {
        onDelete: "set null",
      },
    ),

    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),

    metadataJson: text("metadata_json")
      .notNull()
      .default("{}"),

    createdAt: createdAt(),
  },
  (table) => [
    index("admin_audit_actor_created_idx").on(
      table.actorUserId,
      table.createdAt,
    ),
    index("admin_audit_target_idx").on(
      table.targetType,
      table.targetId,
    ),
  ],
);