import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const schemaUrl = new URL("../db/schema.ts", import.meta.url);
const dataUrl = new URL("../db/learning-journal.ts", import.meta.url);
const actionUrl = new URL(
  "../app/market/actions.ts",
  import.meta.url,
);
const panelUrl = new URL(
  "../app/components/learning-journal-panel.tsx",
  import.meta.url,
);
const pageUrl = new URL("../app/market/page.tsx", import.meta.url);
const migrationUrl = new URL(
  "../drizzle/0006_persistent_learning_journal.sql",
  import.meta.url,
);

test("learning journal persists market and timeframe per user", async () => {
  const [schema, data, migration] = await Promise.all([
    readFile(schemaUrl, "utf8"),
    readFile(dataUrl, "utf8"),
    readFile(migrationUrl, "utf8"),
  ]);

  assert.match(schema, /marketSymbol: text\("market_symbol"\)/);
  assert.match(schema, /timeframe: text\("timeframe"\)/);
  assert.match(migration, /ADD COLUMN market_symbol/);
  assert.match(migration, /ADD COLUMN timeframe/);
  assert.match(data, /WHERE user_id = \?/);
  assert.match(data, /WHERE id = \? AND user_id = \?/);
  assert.match(data, /LIMIT 100/);
});

test("journal actions validate and revalidate authenticated writes", async () => {
  const source = await readFile(actionUrl, "utf8");

  assert.match(source, /addLearningJournalEntry/);
  assert.match(source, /editLearningJournalEntry/);
  assert.match(source, /removeLearningJournalEntry/);
  assert.match(source, /isLearningMarketSymbol/);
  assert.match(source, /isLearningJournalTimeframe/);
  assert.match(source, /MAX_NOTE_LENGTH/);
  assert.match(source, /requireUser\("\/market"\)/);
  assert.match(source, /revalidatePath\("\/market"\)/);
});

test("market page renders a complete scrollable journal", async () => {
  const [panel, page] = await Promise.all([
    readFile(panelUrl, "utf8"),
    readFile(pageUrl, "utf8"),
  ]);

  assert.match(page, /getLearningJournalEntries/);
  assert.match(page, /LearningJournalPanel/);
  assert.match(panel, /Save journal entry/);
  assert.match(panel, /Risk and uncertainty/);
  assert.match(panel, /Later reflection/);
  assert.match(panel, /Save changes/);
  assert.match(panel, /Delete/);
  assert.match(panel, /never submit or recommend an order/);
});
