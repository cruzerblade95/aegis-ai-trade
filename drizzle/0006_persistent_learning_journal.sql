ALTER TABLE trade_journal_entries
ADD COLUMN market_symbol TEXT NOT NULL DEFAULT 'BTCUSD';

ALTER TABLE trade_journal_entries
ADD COLUMN timeframe TEXT NOT NULL DEFAULT '5min';

CREATE INDEX IF NOT EXISTS trade_journal_user_market_idx
ON trade_journal_entries(user_id, market_symbol, created_at);
