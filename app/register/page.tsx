import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "../auth/session";
import { AuthForm } from "../components/auth-form";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link
          aria-label="Aegis AI Trade homepage"
          className="auth-brand"
          href="/"
        >
          <span className="shield">A</span>

          <span>
            Aegis <b>AI Trade</b>
          </span>
        </Link>

        <p className="eyebrow">CREATE YOUR ACCOUNT</p>
        <h1>Start your trading education.</h1>

        <p className="auth-intro">
          Create a secure account and receive a virtual
          learning wallet. No deposits, withdrawals, brokerage
          access, or real funds are involved.
        </p>

        <Suspense
          fallback={
            <p className="auth-loading">
              Loading registration form...
            </p>
          }
        >
          <AuthForm mode="register" />
        </Suspense>
      </section>
    </main>
  );
}