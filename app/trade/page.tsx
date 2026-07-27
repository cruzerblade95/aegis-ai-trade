import { requireUser } from "../auth/session";
import { ProtectedLayout } from "../components/protected-layout";
import { VirtualTradingWorkspace } from "../components/virtual-trading-workspace";
import { getVirtualTradingState } from "../../db/virtual-trading";

export const dynamic = "force-dynamic";

export default async function TradePage() {
  const user = await requireUser("/trade");
  const tradingState = await getVirtualTradingState(user.id);

  return (
    <ProtectedLayout user={user}>
      <section className="market-content virtual-trade-content">
        <header className="market-heading">
          <div>
            <p className="eyebrow">VIRTUAL TRADING</p>
            <h1>Practice with virtual USD.</h1>

            <p>
              Use live reference prices to place persistent virtual
              market and limit orders. Positions, order history, and
              trade notes remain private to your account.
            </p>
          </div>

          <span className="simulation-badge">Virtual funds only</span>
        </header>

        <aside className="market-warning virtual-trade-warning">
          <strong>No real-money execution</strong>

          <p>
            This environment uses virtual USD and simulated fills.
            Results do not represent guaranteed execution, fees,
            slippage, liquidity, taxes, or investment performance.
          </p>
        </aside>

        <VirtualTradingWorkspace initialState={tradingState} />
      </section>
    </ProtectedLayout>
  );
}
