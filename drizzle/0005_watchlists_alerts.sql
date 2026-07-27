CREATE TABLE IF NOT EXISTS user_watchlist_items (
  user_id TEXT NOT NULL,
  market_symbol TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS user_watchlist_user_market_unique
ON user_watchlist_items(user_id, market_symbol);

CREATE INDEX IF NOT EXISTS user_watchlist_user_created_idx
ON user_watchlist_items(user_id, created_at);

CREATE TABLE IF NOT EXISTS educational_price_alerts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  market_symbol TEXT NOT NULL,
  direction TEXT NOT NULL
    CHECK (direction IN ('above', 'below')),
  threshold TEXT NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 1
    CHECK (is_enabled IN (0, 1)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS educational_alerts_user_enabled_idx
ON educational_price_alerts(user_id, is_enabled);

CREATE INDEX IF NOT EXISTS educational_alerts_market_idx
ON educational_price_alerts(market_symbol);
