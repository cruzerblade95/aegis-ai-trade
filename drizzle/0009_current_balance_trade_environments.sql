CREATE TABLE IF NOT EXISTS current_wallets (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  balance_minor INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS current_wallet_user_currency_unique ON current_wallets(user_id, currency);

ALTER TABLE virtual_trade_orders ADD COLUMN environment TEXT NOT NULL DEFAULT 'virtual';
ALTER TABLE virtual_trade_position_lots ADD COLUMN environment TEXT NOT NULL DEFAULT 'virtual';
CREATE INDEX IF NOT EXISTS virtual_trade_orders_environment_idx ON virtual_trade_orders(user_id, environment, status);
CREATE INDEX IF NOT EXISTS virtual_trade_positions_environment_idx ON virtual_trade_position_lots(user_id, environment, closed_at);
