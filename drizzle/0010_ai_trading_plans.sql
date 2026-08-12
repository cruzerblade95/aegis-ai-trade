ALTER TABLE plans ADD COLUMN strategy_level INTEGER NOT NULL DEFAULT 1;
ALTER TABLE plans ADD COLUMN max_open_positions INTEGER NOT NULL DEFAULT 1;
ALTER TABLE plans ADD COLUMN scan_interval_seconds INTEGER NOT NULL DEFAULT 120;
ALTER TABLE plans ADD COLUMN risk_per_trade_bps INTEGER NOT NULL DEFAULT 50;

CREATE TABLE IF NOT EXISTS ai_trading_settings (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_enabled INTEGER NOT NULL DEFAULT 0,
  environment TEXT NOT NULL DEFAULT 'virtual' CHECK(environment IN ('virtual','current')),
  preferred_strategy TEXT NOT NULL DEFAULT 'auto',
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS ai_trade_decisions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  environment TEXT NOT NULL CHECK(environment IN ('virtual','current')),
  market_symbol TEXT NOT NULL,
  strategy TEXT NOT NULL,
  signal TEXT NOT NULL,
  confidence INTEGER NOT NULL,
  reason TEXT NOT NULL,
  position_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS ai_trade_decisions_user_created_idx ON ai_trade_decisions(user_id, created_at);
