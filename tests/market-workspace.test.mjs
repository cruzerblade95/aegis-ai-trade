import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const marketPageUrl = new URL(
  "../app/market/page.tsx",
  import.meta.url,
);

const marketDataUrl = new URL(
  "../data/educational-markets.ts",
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

test("market information is explicitly fictional", async () => {
  const pageSource = await readFile(marketPageUrl, "utf8");
  const dataSource = await readFile(marketDataUrl, "utf8");

  assert.match(pageSource, /Fictional simulation/i);
  assert.match(pageSource, /simulated information only/i);
  assert.match(dataSource, /Fictional Technology Index/);
  assert.match(dataSource, /Fictional Green Energy Index/);
});

test("market workspace has no execution integration", async () => {
  const source = await readFile(marketPageUrl, "utf8");

  assert.doesNotMatch(source, /placeOrder|executeOrder|brokerApi/);
  assert.doesNotMatch(source, /apiKey|secretKey|privateKey/);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
});