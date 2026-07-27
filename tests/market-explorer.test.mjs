import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const explorerPageUrl = new URL(
  "../app/market-explorer/page.tsx",
  import.meta.url,
);
const explorerWorkspaceUrl = new URL(
  "../app/components/market-explorer-workspace.tsx",
  import.meta.url,
);
const navigationUrl = new URL(
  "../app/components/dashboard-nav.tsx",
  import.meta.url,
);

test("market explorer is protected and reachable from navigation", async () => {
  const [page, navigation] = await Promise.all([
    readFile(explorerPageUrl, "utf8"),
    readFile(navigationUrl, "utf8"),
  ]);

  assert.match(page, /requireUser\("\/market-explorer"\)/);
  assert.match(page, /Execution is unavailable/);
  assert.match(navigation, /href: "\/market-explorer"/);
});

test("market explorer reuses live read-only chart controls without a balance", async () => {
  const source = await readFile(explorerWorkspaceUrl, "utf8");

  assert.match(source, /LiveMarketTerminal/);
  assert.match(source, /showLearningBalance=\{false\}/);
  assert.doesNotMatch(source, /buy|sell|limit|order/i);
});
