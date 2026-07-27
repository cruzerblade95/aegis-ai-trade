import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dataUrl = new URL(
  "../db/dashboard.ts",
  import.meta.url,
);

const dashboardUrl = new URL(
  "../app/dashboard/page.tsx",
  import.meta.url,
);

test("dashboard data is scoped to the authenticated user", async () => {
  const source = await readFile(dataUrl, "utf8");

  assert.match(source, /subscriptions\.user_id = \?/);
  assert.match(source, /virtual_wallets[\s\S]*user_id = \?/);
  assert.match(source, /virtual_wallets\.user_id = \?/);
  assert.match(source, /\.bind\(userId/);
});

test("dashboard loads the active plan and wallet", async () => {
  const source = await readFile(dataUrl, "utf8");

  assert.match(source, /FROM subscriptions/);
  assert.match(source, /INNER JOIN plans/);
  assert.match(source, /FROM virtual_wallets/);
  assert.match(source, /balance_minor AS balanceMinor/);
});

test("ledger entries belong to the authenticated wallet", async () => {
  const source = await readFile(dataUrl, "utf8");

  assert.match(source, /FROM virtual_ledger_entries/);
  assert.match(source, /INNER JOIN virtual_wallets/);
  assert.match(
    source,
    /virtual_ledger_entries\.wallet_id = \?/,
  );
  assert.match(source, /\.bind\(userId, wallet\.id\)/);
});

test("dashboard renders real D1 account data", async () => {
  const source = await readFile(dashboardUrl, "utf8");

  assert.match(source, /getDashboardData\(user\.id\)/);
  assert.match(source, /const wallet = dashboard\.wallet/);
    assert.match(source, /if \(!wallet\)/);
    assert.match(source, /wallet\.balanceMinor/);
    assert.match(source, /wallet\.currency/);
  assert.match(source, /dashboard\.plan\?\.name/);
  assert.match(source, /dashboard\.ledgerEntries\.map/);
  assert.doesNotMatch(source, /10000000|100,000/);
});