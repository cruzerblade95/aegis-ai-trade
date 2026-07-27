import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboardUrl = new URL(
  "../app/dashboard/page.tsx",
  import.meta.url,
);

const marketUrl = new URL(
  "../app/market/page.tsx",
  import.meta.url,
);

const riskUrl = new URL(
  "../app/risk/page.tsx",
  import.meta.url,
);

const actionUrl = new URL(
  "../app/progress/actions.ts",
  import.meta.url,
);

const componentUrl = new URL(
  "../app/components/lesson-completion-form.tsx",
  import.meta.url,
);

test("dashboard displays learning progress", async () => {
  const source = await readFile(dashboardUrl, "utf8");

  assert.match(source, /getLearningProgress\(user\.id\)/);
  assert.match(source, /completedLessonCount/);
  assert.match(source, /href="\/progress"/);
  assert.match(source, /role="progressbar"/);
});

test("market lab provides lesson completion", async () => {
  const source = await readFile(marketUrl, "utf8");

  assert.match(source, /market-basics/);
  assert.match(source, /LessonCompletionForm/);
});

test("risk lab provides both lesson controls", async () => {
  const source = await readFile(riskUrl, "utf8");

  assert.match(source, /diversification/);
  assert.match(source, /volatility/);
  assert.match(source, /LessonCompletionForm/);
});

test("completion form never accepts a user ID", async () => {
  const source = await readFile(componentUrl, "utf8");

  assert.match(source, /lessonSlug/);
  assert.doesNotMatch(source, /name="userId"/);
});

test("lesson changes revalidate connected pages", async () => {
  const source = await readFile(actionUrl, "utf8");

  assert.match(source, /revalidatePath\("\/dashboard"\)/);
  assert.match(source, /revalidatePath\("\/market"\)/);
  assert.match(source, /revalidatePath\("\/risk"\)/);
  assert.match(source, /revalidatePath\("\/progress"\)/);
});