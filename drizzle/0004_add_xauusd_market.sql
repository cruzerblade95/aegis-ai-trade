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
VALUES (
  'gold',
  'XAU',
  'Gold',
  'USD',
  100,
  100000000,
  1,
  unixepoch() * 1000
);