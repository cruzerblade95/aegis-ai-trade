INSERT INTO plans (
  id,
  code,
  name,
  description,
  monthly_virtual_credits,
  price_minor,
  currency,
  is_active,
  created_at,
  updated_at
)
VALUES
  (
    'plan_explorer',
    'explorer',
    'Explorer',
    'Core educational paper-trading tools and limited AI explanations.',
    100,
    0,
    'USD',
    1,
    unixepoch() * 1000,
    unixepoch() * 1000
  ),
  (
    'plan_analyst',
    'analyst',
    'Analyst',
    'Expanded educational AI explanations, risk scenarios, and journal insights.',
    2500,
    1900,
    'USD',
    1,
    unixepoch() * 1000,
    unixepoch() * 1000
  ),
  (
    'plan_strategist',
    'strategist',
    'Strategist',
    'Advanced portfolio simulations and personalized educational learning paths.',
    10000,
    4900,
    'USD',
    1,
    unixepoch() * 1000,
    unixepoch() * 1000
  )
ON CONFLICT(code) DO UPDATE SET
  name = excluded.name,
  description = excluded.description,
  monthly_virtual_credits = excluded.monthly_virtual_credits,
  price_minor = excluded.price_minor,
  currency = excluded.currency,
  is_active = excluded.is_active,
  updated_at = excluded.updated_at;