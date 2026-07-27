"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type SignOutButtonProps = {
  className?: string;
  redirectTo?: string;
};

export function SignOutButton({
  className = "dashboard-sign-out",
  redirectTo = "/sign-in",
}: SignOutButtonProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSignOut() {
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/auth/sign-out", {
        method: "POST",
        credentials: "same-origin",
      });

      if (!response.ok) {
        const result = (await response
          .json()
          .catch(() => null)) as {
          error?: string;
        } | null;

        setError(
          result?.error ??
            "Unable to sign out. Please try again.",
        );

        return;
      }

      if (redirectTo === "/sign-in") {
        router.replace("/sign-in");
      } else {
        router.replace(redirectTo);
      }

      router.refresh();
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="sign-out-area">
      <button
        className={className}
        disabled={submitting}
        onClick={handleSignOut}
        type="button"
      >
        {submitting ? "Signing out..." : "Sign out"}
      </button>

      {error && (
        <p
          aria-live="polite"
          className="sign-out-error"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}