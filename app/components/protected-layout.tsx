import Link from "next/link";
import type { ReactNode } from "react";
import { DashboardNav } from "./dashboard-nav";
import { SignOutButton } from "./sign-out-button";

type ProtectedLayoutProps = {
  children: ReactNode;
  user: {
    displayName: string;
    email: string;
  };
};

export function ProtectedLayout({
  children,
  user,
}: ProtectedLayoutProps) {
  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <Link
          aria-label="Aegis AI Trade homepage"
          className="dashboard-brand"
          href="/"
        >
          <span className="shield">A</span>

          <span>
            Aegis <b>AI Trade</b>
          </span>
        </Link>

        <DashboardNav />

        <div className="dashboard-user">
          <div>
            <strong>{user.displayName}</strong>
            <span>{user.email}</span>
          </div>

          <SignOutButton />
        </div>
      </header>

      {children}
    </main>
  );
}