import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("../app/trade/page.tsx", import.meta.url);
const workspaceUrl = new URL(
  "../app/components/virtual-trading-workspace.tsx",
  import.meta.url,
);
const chartUrl = new URL(
  "../app/components/live-market-terminal.tsx",
  import.meta.url,
);
const apiUrl = new URL("../app/api/trade/route.ts", import.meta.url);
const serviceUrl = new URL(
  "../db/virtual-trading.ts",
  import.meta.url,
);
const migrationUrl = new URL(
  "../drizzle/0007_virtual_trading_environment.sql",
  import.meta.url,
);
const navigationUrl = new URL(
  "../app/components/dashboard-nav.tsx",
  import.meta.url,
);

test("virtual trade is protected and linked from member navigation", async () => {
  const [page, navigation] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(navigationUrl, "utf8"),
  ]);

  assert.match(page, /requireUser\("\/trade"\)/);
  assert.match(page, /<ProtectedLayout user=\{user\}>/);
  assert.match(navigation, /href: "\/trade"/);
  assert.match(navigation, /Virtual Trade/);
});

test("workspace supports virtual market and limit orders", async () => {
  const workspace = await readFile(workspaceUrl, "utf8");

  assert.match(workspace, /value="market"/);
  assert.match(workspace, /value="limit"/);
  assert.match(workspace, /Place virtual buy/);
  assert.match(workspace, /Place virtual sell/);
  assert.match(workspace, /action: "place"/);
  assert.match(workspace, /action: "cancel"/);
  assert.match(workspace, /action: "sync"/);
});

test("real environment is selectable but execution stays connection-gated", async () => {
  const workspace = await readFile(workspaceUrl, "utf8");

  assert.match(workspace, />\s*Real\s*</);
  assert.match(workspace, /setEnvironment\("real"\)/);
  assert.match(workspace, /Broker connection required/);
  assert.match(workspace, /Real USD balance/);
  assert.match(workspace, /Order execution[\s\S]*Disabled/);
});

test("virtual records and journal use bounded scrollable panels", async () => {
  const workspace = await readFile(workspaceUrl, "utf8");
  const css = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(workspace, /"positions"/);
  assert.match(workspace, /"orders"/);
  assert.match(workspace, /"history"/);
  assert.match(workspace, /"journal"/);
  assert.match(css, /\.virtual-record-panel[\s\S]*max-height:/);
  assert.match(css, /\.virtual-record-panel[\s\S]*overflow: auto/);
  assert.match(css, /\.virtual-table-scroll/);
});

test("virtual orders persist in D1 and use server-fetched prices", async () => {
  const [api, service, migration] = await Promise.all([
    readFile(apiUrl, "utf8"),
    readFile(serviceUrl, "utf8"),
    readFile(migrationUrl, "utf8"),
  ]);

  assert.match(api, /getCurrentUser/);
  assert.match(api, /placeVirtualOrder/);
  assert.match(service, /getLatestMarketPrice/);
  assert.match(service, /virtual_trade_orders/);
  assert.match(service, /virtual_trade_positions/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS virtual_trade_orders/);
  assert.match(migration, /CHECK \(order_type IN \('market', 'limit'\)\)/);
});

test("filled orders and pending limits are rendered on the chart", async () => {
  const [workspace, chart] = await Promise.all([
    readFile(workspaceUrl, "utf8"),
    readFile(chartUrl, "utf8"),
  ]);

  assert.match(workspace, /tradeOrders=\{/);
  assert.match(workspace, /refreshToken=\{chartRefreshToken\}/);
  assert.match(chart, /createSeriesMarkers/);
  assert.match(chart, /createPriceLine/);
  assert.match(chart, /arrowUp/);
  assert.match(chart, /arrowDown/);
  assert.match(chart, /LIMIT/);
  assert.match(chart, /wss:\/\/ws\.kraken\.com\/v2/);
  assert.match(chart, /channel: "ohlc"/);
});

test("open virtual positions can be closed at the server price", async () => {
  const [workspace, api, service] = await Promise.all([
    readFile(workspaceUrl, "utf8"),
    readFile(apiUrl, "utf8"),
    readFile(serviceUrl, "utf8"),
  ]);

  assert.match(workspace, /action: "close"/);
  assert.match(workspace, /Close position/);
  assert.match(api, /closeVirtualPosition/);
  assert.match(service, /export async function closeVirtualPosition/);
  assert.match(service, /orderType: "market"/);
});

test("virtual account does not expose real-money integrations", async () => {
  const source = await readFile(serviceUrl, "utf8");

  assert.doesNotMatch(
    source,
    /brokerApi|privateKey|withdrawalAddress|paymentIntent/,
  );
});
