import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const riskPageUrl = new URL(
  "../app/risk/page.tsx",
  import.meta.url,
);

const riskDataUrl = new URL(
  "../data/risk-lessons.ts",
  import.meta.url,
);

const navigationUrl = new URL(
  "../app/components/dashboard-nav.tsx",
  import.meta.url,
);

test("risk workspace requires authentication", async () => {
  const source = await readFile(riskPageUrl, "utf8");

  assert.match(source, /requireUser\("\/risk"\)/);
  assert.match(source, /<ProtectedLayout user=\{user\}>/);
});

test("navigation exposes the risk-learning area", async () => {
  const source = await readFile(navigationUrl, "utf8");

  assert.match(source, /href: "\/risk"/);
  assert.match(source, /label: "Risk Lab"/);
});

test("risk examples are explicitly educational", async () => {
  const pageSource = await readFile(riskPageUrl, "utf8");
  const dataSource = await readFile(riskDataUrl, "utf8");

  assert.match(pageSource, /Simulation only/i);
  assert.match(pageSource, /not financial advice/i);
  assert.match(dataSource, /Concentrated fictional portfolio/);
  assert.match(dataSource, /Diversified fictional portfolio/);
});

test("allocation examples total one hundred percent", async () => {
  const source = await readFile(riskDataUrl, "utf8");

  assert.match(source, /percentage: 80/);
  assert.match(source, /percentage: 35/);
  assert.match(source, /percentage: 50/);
});

test("risk workspace has no real execution controls", async () => {
  const source = await readFile(riskPageUrl, "utf8");

  assert.doesNotMatch(
    source,
    /placeOrder|executeOrder|brokerApi|walletConnect/,
  );

  assert.doesNotMatch(
    source,
    /apiKey|secretKey|privateKey/,
  );

  assert.doesNotMatch(
    source,
    /Buy now|Sell now|Deposit/,
  );
});