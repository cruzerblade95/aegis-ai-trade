import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const authSourceUrl = new URL("../db/auth.ts", import.meta.url);

test("passwords use PBKDF2 SHA-256", async () => {
  const source = await readFile(authSourceUrl, "utf8");

  assert.match(source, /PBKDF2/);
  assert.match(source, /SHA-256/);
  assert.match(source, /PASSWORD_ITERATIONS = 600_000/);
  assert.match(source, /crypto\.subtle\.deriveBits/);
});

test("password verification uses constant-time comparison", async () => {
  const source = await readFile(authSourceUrl, "utf8");

  assert.match(source, /timingSafeEqual/);
  assert.match(source, /difference \|=/);
});

test("sessions use random tokens and store only hashes", async () => {
  const source = await readFile(authSourceUrl, "utf8");

  assert.match(source, /crypto\.getRandomValues/);
  assert.match(source, /hashSessionToken/);
  assert.match(source, /token_hash/);
  assert.match(source, /SHA-256/);
});

test("new accounts receive an Explorer subscription and virtual wallet", async () => {
  const source = await readFile(authSourceUrl, "utf8");

  assert.match(source, /plan_explorer/);
  assert.match(source, /virtual_wallets/);
  assert.match(source, /virtual_ledger_entries/);
  assert.match(source, /10000000/);
});

test("sign-in returns generic invalid credential errors", async () => {
  const source = await readFile(authSourceUrl, "utf8");

  const matches = source.match(
    /The email or password is incorrect\./g,
  );

  assert.ok(matches);
  assert.equal(matches.length, 2);
});

test("authentication contains no ChatGPT identity dependency", async () => {
  const source = await readFile(authSourceUrl, "utf8");

  assert.doesNotMatch(
    source,
    /ChatGPTUser|chatGPTSignIn|oai-authenticated-user/i,
  );
});