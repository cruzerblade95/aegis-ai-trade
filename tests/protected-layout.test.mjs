import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layoutUrl = new URL(
  "../app/components/protected-layout.tsx",
  import.meta.url,
);

const pageUrls = [
  new URL("../app/dashboard/page.tsx", import.meta.url),
  new URL("../app/market/page.tsx", import.meta.url),
  new URL("../app/market-explorer/page.tsx", import.meta.url),
  new URL("../app/risk/page.tsx", import.meta.url),
];

test("protected layout renders shared navigation", async () => {
  const source = await readFile(layoutUrl, "utf8");

  assert.match(source, /DashboardNav/);
  assert.match(source, /SignOutButton/);
  assert.match(source, /dashboard-header/);
  assert.match(source, /dashboard-brand/);
});

test("protected layout displays the authenticated user", async () => {
  const source = await readFile(layoutUrl, "utf8");

  assert.match(source, /user\.displayName/);
  assert.match(source, /user\.email/);
  assert.match(source, /children/);
});

test("protected pages use the shared layout", async () => {
  for (const pageUrl of pageUrls) {
    const source = await readFile(pageUrl, "utf8");

    assert.match(source, /ProtectedLayout/);
    assert.match(source, /<ProtectedLayout user=\{user\}>/);
    assert.doesNotMatch(source, /<header className="dashboard-header">/);
  }
});

test("individual pages still enforce authentication", async () => {
  const sources = await Promise.all(
    pageUrls.map((pageUrl) => readFile(pageUrl, "utf8")),
  );

  assert.match(sources[0], /requireUser\("\/dashboard"\)/);
  assert.match(sources[1], /requireUser\("\/market"\)/);
  assert.match(sources[2], /requireUser\("\/market-explorer"\)/);
  assert.match(sources[3], /requireUser\("\/risk"\)/);
});
