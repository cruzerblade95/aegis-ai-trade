ALTER TABLE plans ADD COLUMN yearly_price_minor INTEGER NOT NULL DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK(billing_cycle IN ('monthly','yearly'));

ALTER TABLE ai_trading_settings ADD COLUMN volume TEXT NOT NULL DEFAULT '0.01';
ALTER TABLE ai_trading_settings ADD COLUMN take_profit_bps INTEGER NOT NULL DEFAULT 90;
ALTER TABLE ai_trading_settings ADD COLUMN stop_loss_bps INTEGER NOT NULL DEFAULT 50;
ALTER TABLE ai_trading_settings ADD COLUMN auto_close INTEGER NOT NULL DEFAULT 1;
ALTER TABLE ai_trading_settings ADD COLUMN last_scan_at INTEGER;

CREATE INDEX IF NOT EXISTS ai_trading_settings_enabled_scan_idx
ON ai_trading_settings(is_enabled, last_scan_at);

UPDATE plans SET yearly_price_minor = 0 WHERE code = 'starter';
UPDATE plans SET yearly_price_minor = 29000 WHERE code = 'pro';
UPDATE plans SET yearly_price_minor = 79000, scan_interval_seconds = 60 WHERE code = 'elite';
