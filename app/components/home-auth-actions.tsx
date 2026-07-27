"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SignOutButton } from "./sign-out-button";

type SessionResponse = {
  authenticated: boolean;
  user: {
    displayName: string;
    email: string;
  } | null;
};

export function HomeAuthActions() {
  const [session, setSession] =
    useState<SessionResponse | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
          credentials: "same-origin",
        });

        if (!response.ok) {
          throw new Error("Unable to load session.");
        }

        const result =
          (await response.json()) as SessionResponse;

        if (active) {
          setSession(result);
        }
      } catch {
        if (active) {
          setSession({
            authenticated: false,
            user: null,
          });
        }
      }
    }

    void loadSession();

    return () => {
      active = false;
    };
  }, []);

  if (!session) {
    return (
      <div
        aria-label="Loading account"
        className="nav-actions nav-auth-loading"
      >
        <span>Loading account...</span>
      </div>
    );
  }

  if (session.authenticated && session.user) {
    return (
      <div className="nav-actions">
        <div className="home-user-summary">
          <strong>{session.user.displayName}</strong>
          <span>{session.user.email}</span>
        </div>

        <Link className="button secondary" href="/dashboard">
          Dashboard
        </Link>

        <SignOutButton
          className="button ghost"
          redirectTo="/"
        />
      </div>
    );
  }

  return (
    <div className="nav-actions">
      <Link className="button ghost" href="/sign-in">
        Sign in
      </Link>

      <Link className="button primary" href="/register">
        Create account
      </Link>
    </div>
  );
}