import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "../auth/session";
import { AuthForm } from "../components/auth-form";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
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

        <p className="eyebrow">SECURE ACCOUNT ACCESS</p>
        <h1>Welcome back.</h1>

        <p className="auth-intro">
          Sign in to access your educational dashboard,
          virtual learning wallet, Market Lab, Risk Lab, and
          lesson progress.
        </p>

        <Suspense
          fallback={
            <p className="auth-loading">
              Loading sign-in form...
            </p>
          }
        >
          <AuthForm mode="sign-in" />
        </Suspense>
      </section>
    </main>
  );
}