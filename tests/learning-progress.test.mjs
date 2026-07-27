import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const progressPageUrl = new URL(
  "../app/progress/page.tsx",
  import.meta.url,
);

const progressActionUrl = new URL(
  "../app/progress/actions.ts",
  import.meta.url,
);

const progressDatabaseUrl = new URL(
  "../db/learning-progress.ts",
  import.meta.url,
);

const navigationUrl = new URL(
  "../app/components/dashboard-nav.tsx",
  import.meta.url,
);

test("progress page requires authentication", async () => {
  const source = await readFile(progressPageUrl, "utf8");

  assert.match(source, /requireUser\("\/progress"\)/);
  assert.match(source, /<ProtectedLayout user=\{user\}>/);
});

test("progress navigation is available", async () => {
  const source = await readFile(navigationUrl, "utf8");

  assert.match(source, /href: "\/progress"/);
  assert.match(source, /label: "Progress"/);
});

test("lesson catalog contains educational lessons", async () => {
  const source = await readFile(
    progressDatabaseUrl,
    "utf8",
  );

  assert.match(source, /market-basics/);
  assert.match(source, /diversification/);
  assert.match(source, /volatility/);
});

test("lesson updates use the authenticated user", async () => {
  const source = await readFile(
    progressActionUrl,
    "utf8",
  );

  assert.match(source, /requireUser\("\/progress"\)/);
  assert.match(source, /user\.id/);
  assert.doesNotMatch(source, /formData\.get\("userId"\)/);
});

test("learning progress has a D1 migration", async () => {
  const migrationsUrl = new URL(
    "../migrations/",
    import.meta.url,
  );

  const migrationNames = await readdir(migrationsUrl);

  const migrationName = migrationNames.find((name) =>
    name.includes("learning_progress"),
  );

  assert.ok(
    migrationName,
    "Expected a learning-progress migration",
  );

  const migrationSource = await readFile(
    new URL(migrationName, migrationsUrl),
    "utf8",
  );

  assert.match(
    migrationSource,
    /CREATE TABLE IF NOT EXISTS user_lesson_progress/,
  );

  assert.match(
    migrationSource,
    /PRIMARY KEY \(user_id, lesson_slug\)/,
  );
});

test("progress does not expose real trading controls", async () => {
  const source = await readFile(progressPageUrl, "utf8");

  assert.doesNotMatch(
    source,
    /placeOrder|executeOrder|brokerApi|walletConnect/,
  );

  assert.doesNotMatch(
    source,
    /Buy now|Sell now|Deposit|Withdraw/,
  );
});