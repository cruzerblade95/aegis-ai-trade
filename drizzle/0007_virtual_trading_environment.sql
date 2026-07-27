CREATE TABLE IF NOT EXISTS virtual_trade_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  market_symbol TEXT NOT NULL,
  side TEXT NOT NULL
    CHECK (side IN ('buy', 'sell')),
  order_type TEXT NOT NULL
    CHECK (order_type IN ('market', 'limit')),
  quantity TEXT NOT NULL,
  limit_price TEXT,
  executed_price TEXT,
  quote_amount_minor INTEGER,
  reserved_quote_minor INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (
      status IN (
        'pending',
        'filled',
        'cancelled',
        'rejected'
      )
    ),
  created_at INTEGER NOT NULL,
  filled_at INTEGER,
  cancelled_at INTEGER,
  FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_virtual_trade_orders_user_status
ON virtual_trade_orders(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_virtual_trade_orders_market_status
ON virtual_trade_orders(market_symbol, status, created_at DESC);

CREATE TABLE IF NOT EXISTS virtual_trade_positions (
  user_id TEXT NOT NULL,
  market_symbol TEXT NOT NULL,
  quantity TEXT NOT NULL DEFAULT '0',
  average_entry_price TEXT NOT NULL DEFAULT '0',
  realized_pnl_minor INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, market_symbol),
  FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_virtual_trade_positions_user
ON virtual_trade_positions(user_id, updated_at DESC);
