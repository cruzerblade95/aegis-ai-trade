CREATE TABLE IF NOT EXISTS market_assets (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  quote_symbol TEXT NOT NULL DEFAULT 'USDT',
  price_scale INTEGER NOT NULL DEFAULT 100,
  quantity_scale INTEGER NOT NULL DEFAULT 100000000,
  enabled INTEGER NOT NULL DEFAULT 1
    CHECK (enabled IN (0, 1)),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS demo_topups (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('pending', 'completed', 'rejected')),
  note TEXT,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS demo_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  side TEXT NOT NULL
    CHECK (side IN ('buy', 'sell')),
  order_type TEXT NOT NULL DEFAULT 'market'
    CHECK (order_type IN ('market')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  executed_price INTEGER NOT NULL
    CHECK (executed_price > 0),
  quote_amount INTEGER NOT NULL
    CHECK (quote_amount > 0),
  status TEXT NOT NULL DEFAULT 'filled'
    CHECK (status IN ('pending', 'filled', 'rejected')),
  created_at INTEGER NOT NULL,
  filled_at INTEGER,
  FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,
  FOREIGN KEY (asset_id)
    REFERENCES market_assets(id)
);

CREATE TABLE IF NOT EXISTS demo_positions (
  user_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0
    CHECK (quantity >= 0),
  average_entry_price INTEGER NOT NULL DEFAULT 0
    CHECK (average_entry_price >= 0),
  realized_pnl INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, asset_id),
  FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,
  FOREIGN KEY (asset_id)
    REFERENCES market_assets(id)
);

CREATE TABLE IF NOT EXISTS demo_wallet_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  order_id TEXT,
  entry_type TEXT NOT NULL
    CHECK (
      entry_type IN (
        'opening_balance',
        'demo_topup',
        'buy',
        'sell',
        'adjustment'
      )
    ),
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL
    CHECK (balance_after >= 0),
  description TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,
  FOREIGN KEY (order_id)
    REFERENCES demo_orders(id)
);

CREATE INDEX IF NOT EXISTS idx_demo_topups_user
ON demo_topups(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_demo_orders_user
ON demo_orders(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_demo_orders_asset
ON demo_orders(asset_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_demo_ledger_user
ON demo_wallet_ledger(user_id, created_at DESC);

INSERT OR IGNORE INTO market_assets (
  id,
  symbol,
  name,
  quote_symbol,
  price_scale,
  quantity_scale,
  enabled,
  created_at
)
VALUES
  (
    'bitcoin',
    'BTC',
    'Bitcoin',
    'USDT',
    100,
    100000000,
    1,
    unixepoch() * 1000
  ),
  (
    'ethereum',
    'ETH',
    'Ethereum',
    'USDT',
    100,
    100000000,
    1,
    unixepoch() * 1000
  ),
  (
    'solana',
    'SOL',
    'Solana',
    'USDT',
    100,
    100000000,
    1,
    unixepoch() * 1000
  ),
    (
    'gold',
    'XAU',
    'Gold',
    'USD',
    100,
    100000000,
    1,
    unixepoch() * 1000
    );