import { requireUser } from "../auth/session";
import { ProtectedLayout } from "../components/protected-layout";
import {
  lossLimitExample,
  riskExamples,
  volatilityExamples,
  type RiskExample,
} from "../../data/risk-lessons";
import { LessonCompletionForm } from "../components/lesson-completion-form";
import { getLearningProgress } from "../../db/learning-progress";

export const dynamic = "force-dynamic";

export default async function RiskPage() {
  const user = await requireUser("/risk");
    const lessons = await getLearningProgress(user.id);

    const diversificationLesson = lessons.find(
    (lesson) => lesson.slug === "diversification",
    );

    const volatilityLesson = lessons.find(
    (lesson) => lesson.slug === "volatility",
    );

  return (
    <ProtectedLayout user={user}>
      <section className="risk-content">
        <header className="risk-heading">
          <div>
            <p className="eyebrow">RISK LEARNING LAB</p>

            <h1>Understand risk before returns.</h1>

            <p>
              Explore fixed fictional examples showing how
              diversification, volatility, and simulated loss
              limits affect an educational portfolio.
            </p>
          </div>

          <span className="simulation-badge">
            Educational examples
          </span>
        </header>

        <aside className="market-warning">
          <strong>Simulation only</strong>

          <p>
            These examples are not financial advice,
            recommendations, forecasts, or instructions for
            real-money trading.
          </p>
        </aside>

        <section className="risk-section">
          <div className="risk-section-heading">
            <p className="eyebrow">DIVERSIFICATION</p>
            <h2>Compare fictional allocations</h2>

            <p>
              Allocation changes how strongly one fictional
              market can affect the complete simulation.
            </p>
          </div>

          <div className="risk-example-grid">
            {riskExamples.map((example) => (
              <AllocationCard
                example={example}
                key={example.title}
              />
            ))}
          </div>

          {diversificationLesson && (
            <div className="risk-lesson-completion">
                <div>
                <strong>Diversification lesson</strong>

                <span>
                    Record your completion after comparing the fictional
                    allocations.
                </span>
                </div>

                <LessonCompletionForm
                completed={diversificationLesson.completed}
                lessonSlug={diversificationLesson.slug}
                />
            </div>
            )}
        </section>

        <section className="risk-section">
          <div className="risk-section-heading">
            <p className="eyebrow">VOLATILITY</p>
            <h2>Movement and uncertainty</h2>

            <p>
              Volatility describes the size and frequency of
              value changes. It does not predict direction.
            </p>
          </div>

          <div className="volatility-list">
            {volatilityExamples.map((example) => (
              <article
                className="volatility-row"
                key={example.label}
              >
                <div>
                  <strong>{example.label}</strong>
                  <span>{example.explanation}</span>
                </div>

                <div className="volatility-meter">
                  <span
                    aria-hidden="true"
                    style={{
                      width: `${example.movementPercent * 10}%`,
                    }}
                  />
                </div>

                <strong className="volatility-value">
                  ±{example.movementPercent}%
                </strong>
              </article>
            ))}
          </div>

          {volatilityLesson && (
            <div className="risk-lesson-completion">
                <div>
                <strong>Volatility and limits lesson</strong>

                <span>
                    Record your completion after reviewing movement and
                    simulated boundaries.
                </span>
                </div>

                <LessonCompletionForm
                completed={volatilityLesson.completed}
                lessonSlug={volatilityLesson.slug}
                />
            </div>
            )}
        </section>

        <section className="loss-limit-section">
          <div className="loss-limit-copy">
            <p className="eyebrow">
              SIMULATED LOSS-LIMIT CONCEPT
            </p>

            <h2>Set a boundary before a scenario begins</h2>

            <p>
              This fixed example demonstrates how an educational
              simulation can define its maximum acceptable
              change before pausing.
            </p>
          </div>

          <div className="loss-limit-card">
            <Metric
              label="Fictional starting balance"
              value={formatMinorUnits(
                lossLimitExample.startingBalanceMinor,
              )}
            />

            <Metric
              label="Example boundary"
              value={`${lossLimitExample.educationalLimitPercent}%`}
            />

            <Metric
              label="Maximum simulated change"
              value={formatMinorUnits(
                lossLimitExample.simulatedLimitMinor,
              )}
            />

            <Metric
              label="Balance after full example change"
              value={formatMinorUnits(
                lossLimitExample.remainingBalanceMinor,
              )}
            />
          </div>
        </section>

        <section className="risk-principles">
          <article>
            <span>01</span>
            <h3>Risk cannot be eliminated</h3>

            <p>
              Diversification may distribute exposure, but
              unexpected movement can still affect multiple
              categories.
            </p>
          </article>

          <article>
            <span>02</span>
            <h3>Past movement is not a promise</h3>

            <p>
              Previous fictional results do not guarantee what
              happens in the next scenario.
            </p>
          </article>

          <article>
            <span>03</span>
            <h3>Limits support discipline</h3>

            <p>
              A predefined simulation boundary can prevent
              emotional decisions during a learning exercise.
            </p>
          </article>
        </section>
      </section>
    </ProtectedLayout>
  );
}

function AllocationCard({
  example,
}: {
  example: RiskExample;
}) {
  return (
    <article className="allocation-card">
      <div className="allocation-card-header">
        <div>
          <span className="allocation-label">
            FICTIONAL ALLOCATION
          </span>

          <h3>{example.title}</h3>
        </div>

        <span
          className={`allocation-risk allocation-risk-${example.riskLevel.toLowerCase()}`}
        >
          {example.riskLevel}
        </span>
      </div>

      <p className="allocation-description">
        {example.description}
      </p>

      <div
        aria-label={`${example.title} allocation`}
        className="allocation-bar"
      >
        {example.allocations.map((allocation) => (
          <span
            key={allocation.label}
            style={{
              backgroundColor: allocation.color,
              width: `${allocation.percentage}%`,
            }}
            title={`${allocation.label}: ${allocation.percentage}%`}
          />
        ))}
      </div>

      <div className="allocation-list">
        {example.allocations.map((allocation) => (
          <div key={allocation.label}>
            <span
              aria-hidden="true"
              className="allocation-dot"
              style={{
                backgroundColor: allocation.color,
              }}
            />

            <span>{allocation.label}</span>
            <strong>{allocation.percentage}%</strong>
          </div>
        ))}
      </div>

      <div className="allocation-lesson">
        <strong>Learning note</strong>
        <p>{example.lesson}</p>
      </div>
    </article>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="loss-limit-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatMinorUnits(amountMinor: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amountMinor / 100);
}