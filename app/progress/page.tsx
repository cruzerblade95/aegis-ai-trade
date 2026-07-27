import Link from "next/link";
import { requireUser } from "../auth/session";
import { ProtectedLayout } from "../components/protected-layout";
import { getLearningProgress } from "../../db/learning-progress";
import { updateLessonProgress } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const user = await requireUser("/progress");
  const lessons = await getLearningProgress(user.id);

  const completedCount = lessons.filter(
    (lesson) => lesson.completed,
  ).length;

  const progressPercent =
    lessons.length === 0
      ? 0
      : Math.round(
          (completedCount / lessons.length) * 100,
        );

  return (
    <ProtectedLayout user={user}>
      <section className="progress-content">
        <header className="progress-heading">
          <div>
            <p className="eyebrow">
              LEARNING PROGRESS
            </p>

            <h1>Build your understanding.</h1>

            <p>
              Complete educational lessons covering fictional
              markets, diversification, volatility, and simulated
              risk limits.
            </p>
          </div>

          <span className="simulation-badge">
            {completedCount} of {lessons.length} completed
          </span>
        </header>

        <aside className="market-warning">
          <strong>Educational tracking only</strong>

          <p>
            Completing lessons does not represent trading
            experience, financial certification, investment
            performance, or permission to trade real assets.
          </p>
        </aside>

        <section className="progress-summary">
          <div className="progress-summary-copy">
            <span>Overall completion</span>
            <strong>{progressPercent}%</strong>
          </div>

          <div
            aria-label={`${progressPercent}% complete`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={progressPercent}
            className="progress-meter"
            role="progressbar"
          >
            <span
              style={{
                width: `${progressPercent}%`,
              }}
            />
          </div>
        </section>

        <section className="lesson-list">
          {lessons.map((lesson, index) => (
            <article
              className={
                lesson.completed
                  ? "lesson-card lesson-card-completed"
                  : "lesson-card"
              }
              key={lesson.slug}
            >
              <div className="lesson-number">
                {String(index + 1).padStart(2, "0")}
              </div>

              <div className="lesson-copy">
                <div className="lesson-title-row">
                  <h2>{lesson.title}</h2>

                  <span
                    className={
                      lesson.completed
                        ? "lesson-status lesson-status-completed"
                        : "lesson-status"
                    }
                  >
                    {lesson.completed
                      ? "Completed"
                      : "Not completed"}
                  </span>
                </div>

                <p>{lesson.description}</p>

                {lesson.completedAt !== null && (
                  <span className="lesson-completed-date">
                    Completed{" "}
                    {formatCompletionDate(
                      lesson.completedAt,
                    )}
                  </span>
                )}
              </div>

              <div className="lesson-actions">
                <Link
                  className="lesson-open-link"
                  href={lesson.href}
                >
                  Open lesson
                </Link>

                <form action={updateLessonProgress}>
                  <input
                    name="lessonSlug"
                    type="hidden"
                    value={lesson.slug}
                  />

                  <input
                    name="completed"
                    type="hidden"
                    value={
                      lesson.completed ? "false" : "true"
                    }
                  />

                  <button
                    className={
                      lesson.completed
                        ? "lesson-toggle lesson-toggle-secondary"
                        : "lesson-toggle"
                    }
                    type="submit"
                  >
                    {lesson.completed
                      ? "Mark incomplete"
                      : "Mark complete"}
                  </button>
                </form>
              </div>
            </article>
          ))}
        </section>
      </section>
    </ProtectedLayout>
  );
}

function formatCompletionDate(
  timestamp: number,
): string {
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}