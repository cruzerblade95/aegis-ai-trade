import { requireUser } from "../auth/session";
import { ProtectedLayout } from "../components/protected-layout";
import { VirtualTradingWorkspace } from "../components/virtual-trading-workspace";
import { getVirtualTradingState } from "../../db/virtual-trading";
import { getUserPlan } from "../../db/plans";

export const dynamic = "force-dynamic";

export default async function TradePage() {
  const user = await requireUser("/trade");
  const [tradingState, plan] = await Promise.all([getVirtualTradingState(user.id), getUserPlan(user.id)]);

  return (
    <ProtectedLayout user={user}>
      <section className="market-content virtual-trade-content">
        <header className="market-heading">
          <div>
            <p className="eyebrow">AI-ASSISTED TRADING</p>
            <h1>Practice with account USD.</h1>

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
            This environment uses account USD and simulated fills.
            Results do not represent guaranteed execution, fees,
            slippage, liquidity, taxes, or investment performance.
          </p>
        </aside>

        <VirtualTradingWorkspace initialState={tradingState} plan={plan} />
      </section>
    </ProtectedLayout>
  );
}
