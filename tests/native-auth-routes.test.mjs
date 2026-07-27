import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
  register: new URL(
    "../app/api/auth/register/route.ts",
    import.meta.url,
  ),
  signIn: new URL(
    "../app/api/auth/sign-in/route.ts",
    import.meta.url,
  ),
  signOut: new URL(
    "../app/api/auth/sign-out/route.ts",
    import.meta.url,
  ),
  form: new URL(
    "../app/components/auth-form.tsx",
    import.meta.url,
  ),
};

test("authentication endpoints use POST requests", async () => {
  for (const file of [
    files.register,
    files.signIn,
    files.signOut,
  ]) {
    const source = await readFile(file, "utf8");
    assert.match(source, /export async function POST/);
  }
});

test("session cookies use secure server-side settings", async () => {
  for (const file of [files.register, files.signIn]) {
    const source = await readFile(file, "utf8");

    assert.match(source, /httpOnly: true/);
    assert.match(source, /sameSite: "lax"/);
    assert.match(source, /secure:/);
    assert.match(source, /SESSION_COOKIE_NAME/);
  }
});

test("registration verifies matching passwords", async () => {
  const source = await readFile(files.register, "utf8");

  assert.match(
    source,
    /body\.password !== body\.confirmPassword/,
  );
});

test("sign-out revokes the server session", async () => {
  const source = await readFile(files.signOut, "utf8");

  assert.match(source, /deleteSession\(token\)/);
  assert.match(source, /maxAge: 0/);
});

test("authentication form does not store tokens in browser storage", async () => {
  const source = await readFile(files.form, "utf8");

  assert.doesNotMatch(
    source,
    /localStorage|sessionStorage/,
  );

  assert.match(source, /\/api\/auth\/register/);
  assert.match(source, /\/api\/auth\/sign-in/);
});