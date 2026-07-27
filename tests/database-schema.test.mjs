import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const requiredTables = [
  "users",
  "user_credentials",
    "user_sessions",
  "plans",
  "subscriptions",
  "virtual_wallets",
  "virtual_ledger_entries",
  "paper_trades",
  "trade_journal_entries",
  "ai_explanation_history",
  "admin_audit_logs",
];

test("database migrations contain the complete v0.2.0 foundation", async () => {
  const migrationDirectory = new URL("../drizzle/", import.meta.url);

  const migrationFiles = (await readdir(migrationDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  assert.ok(
    migrationFiles.length > 0,
    "expected at least one generated Drizzle migration",
  );

  const migrations = (
    await Promise.all(
      migrationFiles.map((file) =>
        readFile(new URL(file, migrationDirectory), "utf8"),
      ),
    )
  ).join("\n");

  for (const table of requiredTables) {
    assert.match(
      migrations,
      new RegExp(`CREATE TABLE \\\`${table}\\\``),
      `expected migration to create the ${table} table`,
    );
  }
});

test("authentication schema stores hashed credentials and sessions", async () => {
  const schema = await readFile(
    new URL("../db/schema.ts", import.meta.url),
    "utf8",
  );

  assert.match(schema, /userCredentials/);
  assert.match(schema, /passwordHash/);
  assert.match(schema, /passwordSalt/);
  assert.match(schema, /passwordIterations/);
  assert.match(schema, /userSessions/);
  assert.match(schema, /tokenHash/);

  assert.doesNotMatch(
    schema,
    /plaintextPassword|rawSessionToken/,
  );
});

test("plan seed contains all educational plans", async () => {
  const seed = await readFile(
    new URL("../db/seed.sql", import.meta.url),
    "utf8",
  );

  assert.match(seed, /'explorer'/);
  assert.match(seed, /'analyst'/);
  assert.match(seed, /'strategist'/);
  assert.match(seed, /ON CONFLICT\(code\) DO UPDATE/);
});

test("plan seed does not contain user or administrator accounts", async () => {
  const seed = await readFile(
    new URL("../db/seed.sql", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(seed, /INSERT INTO users/i);
  assert.doesNotMatch(seed, /INSERT INTO auth_identities/i);
  assert.doesNotMatch(seed, /@[a-z0-9.-]+\.[a-z]{2,}/i);
});