import { requireUser } from "../auth/session";
import { ProtectedLayout } from "../components/protected-layout";
import { getDashboardData } from "../../db/dashboard";
import Link from "next/link";
import { getLearningProgress } from "../../db/learning-progress";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");

    const [dashboard, lessons] = await Promise.all([
    getDashboardData(user.id),
    getLearningProgress(user.id),
    ]);

    const wallet = dashboard.wallet;

    if (!wallet) {
    throw new Error(
        "Virtual wallet was not found for this account.",
    );
    }

    const completedLessonCount = lessons.filter(
    (lesson) => lesson.completed,
    ).length;

    const progressPercent =
    lessons.length === 0
        ? 0
        : Math.round(
            (completedLessonCount / lessons.length) * 100,
        );

  return (
    <ProtectedLayout user={user}>
      <section className="dashboard-content">
        <header className="dashboard-heading">
          <div>
            <p className="eyebrow">MEMBER WORKSPACE</p>
            <h1>Welcome, {user.displayName}.</h1>

            <p>
              Review your learning account, educational plan, virtual
              balance, and recent simulation activity.
            </p>
          </div>

          <span className="dashboard-status">
            Educational mode
          </span>
        </header>

        <section className="dashboard-grid">
          <article className="dashboard-card">
            <span className="dashboard-card-label">
              ACCOUNT
            </span>

            <h2>{user.displayName}</h2>
            <p>{user.email}</p>

            <div className="dashboard-card-footer">
              <span>Authentication</span>
              <strong>Active</strong>
            </div>
          </article>

          <article className="dashboard-card">
            <span className="dashboard-card-label">
              CURRENT PLAN
            </span>

            <h2>{dashboard.plan?.name ?? "No active plan"}</h2>

            <p>
              {dashboard.plan
                ? `${dashboard.plan.monthlyVirtualCredits.toLocaleString(
                    "en-US",
                  )} virtual credits per month`
                : "No educational plan is currently assigned."}
            </p>

            <div className="dashboard-card-footer">
              <span>Plan status</span>
              <strong>
                {dashboard.plan ? "Active" : "Inactive"}
              </strong>
            </div>
          </article>

          <article className="dashboard-card dashboard-card-primary">
            <span className="dashboard-card-label">
              VIRTUAL USD BALANCE
            </span>

            <h2>
              {formatMinorUnits(
                wallet.balanceMinor,
                wallet.currency
              )}
            </h2>

            <p>
              Use this simulated USD balance in the Virtual Trade
              environment. It cannot be deposited, withdrawn, or
              converted into real money.
            </p>

            <div className="dashboard-card-footer">
              <Link href="/trade">Open Virtual Trade</Link>
              <strong>{wallet.currency}</strong>
            </div>
          </article>
        </section>

        <section className="dashboard-progress-card">
        <div className="dashboard-progress-header">
            <div>
            <p className="eyebrow">LEARNING PROGRESS</p>
            <h2>Continue your educational journey</h2>

            <p>
                {completedLessonCount} of {lessons.length} lessons
                completed.
            </p>
            </div>

            <strong>{progressPercent}%</strong>
        </div>

        <div
            aria-label={`${progressPercent}% complete`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={progressPercent}
            className="dashboard-progress-meter"
            role="progressbar"
        >
            <span
            style={{
                width: `${progressPercent}%`,
            }}
            />
        </div>

        <div className="dashboard-progress-footer">
            <span>
            Educational completion only—not investment performance.
            </span>

            <Link href="/progress">
            View all lessons
            </Link>
        </div>
        </section>

        <section className="ledger-section">
          <header className="ledger-heading">
            <div>
              <p className="eyebrow">RECENT ACTIVITY</p>
              <h2>Virtual credit ledger</h2>
            </div>

            <span>Latest entries</span>
          </header>

          {dashboard.ledgerEntries.length > 0 ? (
            <div className="ledger-list">
              {dashboard.ledgerEntries.map((entry) => {
                const isCredit = entry.amountMinor >= 0;

                return (
                  <article className="ledger-row" key={entry.id}>
                    <div className="ledger-description">
                      <span
                        aria-hidden="true"
                        className={
                          isCredit
                            ? "ledger-indicator ledger-indicator-credit"
                            : "ledger-indicator ledger-indicator-debit"
                        }
                      />

                      <div>
                        <strong>Virtual credit activity</strong>

                        <span>
                          {formatDate(entry.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="ledger-amount">
                      <strong
                        className={
                          isCredit
                            ? "ledger-credit"
                            : "ledger-debit"
                        }
                      >
                        {isCredit ? "+" : ""}
                        {formatMinorUnits(
                          entry.amountMinor,
                          wallet.currency,
                        )}
                      </strong>

                      <span>
                        Balance:{" "}
                        {formatMinorUnits(
                          entry.balanceAfterMinor,
                          wallet.currency,
                        )}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="ledger-empty">
              <strong>No virtual activity yet</strong>

              <p>
                Educational credit changes will appear here when
                simulation lessons are completed.
              </p>
            </div>
          )}
        </section>

        <aside className="dashboard-note">
          <strong>Educational environment</strong>

          <p>
            Aegis AI Trade currently provides fictional learning
            scenarios only. It does not provide brokerage access,
            financial advice, deposits, withdrawals, or real-money
            order execution.
          </p>
        </aside>
      </section>
    </ProtectedLayout>
  );
}

function formatMinorUnits(
  amountMinor: number,
  currency: string,
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function formatDate(value: string | number | Date): string {
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
