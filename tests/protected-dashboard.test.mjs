import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sessionUrl = new URL(
  "../app/auth/session.ts",
  import.meta.url,
);

const dashboardUrl = new URL(
  "../app/dashboard/page.tsx",
  import.meta.url,
);

const signOutButtonUrl = new URL(
  "../app/components/sign-out-button.tsx",
  import.meta.url,
);

const authFormUrl = new URL(
  "../app/components/auth-form.tsx",
  import.meta.url,
);

test("dashboard requires a native authenticated user", async () => {
  const source = await readFile(dashboardUrl, "utf8");

  assert.match(source, /requireUser\("\/dashboard"\)/);
  assert.match(source, /user\.displayName/);
  assert.match(source, /user\.email/);
  assert.doesNotMatch(
    source,
    /ChatGPTUser|oai-authenticated-user/i,
  );
});

test("unauthenticated users are redirected to sign-in", async () => {
  const source = await readFile(sessionUrl, "utf8");

  assert.match(source, /redirect/);
  assert.match(source, /\/sign-in\?next=/);
  assert.match(source, /SESSION_COOKIE_NAME/);
  assert.match(source, /findUserBySession/);
});

test("dashboard sign-out uses the revocation endpoint", async () => {
  const source = await readFile(signOutButtonUrl, "utf8");

  assert.match(source, /\/api\/auth\/sign-out/);
  assert.match(source, /method: "POST"/);
  assert.match(source, /router\.replace\("\/sign-in"\)/);
  assert.doesNotMatch(
    source,
    /localStorage|sessionStorage/,
  );
});

test("sign-in accepts only internal return paths", async () => {
  const source = await readFile(authFormUrl, "utf8");

  assert.match(source, /requestedPath\?\.startsWith\("\/"\)/);
  assert.match(
    source,
    /!requestedPath\.startsWith\("\/\/"\)/,
  );
  assert.match(source, /router\.replace\(destination\)/);
});