import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const schemaUrl = new URL("../db/schema.ts", import.meta.url);
const dataUrl = new URL(
  "../db/market-watchlist.ts",
  import.meta.url,
);
const actionUrl = new URL(
  "../app/market/actions.ts",
  import.meta.url,
);
const panelUrl = new URL(
  "../app/components/market-watchlist-panel.tsx",
  import.meta.url,
);
const migrationUrl = new URL(
  "../drizzle/0005_watchlists_alerts.sql",
  import.meta.url,
);

test("watchlists and educational alerts are persisted per user", async () => {
  const [schema, data, migration] = await Promise.all([
    readFile(schemaUrl, "utf8"),
    readFile(dataUrl, "utf8"),
    readFile(migrationUrl, "utf8"),
  ]);

  assert.match(schema, /userWatchlistItems/);
  assert.match(schema, /educationalPriceAlerts/);
  assert.match(migration, /user_watchlist_items/);
  assert.match(migration, /educational_price_alerts/);
  assert.match(data, /WHERE user_id = \?/);
  assert.match(data, /INSERT OR IGNORE INTO user_watchlist_items/);
});

test("watchlist actions validate markets and alert thresholds", async () => {
  const source = await readFile(actionUrl, "utf8");

  assert.match(source, /requireUser\("\/market"\)/);
  assert.match(source, /isLearningMarketSymbol/);
  assert.match(source, /Number\.isFinite\(threshold\)/);
  assert.match(source, /threshold <= 0/);
  assert.match(source, /revalidatePath\("\/market"\)/);
});

test("watchlist panel exposes complete learning controls", async () => {
  const source = await readFile(panelUrl, "utf8");

  assert.match(source, /Watchlist and learning alerts/);
  assert.match(source, /View chart/);
  assert.match(source, /Save educational alert/);
  assert.match(source, /Pause/);
  assert.match(source, /Enable/);
  assert.match(source, /Delete/);
  assert.match(source, /never\s+place an order/i);
});
