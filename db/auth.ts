import { getD1 } from "./index";

import { env } from "cloudflare:workers";

const PASSWORD_ITERATIONS = 600_000;
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_KEY_BYTES = 32;

const SESSION_TOKEN_BYTES = 32;
export const SESSION_DURATION_SECONDS =
  30 * 24 * 60 * 60;

const SESSION_DURATION_MS =
  SESSION_DURATION_SECONDS * 1000;

export const SESSION_COOKIE_NAME = "aegis_session";

export type AuthenticatedUser = {
  id: string;
  email: string;
  displayName: string;
  role: "user" | "admin";
  status: "active" | "review" | "suspended";
};

type CredentialRow = AuthenticatedUser & {
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
};

export class AuthenticationError extends Error {
  constructor(
    public readonly code:
      | "EMAIL_EXISTS"
      | "INVALID_CREDENTIALS"
      | "ACCOUNT_DISABLED",
    message: string,
  ) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export async function hashPassword(password: string): Promise<{
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
}> {
  const salt = crypto.getRandomValues(
    new Uint8Array(PASSWORD_SALT_BYTES),
  );

  const passwordKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: toArrayBuffer(salt),
      iterations: PASSWORD_ITERATIONS,
    },
    passwordKey,
    PASSWORD_KEY_BYTES * 8,
  );

  return {
    passwordHash: encodeBase64Url(new Uint8Array(derivedBits)),
    passwordSalt: encodeBase64Url(salt),
    passwordIterations: PASSWORD_ITERATIONS,
  };
}

export async function verifyPassword(
  password: string,
  expectedHash: string,
  encodedSalt: string,
  iterations: number,
): Promise<boolean> {
  const salt = decodeBase64Url(encodedSalt);

  const passwordKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: toArrayBuffer(salt),
      iterations,
    },
    passwordKey,
    PASSWORD_KEY_BYTES * 8,
  );

  const actualHash = new Uint8Array(derivedBits);
  const storedHash = decodeBase64Url(expectedHash);

  return timingSafeEqual(actualHash, storedHash);
}

export async function registerUser(input: {
  displayName: string;
  email: string;
  password: string;
}): Promise<{
  user: AuthenticatedUser;
  sessionToken: string;
}> {
  const database = getD1();

  const displayName = input.displayName.trim();
  const email = normalizeEmail(input.email);
  const now = Date.now();

  validateRegistration(displayName, email, input.password);

  const existingUser = await database
    .prepare(
      `SELECT id
       FROM users
       WHERE email = ?
       LIMIT 1`,
    )
    .bind(email)
    .first<{ id: string }>();

  if (existingUser) {
    throw new AuthenticationError(
      "EMAIL_EXISTS",
      "An account already exists for this email address.",
    );
  }

  const credentials = await hashPassword(input.password);

  const userId = crypto.randomUUID();
  const walletId = crypto.randomUUID();
  const subscriptionId = crypto.randomUUID();
  const ledgerId = crypto.randomUUID();
  const role = configuredRole(email);

  await database.batch([
    database
      .prepare(
        `INSERT INTO users (
          id,
          email,
          display_name,
          role,
          status,
          email_verified_at,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, 'active', NULL, ?, ?)`,
      )
      .bind(
        userId,
        email,
        displayName,
        role,
        now,
        now,
      ),

    database
      .prepare(
        `INSERT INTO user_credentials (
          user_id,
          password_hash,
          password_salt,
          password_iterations,
          password_updated_at,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        userId,
        credentials.passwordHash,
        credentials.passwordSalt,
        credentials.passwordIterations,
        now,
        now,
        now,
      ),

    database
      .prepare(
        `INSERT INTO plans (
          id,
          code,
          name,
          description,
          monthly_virtual_credits,
          price_minor,
          currency,
          is_active,
          created_at,
          updated_at
        )
        VALUES (
          'plan_explorer',
          'explorer',
          'Explorer',
          'Core educational paper-trading tools and limited AI explanations.',
          100,
          0,
          'USD',
          1,
          ?,
          ?
        )
        ON CONFLICT(code) DO UPDATE SET
          name = excluded.name,
          description = excluded.description,
          monthly_virtual_credits =
            excluded.monthly_virtual_credits,
          price_minor = excluded.price_minor,
          currency = excluded.currency,
          is_active = excluded.is_active,
          updated_at = excluded.updated_at`,
      )
      .bind(now, now),

    database
      .prepare(
        `INSERT INTO subscriptions (
          id,
          user_id,
          plan_id,
          status,
          started_at,
          created_at,
          updated_at
        )
        VALUES (
          ?,
          ?,
          'plan_explorer',
          'active',
          ?,
          ?,
          ?
        )`,
      )
      .bind(subscriptionId, userId, now, now, now),

    database
      .prepare(
        `INSERT INTO virtual_wallets (
          id,
          user_id,
          currency,
          balance_minor,
          created_at,
          updated_at
        )
        VALUES (?, ?, 'USD', 10000000, ?, ?)`,
      )
      .bind(walletId, userId, now, now),

    database
      .prepare(
        `INSERT INTO virtual_ledger_entries (
          id,
          wallet_id,
          type,
          amount_minor,
          balance_after_minor,
          note,
          created_at
        )
        VALUES (
          ?,
          ?,
          'opening_balance',
          10000000,
          10000000,
          'Initial educational paper-trading balance',
          ?
        )`,
      )
      .bind(ledgerId, walletId, now),
  ]);

  const sessionToken = await createSession(userId);

  return {
    user: {
      id: userId,
      email,
      displayName,
      role,
      status: "active",
    },
    sessionToken,
  };
}

export async function signInUser(input: {
  email: string;
  password: string;
}): Promise<{
  user: AuthenticatedUser;
  sessionToken: string;
}> {
  const database = getD1();
  const email = normalizeEmail(input.email);

  const credentials = await database
    .prepare(
      `SELECT
        users.id,
        users.email,
        users.display_name AS displayName,
        users.role,
        users.status,
        user_credentials.password_hash AS passwordHash,
        user_credentials.password_salt AS passwordSalt,
        user_credentials.password_iterations AS passwordIterations
      FROM users
      INNER JOIN user_credentials
        ON user_credentials.user_id = users.id
      WHERE users.email = ?
      LIMIT 1`,
    )
    .bind(email)
    .first<CredentialRow>();

  if (!credentials) {
    throw new AuthenticationError(
      "INVALID_CREDENTIALS",
      "The email or password is incorrect.",
    );
  }

  const validPassword = await verifyPassword(
    input.password,
    credentials.passwordHash,
    credentials.passwordSalt,
    credentials.passwordIterations,
  );

  if (!validPassword) {
    throw new AuthenticationError(
      "INVALID_CREDENTIALS",
      "The email or password is incorrect.",
    );
  }

  if (credentials.status !== "active") {
    throw new AuthenticationError(
      "ACCOUNT_DISABLED",
      "This account is currently unavailable.",
    );
  }

  const sessionToken = await createSession(credentials.id);

  return {
    user: {
      id: credentials.id,
      email: credentials.email,
      displayName: credentials.displayName,
      role: credentials.role,
      status: credentials.status,
    },
    sessionToken,
  };
}

export async function createSession(
  userId: string,
): Promise<string> {
  const database = getD1();

  const tokenBytes = crypto.getRandomValues(
    new Uint8Array(SESSION_TOKEN_BYTES),
  );

  const token = encodeBase64Url(tokenBytes);
  const tokenHash = await hashSessionToken(token);

  const now = Date.now();
  const expiresAt = now + SESSION_DURATION_MS;

  await database
    .prepare(
      `INSERT INTO user_sessions (
        id,
        user_id,
        token_hash,
        expires_at,
        last_seen_at,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      userId,
      tokenHash,
      expiresAt,
      now,
      now,
    )
    .run();

  return token;
}

export async function findUserBySession(
  token: string,
): Promise<AuthenticatedUser | null> {
  if (!token) {
    return null;
  }

  const database = getD1();
  const tokenHash = await hashSessionToken(token);
  const now = Date.now();

  const user = await database
    .prepare(
      `SELECT
        users.id,
        users.email,
        users.display_name AS displayName,
        users.role,
        users.status
      FROM user_sessions
      INNER JOIN users
        ON users.id = user_sessions.user_id
      WHERE user_sessions.token_hash = ?
        AND user_sessions.expires_at > ?
        AND users.status = 'active'
      LIMIT 1`,
    )
    .bind(tokenHash, now)
    .first<AuthenticatedUser>();

  return user ?? null;
}

export async function deleteSession(token: string): Promise<void> {
  if (!token) {
    return;
  }

  const tokenHash = await hashSessionToken(token);

  await getD1()
    .prepare(
      `DELETE FROM user_sessions
       WHERE token_hash = ?`,
    )
    .bind(tokenHash)
    .run();
}

export async function deleteExpiredSessions(): Promise<void> {
  await getD1()
    .prepare(
      `DELETE FROM user_sessions
       WHERE expires_at <= ?`,
    )
    .bind(Date.now())
    .run();
}

async function hashSessionToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );

  return encodeBase64Url(new Uint8Array(digest));
}

function validateRegistration(
  displayName: string,
  email: string,
  password: string,
): void {
  if (displayName.length < 2 || displayName.length > 80) {
    throw new TypeError(
      "Display name must contain between 2 and 80 characters.",
    );
  }

  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new TypeError("Enter a valid email address.");
  }

  if (password.length < 12 || password.length > 128) {
    throw new TypeError(
      "Password must contain between 12 and 128 characters.",
    );
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function configuredRole(
  email: string,
): AuthenticatedUser["role"] {
  const runtimeEnv = env as unknown as {
    AEGIS_ADMIN_EMAILS?: string;
  };

  const configuredEmails =
    runtimeEnv.AEGIS_ADMIN_EMAILS ?? "";

  return configuredEmails
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(email)
    ? "admin"
    : "user";
}

function timingSafeEqual(
  first: Uint8Array,
  second: Uint8Array,
): boolean {
  if (first.length !== second.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < first.length; index += 1) {
    difference |= first[index] ^ second[index];
  }

  return difference === 0;
}

function encodeBase64Url(value: Uint8Array): string {
  let binary = "";

  for (const byte of value) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value
    .replaceAll("-", "+")
    .replaceAll("_", "/");

  const padded = normalized.padEnd(
    Math.ceil(normalized.length / 4) * 4,
    "=",
  );

  const binary = atob(padded);

  return Uint8Array.from(
    binary,
    (character) => character.charCodeAt(0),
  );
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}