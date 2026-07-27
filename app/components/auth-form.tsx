"use client";

import Link from "next/link";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  type FormEvent,
  useState,
} from "react";

type AuthFormProps = {
  mode: "register" | "sign-in";
};

type AuthenticationResponse = {
  error?: string;
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const isRegister = mode === "register";
  const requestedPath = searchParams.get("next");

  const destination =
    !isRegister &&
    requestedPath?.startsWith("/") &&
    !requestedPath.startsWith("//")
      ? requestedPath
      : "/dashboard";

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setError("");
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);

    const payload = isRegister
      ? {
          displayName: formData.get("displayName"),
          email: formData.get("email"),
          password: formData.get("password"),
          confirmPassword:
            formData.get("confirmPassword"),
        }
      : {
          email: formData.get("email"),
          password: formData.get("password"),
        };

    try {
      const response = await fetch(
        isRegister
          ? "/api/auth/register"
          : "/api/auth/sign-in",
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const result =
        (await response.json()) as AuthenticationResponse;

      if (!response.ok) {
        setError(
          result.error ??
            "Authentication was unsuccessful.",
        );

        return;
      }

      router.replace(destination);
      router.refresh();
    } catch {
      setError(
        "Unable to connect. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      {isRegister && (
        <label>
          Display name

          <input
            autoComplete="name"
            disabled={submitting}
            maxLength={80}
            minLength={2}
            name="displayName"
            placeholder="Your name"
            required
            type="text"
          />
        </label>
      )}

      <label>
        Email address

        <input
          autoComplete="email"
          disabled={submitting}
          name="email"
          placeholder="you@example.com"
          required
          type="email"
        />
      </label>

      <label>
        Password

        <input
          autoComplete={
            isRegister
              ? "new-password"
              : "current-password"
          }
          disabled={submitting}
          maxLength={128}
          minLength={12}
          name="password"
          placeholder={
            isRegister
              ? "At least 12 characters"
              : "Enter your password"
          }
          required
          type="password"
        />
      </label>

      {isRegister && (
        <label>
          Confirm password

          <input
            autoComplete="new-password"
            disabled={submitting}
            maxLength={128}
            minLength={12}
            name="confirmPassword"
            placeholder="Enter the password again"
            required
            type="password"
          />
        </label>
      )}

      {error && (
        <p
          aria-live="polite"
          className="auth-error"
          role="alert"
        >
          {error}
        </p>
      )}

      <button
        className="auth-submit"
        disabled={submitting}
        type="submit"
      >
        {submitting
          ? "Please wait..."
          : isRegister
            ? "Create account"
            : "Sign in"}
      </button>

      <p className="auth-switch">
        {isRegister
          ? "Already have an account?"
          : "Do not have an account?"}{" "}

        <Link
          href={isRegister ? "/sign-in" : "/register"}
        >
          {isRegister ? "Sign in" : "Register"}
        </Link>
      </p>

      <Link className="auth-home-link" href="/">
        Return to homepage
      </Link>
    </form>
  );
}