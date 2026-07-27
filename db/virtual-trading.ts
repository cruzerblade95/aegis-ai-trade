import {
  getLatestMarketPrice,
  isMarketSymbol,
  type MarketSymbol,
} from "../lib/market-data";
import { getLearningJournalEntries } from "./learning-journal";
import { getD1 } from "./index";

export type VirtualOrderSide = "buy" | "sell";
export type VirtualOrderType = "market" | "limit";
export type VirtualOrderStatus =
  | "pending"
  | "filled"
  | "cancelled"
  | "rejected";

export type VirtualTradingOrder = {
  id: string;
  marketSymbol: MarketSymbol;
  side: VirtualOrderSide;
  orderType: VirtualOrderType;
  quantity: number;
  limitPrice: number | null;
  executedPrice: number | null;
  quoteAmountMinor: number | null;
  reservedQuoteMinor: number;
  status: VirtualOrderStatus;
  createdAt: number;
  filledAt: number | null;
  cancelledAt: number | null;
};

export type VirtualTradingPosition = {
  marketSymbol: MarketSymbol;
  quantity: number;
  availableQuantity: number;
  averageEntryPrice: number;
  realizedPnlMinor: number;
};

export type VirtualTradingState = {
  environment: "virtual";
  wallet: {
    id: string;
    currency: "USD";
    balanceMinor: number;
  };
  positions: VirtualTradingPosition[];
  orders: VirtualTradingOrder[];
  history: VirtualTradingOrder[];
  journalEntries: Awaited<
    ReturnType<typeof getLearningJournalEntries>
  >;
};

type WalletRow = {
  id: string;
  currency: string;
  balanceMinor: number;
};

type PositionRow = {
  marketSymbol: string;
  quantity: string;
  averageEntryPrice: string;
  realizedPnlMinor: number;
};

type OrderRow = {
  id: string;
  marketSymbol: string;
  side: VirtualOrderSide;
  orderType: VirtualOrderType;
  quantity: string;
  limitPrice: string | null;
  executedPrice: string | null;
  quoteAmountMinor: number | null;
  reservedQuoteMinor: number;
  status: VirtualOrderStatus;
  createdAt: number;
  filledAt: number | null;
  cancelledAt: number | null;
};

export class VirtualTradingError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "VirtualTradingError";
  }
}

export async function getVirtualTradingState(
  userId: string,
): Promise<VirtualTradingState> {
  const database = getD1();
  const wallet = await ensureVirtualWallet(userId);

  const [positionsResult, ordersResult, reservedSells, journalEntries] =
    await Promise.all([
      database
        .prepare(
          `SELECT
            market_symbol AS marketSymbol,
            quantity,
            average_entry_price AS averageEntryPrice,
            realized_pnl_minor AS realizedPnlMinor
          FROM virtual_trade_positions
          WHERE user_id = ?
            AND CAST(quantity AS REAL) > 0
          ORDER BY updated_at DESC`,
        )
        .bind(userId)
        .all<PositionRow>(),
      database
        .prepare(
          `SELECT
            id,
            market_symbol AS marketSymbol,
            side,
            order_type AS orderType,
            quantity,
            limit_price AS limitPrice,
            executed_price AS executedPrice,
            quote_amount_minor AS quoteAmountMinor,
            reserved_quote_minor AS reservedQuoteMinor,
            status,
            created_at AS createdAt,
            filled_at AS filledAt,
            cancelled_at AS cancelledAt
          FROM virtual_trade_orders
          WHERE user_id = ?
          ORDER BY created_at DESC
          LIMIT 200`,
        )
        .bind(userId)
        .all<OrderRow>(),
      database
        .prepare(
          `SELECT
            market_symbol AS marketSymbol,
            COALESCE(SUM(CAST(quantity AS REAL)), 0)
              AS reservedQuantity
          FROM virtual_trade_orders
          WHERE user_id = ?
            AND side = 'sell'
            AND status = 'pending'
          GROUP BY market_symbol`,
        )
        .bind(userId)
        .all<{
          marketSymbol: string;
          reservedQuantity: number;
        }>(),
      getLearningJournalEntries(userId),
    ]);

  const reservedByMarket = new Map(
    reservedSells.results.map((row) => [
      row.marketSymbol,
      Number(row.reservedQuantity),
    ]),
  );

  const positions = positionsResult.results.flatMap((row) => {
    if (!isMarketSymbol(row.marketSymbol)) {
      return [];
    }

    const quantity = Number(row.quantity);
    const reserved = reservedByMarket.get(row.marketSymbol) ?? 0;

    return [
      {
        marketSymbol: row.marketSymbol,
        quantity,
        availableQuantity: Math.max(0, quantity - reserved),
        averageEntryPrice: Number(row.averageEntryPrice),
        realizedPnlMinor: row.realizedPnlMinor,
      },
    ];
  });

  const allOrders = ordersResult.results.flatMap(normalizeOrder);

  return {
    environment: "virtual",
    wallet: {
      id: wallet.id,
      currency: "USD",
      balanceMinor: wallet.balanceMinor,
    },
    positions,
    orders: allOrders.filter((order) => order.status === "pending"),
    history: allOrders.filter((order) => order.status !== "pending"),
    journalEntries,
  };
}

export async function placeVirtualOrder(
  userId: string,
  input: {
    marketSymbol: string;
    side: string;
    orderType: string;
    quantity: number;
    limitPrice?: number | null;
  },
): Promise<void> {
  const marketSymbol = readMarketSymbol(input.marketSymbol);
  const side = readSide(input.side);
  const orderType = readOrderType(input.orderType);
  const quantity = readPositiveNumber(
    input.quantity,
    "Enter a valid quantity.",
    1_000_000,
  );
  const limitPrice =
    orderType === "limit"
      ? readPositiveNumber(
          input.limitPrice,
          "Enter a valid limit price.",
          1_000_000_000,
        )
      : null;

  const quote = await getLatestMarketPrice(marketSymbol);
  const wallet = await ensureVirtualWallet(userId);
  const orderId = crypto.randomUUID();
  const now = Date.now();

  if (side === "buy") {
    const fillsImmediately =
      orderType === "market" ||
      (limitPrice !== null && quote.price <= limitPrice);

    if (fillsImmediately) {
      await fillImmediateBuy({
        userId,
        wallet,
        orderId,
        marketSymbol,
        orderType,
        quantity,
        limitPrice,
        executionPrice: quote.price,
        now,
      });
      return;
    }

    await placePendingBuy({
      userId,
      wallet,
      orderId,
      marketSymbol,
      quantity,
      limitPrice: limitPrice as number,
      now,
    });
    return;
  }

  const position = await getPosition(userId, marketSymbol);
  const availableQuantity = await getAvailableQuantity(
    userId,
    marketSymbol,
    position,
  );

  if (availableQuantity + Number.EPSILON < quantity) {
    throw new VirtualTradingError(
      `Only ${formatQuantity(availableQuantity)} ${assetCode(
        marketSymbol,
      )} is available to sell.`,
    );
  }

  const fillsImmediately =
    orderType === "market" ||
    (limitPrice !== null && quote.price >= limitPrice);

  if (fillsImmediately) {
    await fillImmediateSell({
      userId,
      wallet,
      position,
      orderId,
      marketSymbol,
      orderType,
      quantity,
      limitPrice,
      executionPrice: quote.price,
      now,
    });
    return;
  }

  await getD1()
    .prepare(
      `INSERT INTO virtual_trade_orders (
        id,
        user_id,
        market_symbol,
        side,
        order_type,
        quantity,
        limit_price,
        executed_price,
        quote_amount_minor,
        reserved_quote_minor,
        status,
        created_at
      )
      VALUES (?, ?, ?, 'sell', 'limit', ?, ?, NULL, NULL, 0, 'pending', ?)`,
    )
    .bind(
      orderId,
      userId,
      marketSymbol,
      serializeNumber(quantity),
      serializeNumber(limitPrice as number),
      now,
    )
    .run();
}

export async function cancelVirtualOrder(
  userId: string,
  orderId: string,
): Promise<void> {
  if (!orderId || orderId.length > 100) {
    throw new VirtualTradingError("Invalid virtual order.");
  }

  const database = getD1();
  const order = await database
    .prepare(
      `SELECT
        id,
        market_symbol AS marketSymbol,
        side,
        order_type AS orderType,
        quantity,
        limit_price AS limitPrice,
        executed_price AS executedPrice,
        quote_amount_minor AS quoteAmountMinor,
        reserved_quote_minor AS reservedQuoteMinor,
        status,
        created_at AS createdAt,
        filled_at AS filledAt,
        cancelled_at AS cancelledAt
      FROM virtual_trade_orders
      WHERE id = ? AND user_id = ?
      LIMIT 1`,
    )
    .bind(orderId, userId)
    .first<OrderRow>();

  if (!order || order.status !== "pending") {
    throw new VirtualTradingError(
      "This virtual order is no longer pending.",
      409,
    );
  }

  const now = Date.now();

  if (order.side === "buy" && order.reservedQuoteMinor > 0) {
    const wallet = await ensureVirtualWallet(userId);
    const balanceAfter =
      wallet.balanceMinor + order.reservedQuoteMinor;

    await database.batch([
      database
        .prepare(
          `UPDATE virtual_trade_orders
          SET status = 'cancelled', cancelled_at = ?
          WHERE id = ? AND user_id = ? AND status = 'pending'`,
        )
        .bind(now, orderId, userId),
      database
        .prepare(
          `UPDATE virtual_wallets
          SET balance_minor = ?, updated_at = ?
          WHERE id = ? AND user_id = ?`,
        )
        .bind(balanceAfter, now, wallet.id, userId),
      database
        .prepare(
          `INSERT INTO virtual_ledger_entries (
            id,
            wallet_id,
            type,
            amount_minor,
            balance_after_minor,
            reference_id,
            note,
            created_at
          )
          VALUES (?, ?, 'adjustment', ?, ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          wallet.id,
          order.reservedQuoteMinor,
          balanceAfter,
          orderId,
          "Released virtual USD from cancelled limit buy",
          now,
        ),
    ]);
    return;
  }

  await database
    .prepare(
      `UPDATE virtual_trade_orders
      SET status = 'cancelled', cancelled_at = ?
      WHERE id = ? AND user_id = ? AND status = 'pending'`,
    )
    .bind(now, orderId, userId)
    .run();
}

export async function closeVirtualPosition(
  userId: string,
  marketSymbolValue: string,
): Promise<void> {
  const marketSymbol = readMarketSymbol(marketSymbolValue);
  const position = await getPosition(userId, marketSymbol);
  const quantity = Number(position?.quantity ?? 0);

  if (!position || !Number.isFinite(quantity) || quantity <= 0) {
    throw new VirtualTradingError(
      "This virtual position is already closed.",
      409,
    );
  }

  const quote = await getLatestMarketPrice(marketSymbol);
  const wallet = await ensureVirtualWallet(userId);
  const now = Date.now();

  await fillImmediateSell({
    userId,
    wallet,
    position,
    orderId: crypto.randomUUID(),
    marketSymbol,
    orderType: "market",
    quantity,
    limitPrice: null,
    executionPrice: quote.price,
    now,
    cancelPendingSellOrders: true,
  });
}

export async function syncVirtualLimitOrders(
  userId: string,
): Promise<void> {
  const database = getD1();
  const pending = await database
    .prepare(
      `SELECT
        id,
        market_symbol AS marketSymbol,
        side,
        order_type AS orderType,
        quantity,
        limit_price AS limitPrice,
        executed_price AS executedPrice,
        quote_amount_minor AS quoteAmountMinor,
        reserved_quote_minor AS reservedQuoteMinor,
        status,
        created_at AS createdAt,
        filled_at AS filledAt,
        cancelled_at AS cancelledAt
      FROM virtual_trade_orders
      WHERE user_id = ?
        AND status = 'pending'
        AND order_type = 'limit'
      ORDER BY created_at ASC
      LIMIT 100`,
    )
    .bind(userId)
    .all<OrderRow>();

  const symbols = [
    ...new Set(
      pending.results
        .map((order) => order.marketSymbol)
        .filter(isMarketSymbol),
    ),
  ];

  const quotes = new Map<MarketSymbol, number>();

  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const quote = await getLatestMarketPrice(symbol);
        quotes.set(symbol, quote.price);
      } catch {
        // A provider failure leaves the limit order safely pending.
      }
    }),
  );

  for (const order of pending.results) {
    if (
      !isMarketSymbol(order.marketSymbol) ||
      order.limitPrice === null
    ) {
      continue;
    }

    const currentPrice = quotes.get(order.marketSymbol);
    const limitPrice = Number(order.limitPrice);

    if (!currentPrice || !Number.isFinite(limitPrice)) {
      continue;
    }

    const shouldFill =
      order.side === "buy"
        ? currentPrice <= limitPrice
        : currentPrice >= limitPrice;

    if (shouldFill) {
      await fillPendingOrder(userId, order, currentPrice);
    }
  }
}

async function ensureVirtualWallet(userId: string): Promise<WalletRow> {
  const database = getD1();
  const existing = await database
    .prepare(
      `SELECT
        id,
        currency,
        balance_minor AS balanceMinor
      FROM virtual_wallets
      WHERE user_id = ? AND currency = 'USD'
      LIMIT 1`,
    )
    .bind(userId)
    .first<WalletRow>();

  if (existing) {
    return existing;
  }

  const walletId = crypto.randomUUID();
  const ledgerId = crypto.randomUUID();
  const now = Date.now();
  const openingBalanceMinor = 10_000_000;

  await database.batch([
    database
      .prepare(
        `INSERT INTO virtual_wallets (
          id,
          user_id,
          currency,
          balance_minor,
          created_at,
          updated_at
        )
        VALUES (?, ?, 'USD', ?, ?, ?)`,
      )
      .bind(walletId, userId, openingBalanceMinor, now, now),
    database
      .prepare(
        `INSERT INTO virtual_ledger_entries (
          id,
          wallet_id,
          type,
          amount_minor,
          balance_after_minor,
          note,
          created_at
        )
        VALUES (?, ?, 'opening_balance', ?, ?, ?, ?)`,
      )
      .bind(
        ledgerId,
        walletId,
        openingBalanceMinor,
        openingBalanceMinor,
        "Initial virtual USD trading balance",
        now,
      ),
  ]);

  return {
    id: walletId,
    currency: "USD",
    balanceMinor: openingBalanceMinor,
  };
}

async function getPosition(
  userId: string,
  marketSymbol: MarketSymbol,
): Promise<PositionRow | null> {
  return (
    (await getD1()
      .prepare(
        `SELECT
          market_symbol AS marketSymbol,
          quantity,
          average_entry_price AS averageEntryPrice,
          realized_pnl_minor AS realizedPnlMinor
        FROM virtual_trade_positions
        WHERE user_id = ? AND market_symbol = ?
        LIMIT 1`,
      )
      .bind(userId, marketSymbol)
      .first<PositionRow>()) ?? null
  );
}

async function getAvailableQuantity(
  userId: string,
  marketSymbol: MarketSymbol,
  position: PositionRow | null,
): Promise<number> {
  const held = Number(position?.quantity ?? 0);
  const row = await getD1()
    .prepare(
      `SELECT
        COALESCE(SUM(CAST(quantity AS REAL)), 0) AS reserved
      FROM virtual_trade_orders
      WHERE user_id = ?
        AND market_symbol = ?
        AND side = 'sell'
        AND status = 'pending'`,
    )
    .bind(userId, marketSymbol)
    .first<{ reserved: number }>();

  return Math.max(0, held - Number(row?.reserved ?? 0));
}

async function fillImmediateBuy(input: {
  userId: string;
  wallet: WalletRow;
  orderId: string;
  marketSymbol: MarketSymbol;
  orderType: VirtualOrderType;
  quantity: number;
  limitPrice: number | null;
  executionPrice: number;
  now: number;
}) {
  const database = getD1();
  const costMinor = toMinorUnits(
    input.executionPrice * input.quantity,
  );

  if (costMinor > input.wallet.balanceMinor) {
    throw new VirtualTradingError(
      "Your virtual USD balance is too low for this order.",
    );
  }

  const position = await getPosition(
    input.userId,
    input.marketSymbol,
  );
  const previousQuantity = Number(position?.quantity ?? 0);
  const previousAverage = Number(position?.averageEntryPrice ?? 0);
  const nextQuantity = previousQuantity + input.quantity;
  const nextAverage =
    (previousQuantity * previousAverage +
      input.quantity * input.executionPrice) /
    nextQuantity;
  const balanceAfter = input.wallet.balanceMinor - costMinor;

  await database.batch([
    database
      .prepare(
        `UPDATE virtual_wallets
        SET balance_minor = ?, updated_at = ?
        WHERE id = ? AND user_id = ?`,
      )
      .bind(
        balanceAfter,
        input.now,
        input.wallet.id,
        input.userId,
      ),
    positionUpsertStatement(database, {
      userId: input.userId,
      marketSymbol: input.marketSymbol,
      quantity: nextQuantity,
      averageEntryPrice: nextAverage,
      realizedPnlMinor: position?.realizedPnlMinor ?? 0,
      now: input.now,
    }),
    database
      .prepare(
        `INSERT INTO virtual_trade_orders (
          id,
          user_id,
          market_symbol,
          side,
          order_type,
          quantity,
          limit_price,
          executed_price,
          quote_amount_minor,
          reserved_quote_minor,
          status,
          created_at,
          filled_at
        )
        VALUES (?, ?, ?, 'buy', ?, ?, ?, ?, ?, 0, 'filled', ?, ?)`,
      )
      .bind(
        input.orderId,
        input.userId,
        input.marketSymbol,
        input.orderType,
        serializeNumber(input.quantity),
        input.limitPrice === null
          ? null
          : serializeNumber(input.limitPrice),
        serializeNumber(input.executionPrice),
        costMinor,
        input.now,
        input.now,
      ),
    ledgerStatement(database, {
      walletId: input.wallet.id,
      orderId: input.orderId,
      amountMinor: -costMinor,
      balanceAfterMinor: balanceAfter,
      note: `Virtual ${input.orderType} buy ${input.marketSymbol}`,
      now: input.now,
    }),
  ]);
}

async function placePendingBuy(input: {
  userId: string;
  wallet: WalletRow;
  orderId: string;
  marketSymbol: MarketSymbol;
  quantity: number;
  limitPrice: number;
  now: number;
}) {
  const database = getD1();
  const reservedMinor = toMinorUnits(
    input.limitPrice * input.quantity,
  );

  if (reservedMinor > input.wallet.balanceMinor) {
    throw new VirtualTradingError(
      "Your virtual USD balance is too low for this limit order.",
    );
  }

  const balanceAfter = input.wallet.balanceMinor - reservedMinor;

  await database.batch([
    database
      .prepare(
        `UPDATE virtual_wallets
        SET balance_minor = ?, updated_at = ?
        WHERE id = ? AND user_id = ?`,
      )
      .bind(
        balanceAfter,
        input.now,
        input.wallet.id,
        input.userId,
      ),
    database
      .prepare(
        `INSERT INTO virtual_trade_orders (
          id,
          user_id,
          market_symbol,
          side,
          order_type,
          quantity,
          limit_price,
          executed_price,
          quote_amount_minor,
          reserved_quote_minor,
          status,
          created_at
        )
        VALUES (?, ?, ?, 'buy', 'limit', ?, ?, NULL, NULL, ?, 'pending', ?)`,
      )
      .bind(
        input.orderId,
        input.userId,
        input.marketSymbol,
        serializeNumber(input.quantity),
        serializeNumber(input.limitPrice),
        reservedMinor,
        input.now,
      ),
    ledgerStatement(database, {
      walletId: input.wallet.id,
      orderId: input.orderId,
      amountMinor: -reservedMinor,
      balanceAfterMinor: balanceAfter,
      note: `Reserved virtual USD for ${input.marketSymbol} limit buy`,
      now: input.now,
    }),
  ]);
}

async function fillImmediateSell(input: {
  userId: string;
  wallet: WalletRow;
  position: PositionRow | null;
  orderId: string;
  marketSymbol: MarketSymbol;
  orderType: VirtualOrderType;
  quantity: number;
  limitPrice: number | null;
  executionPrice: number;
  now: number;
  cancelPendingSellOrders?: boolean;
}) {
  if (!input.position) {
    throw new VirtualTradingError(
      "There is no virtual position available to sell.",
    );
  }

  const database = getD1();
  const heldQuantity = Number(input.position.quantity);
  const averageEntryPrice = Number(
    input.position.averageEntryPrice,
  );
  const nextQuantity = Math.max(0, heldQuantity - input.quantity);
  const proceedsMinor = toMinorUnits(
    input.executionPrice * input.quantity,
  );
  const realizedPnlMinor =
    input.position.realizedPnlMinor +
    toMinorUnits(
      (input.executionPrice - averageEntryPrice) * input.quantity,
    );
  const balanceAfter = input.wallet.balanceMinor + proceedsMinor;

  const statements = [
    database
      .prepare(
        `UPDATE virtual_wallets
        SET balance_minor = ?, updated_at = ?
        WHERE id = ? AND user_id = ?`,
      )
      .bind(
        balanceAfter,
        input.now,
        input.wallet.id,
        input.userId,
      ),
    positionUpsertStatement(database, {
      userId: input.userId,
      marketSymbol: input.marketSymbol,
      quantity: nextQuantity,
      averageEntryPrice:
        nextQuantity > 0 ? averageEntryPrice : 0,
      realizedPnlMinor,
      now: input.now,
    }),
    database
      .prepare(
        `INSERT INTO virtual_trade_orders (
          id,
          user_id,
          market_symbol,
          side,
          order_type,
          quantity,
          limit_price,
          executed_price,
          quote_amount_minor,
          reserved_quote_minor,
          status,
          created_at,
          filled_at
        )
        VALUES (?, ?, ?, 'sell', ?, ?, ?, ?, ?, 0, 'filled', ?, ?)`,
      )
      .bind(
        input.orderId,
        input.userId,
        input.marketSymbol,
        input.orderType,
        serializeNumber(input.quantity),
        input.limitPrice === null
          ? null
          : serializeNumber(input.limitPrice),
        serializeNumber(input.executionPrice),
        proceedsMinor,
        input.now,
        input.now,
      ),
    ledgerStatement(database, {
      walletId: input.wallet.id,
      orderId: input.orderId,
      amountMinor: proceedsMinor,
      balanceAfterMinor: balanceAfter,
      note: `Virtual ${input.orderType} sell ${input.marketSymbol}`,
      now: input.now,
    }),
  ];

  if (input.cancelPendingSellOrders) {
    statements.unshift(
      database
        .prepare(
          `UPDATE virtual_trade_orders
          SET status = 'cancelled', cancelled_at = ?
          WHERE user_id = ?
            AND market_symbol = ?
            AND side = 'sell'
            AND status = 'pending'`,
        )
        .bind(input.now, input.userId, input.marketSymbol),
    );
  }

  await database.batch(statements);
}

async function fillPendingOrder(
  userId: string,
  order: OrderRow,
  executionPrice: number,
) {
  if (!isMarketSymbol(order.marketSymbol)) {
    return;
  }

  const quantity = Number(order.quantity);
  const wallet = await ensureVirtualWallet(userId);
  const now = Date.now();

  if (order.side === "buy") {
    const position = await getPosition(userId, order.marketSymbol);
    const previousQuantity = Number(position?.quantity ?? 0);
    const previousAverage = Number(
      position?.averageEntryPrice ?? 0,
    );
    const nextQuantity = previousQuantity + quantity;
    const nextAverage =
      (previousQuantity * previousAverage +
        quantity * executionPrice) /
      nextQuantity;
    const actualCostMinor = toMinorUnits(executionPrice * quantity);
    const refundMinor = Math.max(
      0,
      order.reservedQuoteMinor - actualCostMinor,
    );
    const balanceAfter = wallet.balanceMinor + refundMinor;
    const statements = [
      getD1()
        .prepare(
          `UPDATE virtual_trade_orders
          SET
            status = 'filled',
            executed_price = ?,
            quote_amount_minor = ?,
            filled_at = ?
          WHERE id = ? AND user_id = ? AND status = 'pending'`,
        )
        .bind(
          serializeNumber(executionPrice),
          actualCostMinor,
          now,
          order.id,
          userId,
        ),
      getD1()
        .prepare(
          `UPDATE virtual_wallets
          SET balance_minor = ?, updated_at = ?
          WHERE id = ? AND user_id = ?`,
        )
        .bind(balanceAfter, now, wallet.id, userId),
      positionUpsertStatement(getD1(), {
        userId,
        marketSymbol: order.marketSymbol,
        quantity: nextQuantity,
        averageEntryPrice: nextAverage,
        realizedPnlMinor: position?.realizedPnlMinor ?? 0,
        now,
      }),
    ];

    if (refundMinor > 0) {
      statements.push(
        getD1()
          .prepare(
            `INSERT INTO virtual_ledger_entries (
              id,
              wallet_id,
              type,
              amount_minor,
              balance_after_minor,
              reference_id,
              note,
              created_at
            )
            VALUES (?, ?, 'adjustment', ?, ?, ?, ?, ?)`,
          )
          .bind(
            crypto.randomUUID(),
            wallet.id,
            refundMinor,
            balanceAfter,
            order.id,
            "Released unused virtual USD after limit buy filled",
            now,
          ),
      );
    }

    await getD1().batch(statements);
    return;
  }

  const position = await getPosition(userId, order.marketSymbol);

  if (!position || Number(position.quantity) + Number.EPSILON < quantity) {
    return;
  }

  const averageEntryPrice = Number(position.averageEntryPrice);
  const nextQuantity = Math.max(
    0,
    Number(position.quantity) - quantity,
  );
  const proceedsMinor = toMinorUnits(executionPrice * quantity);
  const balanceAfter = wallet.balanceMinor + proceedsMinor;
  const realizedPnlMinor =
    position.realizedPnlMinor +
    toMinorUnits((executionPrice - averageEntryPrice) * quantity);

  await getD1().batch([
    getD1()
      .prepare(
        `UPDATE virtual_trade_orders
        SET
          status = 'filled',
          executed_price = ?,
          quote_amount_minor = ?,
          filled_at = ?
        WHERE id = ? AND user_id = ? AND status = 'pending'`,
      )
      .bind(
        serializeNumber(executionPrice),
        proceedsMinor,
        now,
        order.id,
        userId,
      ),
    getD1()
      .prepare(
        `UPDATE virtual_wallets
        SET balance_minor = ?, updated_at = ?
        WHERE id = ? AND user_id = ?`,
      )
      .bind(balanceAfter, now, wallet.id, userId),
    positionUpsertStatement(getD1(), {
      userId,
      marketSymbol: order.marketSymbol,
      quantity: nextQuantity,
      averageEntryPrice:
        nextQuantity > 0 ? averageEntryPrice : 0,
      realizedPnlMinor,
      now,
    }),
    ledgerStatement(getD1(), {
      walletId: wallet.id,
      orderId: order.id,
      amountMinor: proceedsMinor,
      balanceAfterMinor: balanceAfter,
      note: `Filled virtual limit sell ${order.marketSymbol}`,
      now,
    }),
  ]);
}

function positionUpsertStatement(
  database: D1Database,
  input: {
    userId: string;
    marketSymbol: MarketSymbol;
    quantity: number;
    averageEntryPrice: number;
    realizedPnlMinor: number;
    now: number;
  },
) {
  return database
    .prepare(
      `INSERT INTO virtual_trade_positions (
        user_id,
        market_symbol,
        quantity,
        average_entry_price,
        realized_pnl_minor,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, market_symbol) DO UPDATE SET
        quantity = excluded.quantity,
        average_entry_price = excluded.average_entry_price,
        realized_pnl_minor = excluded.realized_pnl_minor,
        updated_at = excluded.updated_at`,
    )
    .bind(
      input.userId,
      input.marketSymbol,
      serializeNumber(input.quantity),
      serializeNumber(input.averageEntryPrice),
      input.realizedPnlMinor,
      input.now,
    );
}

function ledgerStatement(
  database: D1Database,
  input: {
    walletId: string;
    orderId: string;
    amountMinor: number;
    balanceAfterMinor: number;
    note: string;
    now: number;
  },
) {
  return database
    .prepare(
      `INSERT INTO virtual_ledger_entries (
        id,
        wallet_id,
        type,
        amount_minor,
        balance_after_minor,
        reference_id,
        note,
        created_at
      )
      VALUES (?, ?, 'paper_trade', ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      input.walletId,
      input.amountMinor,
      input.balanceAfterMinor,
      input.orderId,
      input.note,
      input.now,
    );
}

function normalizeOrder(row: OrderRow): VirtualTradingOrder[] {
  if (!isMarketSymbol(row.marketSymbol)) {
    return [];
  }

  return [
    {
      id: row.id,
      marketSymbol: row.marketSymbol,
      side: row.side,
      orderType: row.orderType,
      quantity: Number(row.quantity),
      limitPrice:
        row.limitPrice === null ? null : Number(row.limitPrice),
      executedPrice:
        row.executedPrice === null
          ? null
          : Number(row.executedPrice),
      quoteAmountMinor: row.quoteAmountMinor,
      reservedQuoteMinor: row.reservedQuoteMinor,
      status: row.status,
      createdAt: row.createdAt,
      filledAt: row.filledAt,
      cancelledAt: row.cancelledAt,
    },
  ];
}

function readMarketSymbol(value: string): MarketSymbol {
  if (!isMarketSymbol(value)) {
    throw new VirtualTradingError("Unsupported virtual market.");
  }

  return value;
}

function readSide(value: string): VirtualOrderSide {
  if (value !== "buy" && value !== "sell") {
    throw new VirtualTradingError("Invalid order side.");
  }

  return value;
}

function readOrderType(value: string): VirtualOrderType {
  if (value !== "market" && value !== "limit") {
    throw new VirtualTradingError("Invalid order type.");
  }

  return value;
}

function readPositiveNumber(
  value: unknown,
  message: string,
  maximum: number,
): number {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0 || number > maximum) {
    throw new VirtualTradingError(message);
  }

  return number;
}

function serializeNumber(value: number): string {
  return value.toFixed(12).replace(/\.?0+$/, "");
}

function toMinorUnits(value: number): number {
  return Math.round(value * 100);
}

function assetCode(symbol: MarketSymbol): string {
  return symbol.replace("USD", "");
}

function formatQuantity(value: number): string {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 8,
  });
}
