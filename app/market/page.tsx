import { requireUser } from "../auth/session";
import { ProtectedLayout } from "../components/protected-layout";
import {
  educationalMarkets,
  learningScenarios,
  type EducationalMarket,
} from "../../data/educational-markets";
import { LessonCompletionForm } from "../components/lesson-completion-form";
import { getLearningProgress } from "../../db/learning-progress";

export const dynamic = "force-dynamic";

export default async function MarketPage() {
  const user = await requireUser("/market");
    const lessons = await getLearningProgress(user.id);

    const marketLesson = lessons.find(
    (lesson) => lesson.slug === "market-basics",
    );
  

  return (
    <ProtectedLayout user={user}>
      <section className="market-content">
        <header className="market-heading">
          <div>
            <p className="eyebrow">
              EDUCATIONAL MARKET LAB
            </p>

            <h1>Learn how markets behave.</h1>

            <p>
              Compare fictional market scenarios and practise
              identifying trends, volatility, and risk. Nothing
              displayed here represents a real asset or price.
            </p>
          </div>

          <span className="simulation-badge">
            Fictional simulation
          </span>
        </header>

        <aside className="market-warning">
          <strong>Learning mode</strong>

          <p>
            This workspace contains simulated information only.
            It does not provide financial advice, brokerage
            access, or real-money order execution.
          </p>
        </aside>

        <section className="market-grid">
          {educationalMarkets.map((market) => (
            <MarketCard
              key={market.symbol}
              market={market}
            />
          ))}
        </section>

        {marketLesson && (
        <section className="inline-lesson-panel">
            <div>
            <p className="eyebrow">LESSON PROGRESS</p>
            <h2>Fictional market basics</h2>

            <p>
                After reviewing the fictional market examples, record
                your completion for this educational lesson.
            </p>
            </div>

            <div className="inline-lesson-action">
            <span
                className={
                marketLesson.completed
                    ? "inline-lesson-status inline-lesson-status-completed"
                    : "inline-lesson-status"
                }
            >
                {marketLesson.completed
                ? "Completed"
                : "Not completed"}
            </span>

            <LessonCompletionForm
                completed={marketLesson.completed}
                lessonSlug={marketLesson.slug}
            />
            </div>
        </section>
        )}

        <section className="scenario-section">
          <div className="scenario-heading">
            <p className="eyebrow">SCENARIO EXPLORER</p>
            <h2>Questions to consider</h2>
          </div>

          <div className="scenario-grid">
            {learningScenarios.map((scenario, index) => (
              <article
                className="scenario-card"
                key={scenario.title}
              >
                <span className="scenario-number">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <h3>{scenario.title}</h3>
                <p>{scenario.description}</p>

                <div className="scenario-question">
                  <strong>Think about:</strong>
                  <span>{scenario.question}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="market-next-lesson">
          <div>
            <p className="eyebrow">NEXT LESSON</p>
            <h2>Risk before returns</h2>

            <p>
              The Risk Lab explains position sizing,
              diversification, and maximum simulated loss using
              educational examples.
            </p>
          </div>

          <span>Available now</span>
        </section>
      </section>
    </ProtectedLayout>
  );
}

function MarketCard({
  market,
}: {
  market: EducationalMarket;
}) {
  const isPositive = market.changePercent >= 0;

  return (
    <article className="market-card">
      <div className="market-card-header">
        <div>
          <span className="market-symbol">
            {market.symbol}
          </span>

          <h2>{market.name}</h2>
        </div>

        <span
          className={`risk-badge risk-${market.riskLevel.toLowerCase()}`}
        >
          {market.riskLevel} risk
        </span>
      </div>

      <p className="market-description">
        {market.description}
      </p>

      <div className="market-reference">
        <div>
          <span>Fictional reference value</span>

          <strong>
            {market.referenceValue.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </strong>
        </div>

        <span
          className={
            isPositive
              ? "market-change market-change-positive"
              : "market-change market-change-negative"
          }
        >
          {isPositive ? "+" : ""}
          {market.changePercent.toFixed(2)}%
        </span>
      </div>

      <div className="market-lesson">
        <strong>Learning note</strong>
        <p>{market.lesson}</p>
      </div>
    </article>
  );
}