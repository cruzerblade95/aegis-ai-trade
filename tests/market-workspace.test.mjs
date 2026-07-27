import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const marketPageUrl = new URL(
  "../app/market/page.tsx",
  import.meta.url,
);

const marketTerminalUrl = new URL(
  "../app/components/live-market-terminal.tsx",
  import.meta.url,
);

const marketApiUrl = new URL(
  "../app/api/market/candles/route.ts",
  import.meta.url,
);

const marketDataUrl = new URL(
  "../lib/market-data.ts",
  import.meta.url,
);

const navigationUrl = new URL(
  "../app/components/dashboard-nav.tsx",
  import.meta.url,
);

test("market workspace requires authentication", async () => {
  const source = await readFile(marketPageUrl, "utf8");

  assert.match(source, /requireUser\("\/market"\)/);
  assert.match(source, /<ProtectedLayout user=\{user\}>/);
});

test("navigation exposes protected learning areas", async () => {
  const source = await readFile(navigationUrl, "utf8");

  assert.match(source, /href: "\/dashboard"/);
  assert.match(source, /href: "\/market"/);
  assert.match(source, /usePathname/);
  assert.match(source, /aria-current/);
});

test("market information is live, read-only, and educational", async () => {
  const pageSource = await readFile(marketPageUrl, "utf8");
  const terminalSource = await readFile(marketTerminalUrl, "utf8");
  const apiSource = await readFile(marketApiUrl, "utf8");
  const providerSource = await readFile(marketDataUrl, "utf8");
  const source = `${apiSource}\n${providerSource}`;

  assert.match(pageSource, /provider-sourced reference candles/i);
  assert.match(pageSource, /read-only/i);
  assert.match(source, /api\.kraken\.com\/0\/public\/OHLC/i);
  assert.match(source, /api\.twelvedata\.com\/time_series/i);
  assert.match(source, /MARKET_DATA_PROVIDER/);
  assert.match(source, /TWELVE_DATA_API_KEY/);
  assert.match(terminalSource, /availableSymbols/);
  assert.match(terminalSource, /Unavailable/);
});

test("Kraken disables gold while Twelve Data can provide it", async () => {
  const apiSource = await readFile(marketApiUrl, "utf8");
  const providerSource = await readFile(marketDataUrl, "utf8");
  const terminalSource = await readFile(marketTerminalUrl, "utf8");
  const source = `${apiSource}\n${providerSource}`;

  assert.match(source, /krakenPairs/);
  assert.match(source, /Gold is unavailable while Kraken is selected/);
  assert.match(source, /provider === "kraken"/);
  assert.match(terminalSource, /disabled=/);
  assert.match(terminalSource, /availableSymbols\.includes\(market\.key\)/);
});

test("market workspace has no execution integration", async () => {
  const pageSource = await readFile(marketPageUrl, "utf8");
  const terminalSource = await readFile(marketTerminalUrl, "utf8");
  const source = `${pageSource}\n${terminalSource}`;

  assert.doesNotMatch(source, /placeOrder|executeOrder|brokerApi/);
  assert.doesNotMatch(source, /apiKey|secretKey|privateKey/);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
});

test("timeframes and workspace tabs are interactive controls", async () => {
  const source = await readFile(marketTerminalUrl, "utf8");

  assert.match(source, /setInterval\(timeframe\.value\)/);
  assert.match(source, /"1min"/);
  assert.match(source, /"5min"/);
  assert.match(source, /"1h"/);
  assert.match(source, /"1day"/);
  assert.match(source, /setActiveTab\(tab\.value\)/);
  assert.match(source, /"positions"/);
  assert.match(source, /"orders"/);
  assert.match(source, /"history"/);
  assert.match(source, /"journal"/);
});
