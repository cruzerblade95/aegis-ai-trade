import { requireUser } from "../auth/session";
import { ProtectedLayout } from "../components/protected-layout";
import { MarketExplorerWorkspace } from "../components/market-explorer-workspace";

export const dynamic = "force-dynamic";

export default async function MarketExplorerPage() {
  const user = await requireUser("/market-explorer");

  return (
    <ProtectedLayout user={user}>
      <section className="market-content explorer-content">
        <header className="market-heading">
          <div>
            <p className="eyebrow">MARKET EXPLORER</p>
            <h1>Explore live market movement.</h1>

            <p>
              Change markets and timeframes, inspect live reference
              candles, and learn the language used to describe order
              types. This page is view-only.
            </p>
          </div>

          <span className="simulation-badge">View only</span>
        </header>

        <aside className="market-warning">
          <strong>Execution is unavailable</strong>

          <p>
            This explorer does not display account balances, accept
            funds, place virtual orders, or connect to real trading.
            Market data is for observation and learning only.
          </p>
        </aside>

        <MarketExplorerWorkspace />

        <section aria-label="Order type glossary" className="explorer-glossary">
          <article>
            <span>01</span>
            <h2>Buy</h2>
            <p>
              A term for acquiring an asset. Whether it is appropriate
              depends on personal circumstances, risk, and applicable
              rules.
            </p>
          </article>

          <article>
            <span>02</span>
            <h2>Sell</h2>
            <p>
              A term for disposing of an asset. A chart alone cannot
              determine whether selling is suitable for a person.
            </p>
          </article>

          <article>
            <span>03</span>
            <h2>Market order</h2>
            <p>
              A market order generally seeks the currently available
              price. The final price can differ as markets move.
            </p>
          </article>

          <article>
            <span>04</span>
            <h2>Limit order</h2>
            <p>
              A limit order is associated with a price condition. It
              may not be filled, even if a chart comes close.
            </p>
          </article>
        </section>
      </section>
    </ProtectedLayout>
  );
}
