CREATE TABLE IF NOT EXISTS virtual_trade_position_lots (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  market_symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('buy','sell')),
  quantity TEXT NOT NULL,
  entry_price TEXT NOT NULL,
  take_profit TEXT,
  stop_loss TEXT,
  reserved_margin_minor INTEGER NOT NULL DEFAULT 0,
  opened_at INTEGER NOT NULL,
  closed_at INTEGER,
  close_price TEXT,
  realized_pnl_minor INTEGER,
  close_reason TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS virtual_position_lots_user_open_idx
  ON virtual_trade_position_lots(user_id, closed_at, opened_at);

INSERT INTO virtual_trade_position_lots (
  id, user_id, market_symbol, side, quantity, entry_price,
  reserved_margin_minor, opened_at
)
SELECT
  lower(hex(randomblob(16))), user_id, market_symbol, 'buy', quantity,
  average_entry_price, 0, updated_at
FROM virtual_trade_positions
WHERE CAST(quantity AS REAL) > 0
  AND NOT EXISTS (
    SELECT 1 FROM virtual_trade_position_lots lots
    WHERE lots.user_id = virtual_trade_positions.user_id
      AND lots.market_symbol = virtual_trade_positions.market_symbol
      AND lots.closed_at IS NULL
  );
