import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("renders development preview metadata", async () => {
  const layoutSource = await readFile(
    new URL("../app/layout.tsx", import.meta.url),
    "utf8",
  );

  const pageSource = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(layoutSource, /metadata/i);
  assert.match(layoutSource, /title/i);
  assert.match(layoutSource, /description/i);
  assert.match(
    `${layoutSource}\n${pageSource}`,
    /Aegis AI Trade/i,
  );
});