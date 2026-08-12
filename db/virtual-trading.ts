import {
  getLatestMarketPrice,
  isMarketSymbol,
  type MarketSymbol,
} from "../lib/market-data";
import { getLearningJournalEntries } from "./learning-journal";
import { getD1 } from "./index";

export type TradingEnvironment = "virtual" | "current";
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
  id: string;
  marketSymbol: MarketSymbol;
  side: VirtualOrderSide;
  quantity: number;
  availableQuantity: number;
  averageEntryPrice: number;
  takeProfit: number | null;
  stopLoss: number | null;
  openedAt: number;
  realizedPnlMinor: number;
  environment?: TradingEnvironment;
};

export type VirtualTradingState = {
  environment: TradingEnvironment;
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
  id?: string;
  marketSymbol: string;
  side?: VirtualOrderSide;
  quantity: string;
  averageEntryPrice: string;
  takeProfit?: string | null;
  stopLoss?: string | null;
  openedAt?: number;
  reservedMarginMinor?: number;
  realizedPnlMinor: number;
  environment?: TradingEnvironment;
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
  environment: TradingEnvironment = "virtual",
): Promise<VirtualTradingState> {
  const database = getD1();
  const wallet = await ensureTradingWallet(userId, environment);

  const [positionsResult, ordersResult, reservedSells, journalEntries] =
    await Promise.all([
      database
        .prepare(
          `SELECT
            id,
            market_symbol AS marketSymbol,
            side,
            quantity,
            entry_price AS averageEntryPrice,
            take_profit AS takeProfit,
            stop_loss AS stopLoss,
            opened_at AS openedAt,
            reserved_margin_minor AS reservedMarginMinor,
            COALESCE(realized_pnl_minor, 0) AS realizedPnlMinor
          FROM virtual_trade_position_lots
          WHERE user_id = ? AND environment = ? AND closed_at IS NULL
          ORDER BY opened_at DESC`,
        )
        .bind(userId, environment)
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
          WHERE user_id = ? AND environment = ?
          ORDER BY created_at DESC
          LIMIT 200`,
        )
        .bind(userId, environment)
        .all<OrderRow>(),
      database
        .prepare(
          `SELECT
            market_symbol AS marketSymbol,
            COALESCE(SUM(CAST(quantity AS REAL)), 0)
              AS reservedQuantity
          FROM virtual_trade_orders
          WHERE user_id = ?
            AND environment = ?
            AND side = 'sell'
            AND status = 'pending'
          GROUP BY market_symbol`,
        )
        .bind(userId, environment)
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
        id: row.id ?? row.marketSymbol,
        marketSymbol: row.marketSymbol,
        side: row.side ?? "buy",
        quantity,
        availableQuantity: Math.max(0, quantity - reserved),
        averageEntryPrice: Number(row.averageEntryPrice),
        takeProfit: row.takeProfit === null || row.takeProfit === undefined ? null : Number(row.takeProfit),
        stopLoss: row.stopLoss === null || row.stopLoss === undefined ? null : Number(row.stopLoss),
        openedAt: row.openedAt ?? 0,
        realizedPnlMinor: row.realizedPnlMinor,
      },
    ];
  });

  const allOrders = ordersResult.results.flatMap(normalizeOrder);

  return {
    environment,
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
    environment?: TradingEnvironment;
    marketSymbol: string;
    side: string;
    orderType: string;
    quantity: number;
    limitPrice?: number | null;
    takeProfit?: number | null;
    stopLoss?: number | null;
  },
): Promise<void> {
  const environment = input.environment ?? "virtual";
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
  const wallet = await ensureTradingWallet(userId, environment);
  const orderId = crypto.randomUUID();
  const now = Date.now();

  if (orderType === "market") {
    await openTicketPosition({
      userId, wallet, orderId, marketSymbol, side, quantity,
      executionPrice: quote.price,
      takeProfit: readOptionalPositiveNumber(input.takeProfit),
      stopLoss: readOptionalPositiveNumber(input.stopLoss),
      now, environment,
    });
    return;
  }

  if (environment === "current") {
    throw new VirtualTradingError("Limit orders are currently available in the Virtual environment only.");
  }

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
  positionId: string,
  environment: TradingEnvironment = "virtual",
): Promise<void> {
  await closeTicketPosition(userId, positionId, "manual", undefined, environment);
}

export async function updateVirtualPositionStops(
  userId: string,
  positionId: string,
  takeProfitValue: number | null,
  stopLossValue: number | null,
  environment: TradingEnvironment = "virtual",
): Promise<void> {
  const position = await getTicketPosition(userId, positionId, environment);
  if (!position) throw new VirtualTradingError("This virtual position is already closed.", 409);
  const takeProfit = readOptionalPositiveNumber(takeProfitValue);
  const stopLoss = readOptionalPositiveNumber(stopLossValue);
  validateStops(position.side ?? "buy", Number(position.averageEntryPrice), takeProfit, stopLoss);
  await getD1().prepare(`UPDATE virtual_trade_position_lots SET take_profit = ?, stop_loss = ? WHERE id = ? AND user_id = ? AND environment = ? AND closed_at IS NULL`)
    .bind(takeProfit === null ? null : serializeNumber(takeProfit), stopLoss === null ? null : serializeNumber(stopLoss), positionId, userId, environment).run();
}

export async function syncVirtualLimitOrders(
  userId: string,
): Promise<void> {
  const database = getD1();
  await syncTicketStops(userId);
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


async function openTicketPosition(input: {
  userId: string; wallet: WalletRow; orderId: string; marketSymbol: MarketSymbol;
  side: VirtualOrderSide; quantity: number; executionPrice: number;
  takeProfit: number | null; stopLoss: number | null; now: number; environment: TradingEnvironment;
}) {
  validateStops(input.side, input.executionPrice, input.takeProfit, input.stopLoss);
  const marginMinor = toMinorUnits(input.executionPrice * input.quantity);
  if (marginMinor > input.wallet.balanceMinor) throw new VirtualTradingError(`Your ${input.environment} USD balance is too low for this position.`);
  const balanceAfter = input.wallet.balanceMinor - marginMinor;
  const db = getD1();
  await db.batch([
    db.prepare(`UPDATE ${walletTable(input.environment)} SET balance_minor = ?, updated_at = ? WHERE id = ? AND user_id = ?`).bind(balanceAfter,input.now,input.wallet.id,input.userId),
    db.prepare(`INSERT INTO virtual_trade_position_lots (id,user_id,market_symbol,side,quantity,entry_price,take_profit,stop_loss,reserved_margin_minor,opened_at,environment) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(input.orderId,input.userId,input.marketSymbol,input.side,serializeNumber(input.quantity),serializeNumber(input.executionPrice),input.takeProfit===null?null:serializeNumber(input.takeProfit),input.stopLoss===null?null:serializeNumber(input.stopLoss),marginMinor,input.now,input.environment),
    db.prepare(`INSERT INTO virtual_trade_orders (id,user_id,market_symbol,side,order_type,quantity,limit_price,executed_price,quote_amount_minor,reserved_quote_minor,status,created_at,filled_at,environment) VALUES (?,?,?,?, 'market', ?,NULL,?,?,0,'filled',?,?,?)`).bind(input.orderId,input.userId,input.marketSymbol,input.side,serializeNumber(input.quantity),serializeNumber(input.executionPrice),marginMinor,input.now,input.now,input.environment),
  ]);
}

async function getTicketPosition(userId:string, positionId:string, environment:TradingEnvironment="virtual"):Promise<PositionRow|null>{
  return await getD1().prepare(`SELECT id,market_symbol AS marketSymbol,side,quantity,entry_price AS averageEntryPrice,take_profit AS takeProfit,stop_loss AS stopLoss,opened_at AS openedAt,reserved_margin_minor AS reservedMarginMinor,COALESCE(realized_pnl_minor,0) AS realizedPnlMinor FROM virtual_trade_position_lots WHERE id=? AND user_id=? AND environment=? AND closed_at IS NULL LIMIT 1`).bind(positionId,userId,environment).first<PositionRow>() ?? null;
}

async function closeTicketPosition(userId:string, positionId:string, reason:string, suppliedPrice?:number, environment:TradingEnvironment="virtual"){
  const position=await getTicketPosition(userId,positionId,environment);
  if(!position) throw new VirtualTradingError("This virtual position is already closed.",409);
  const symbol=readMarketSymbol(position.marketSymbol);
  const price=suppliedPrice ?? (await getLatestMarketPrice(symbol)).price;
  const entry=Number(position.averageEntryPrice), qty=Number(position.quantity);
  const pnl=(position.side??"buy")==="buy" ? (price-entry)*qty : (entry-price)*qty;
  const pnlMinor=toMinorUnits(pnl), margin=position.reservedMarginMinor??0;
  const wallet=await ensureTradingWallet(userId,environment), balanceAfter=wallet.balanceMinor+margin+pnlMinor, now=Date.now();
  const closeOrderId=crypto.randomUUID(), db=getD1();
  await db.batch([
    db.prepare(`UPDATE virtual_trade_position_lots SET closed_at=?,close_price=?,realized_pnl_minor=?,close_reason=? WHERE id=? AND user_id=? AND closed_at IS NULL`).bind(now,serializeNumber(price),pnlMinor,reason,positionId,userId),
    db.prepare(`UPDATE ${walletTable(environment)} SET balance_minor=?,updated_at=? WHERE id=? AND user_id=?`).bind(balanceAfter,now,wallet.id,userId),
    db.prepare(`INSERT INTO virtual_trade_orders (id,user_id,market_symbol,side,order_type,quantity,limit_price,executed_price,quote_amount_minor,reserved_quote_minor,status,created_at,filled_at,environment) VALUES (?,?,?,?, 'market', ?,NULL,?,?,0,'filled',?,?,?)`).bind(closeOrderId,userId,symbol,(position.side??"buy")==="buy"?"sell":"buy",serializeNumber(qty),serializeNumber(price),margin+pnlMinor,now,now,environment),
  ]);
}

async function syncTicketStops(userId:string){
  const rows=await getD1().prepare(`SELECT id,market_symbol AS marketSymbol,side,quantity,entry_price AS averageEntryPrice,take_profit AS takeProfit,stop_loss AS stopLoss,opened_at AS openedAt,reserved_margin_minor AS reservedMarginMinor,0 AS realizedPnlMinor,environment FROM virtual_trade_position_lots WHERE user_id=? AND closed_at IS NULL AND (take_profit IS NOT NULL OR stop_loss IS NOT NULL)`).bind(userId).all<PositionRow>();
  const symbols=[...new Set(rows.results.map(r=>r.marketSymbol).filter(isMarketSymbol))];
  const quotes=new Map<MarketSymbol,number>();
  await Promise.all(symbols.map(async symbol=>{try{quotes.set(symbol,(await getLatestMarketPrice(symbol)).price)}catch{}}));
  for(const row of rows.results){ if(!row.id||!isMarketSymbol(row.marketSymbol))continue; const p=quotes.get(row.marketSymbol); if(!p)continue; const tp=row.takeProfit?Number(row.takeProfit):null, sl=row.stopLoss?Number(row.stopLoss):null; const buy=(row.side??"buy")==="buy"; if(tp!==null && (buy?p>=tp:p<=tp)) await closeTicketPosition(userId,row.id,"take-profit",p,row.environment??"virtual"); else if(sl!==null && (buy?p<=sl:p>=sl)) await closeTicketPosition(userId,row.id,"stop-loss",p,row.environment??"virtual"); }
}

function validateStops(side:VirtualOrderSide, entry:number, tp:number|null, sl:number|null){
 if(side==="buy"){if(tp!==null&&tp<=entry)throw new VirtualTradingError("Buy take profit must be above the entry price."); if(sl!==null&&sl>=entry)throw new VirtualTradingError("Buy stop loss must be below the entry price.");}
 else {if(tp!==null&&tp>=entry)throw new VirtualTradingError("Sell take profit must be below the entry price."); if(sl!==null&&sl<=entry)throw new VirtualTradingError("Sell stop loss must be above the entry price.");}
}
function readOptionalPositiveNumber(value:unknown):number|null{ if(value===null||value===undefined||value==="")return null; return readPositiveNumber(value,"Enter a valid TP/SL price.",1_000_000_000); }


async function ensureTradingWallet(userId:string, environment:TradingEnvironment):Promise<WalletRow>{
  if(environment==="virtual") return ensureVirtualWallet(userId);
  const database=getD1();
  const existing=await database.prepare(`SELECT id,currency,balance_minor AS balanceMinor FROM current_wallets WHERE user_id=? AND currency='USD' LIMIT 1`).bind(userId).first<WalletRow>();
  if(existing)return existing;
  const id=crypto.randomUUID(), now=Date.now();
  await database.prepare(`INSERT INTO current_wallets(id,user_id,currency,balance_minor,created_at,updated_at) VALUES(?,?,'USD',0,?,?)`).bind(id,userId,now,now).run();
  return {id,currency:"USD",balanceMinor:0};
}
function walletTable(environment:TradingEnvironment){return environment==="virtual"?"virtual_wallets":"current_wallets";}
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
