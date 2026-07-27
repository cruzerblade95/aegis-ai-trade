"use client";

import { useEffect, useMemo, useState } from "react";

type View = "home" | "terminal" | "plans" | "academy" | "admin";
type Modal = "funds" | "withdraw" | null;

const markets = [
  { symbol: "EUR/USD", name: "Euro / U.S. Dollar", price: 1.09342, change: 0.21 },
  { symbol: "GBP/USD", name: "British Pound / U.S. Dollar", price: 1.27485, change: -0.24 },
  { symbol: "USD/JPY", name: "U.S. Dollar / Japanese Yen", price: 155.682, change: 0.3 },
  { symbol: "XAU/USD", name: "Gold / U.S. Dollar", price: 2354.71, change: 0.37 },
  { symbol: "NAS100", name: "Nasdaq 100 Index", price: 18732.45, change: -0.12 },
];

const seedSeries: Record<string, number[]> = {
  "EUR/USD": [41, 37, 45, 39, 34, 42, 47, 43, 50, 58, 53, 61, 57, 49, 55, 63, 69, 64, 72, 66, 75, 70, 78, 82, 74, 68, 72, 61, 55, 58],
  "GBP/USD": [59, 63, 57, 52, 48, 54, 45, 49, 43, 39, 44, 35, 41, 38, 31, 36, 29, 34, 26, 32, 28, 23, 29, 24, 20, 26, 21, 18, 23, 19],
  "USD/JPY": [35, 38, 42, 40, 47, 45, 52, 49, 56, 61, 58, 66, 63, 69, 65, 73, 70, 76, 72, 79, 75, 82, 78, 84, 80, 87, 83, 89, 86, 92],
  "XAU/USD": [38, 45, 42, 49, 47, 55, 51, 58, 53, 62, 59, 66, 63, 70, 67, 74, 69, 78, 73, 82, 77, 85, 81, 88, 84, 91, 87, 94, 90, 96],
  NAS100: [52, 48, 55, 50, 58, 53, 61, 56, 64, 59, 67, 63, 70, 66, 74, 69, 77, 72, 80, 75, 83, 78, 86, 81, 89, 84, 92, 87, 94, 90],
};

const plans = [
  { name: "Explorer", price: 0, tone: "cyan", features: ["Live simulated charts", "3 AI explanations / day", "Practice journal"] },
  { name: "Analyst", price: 19, tone: "green", features: ["Unlimited AI explanations", "Risk scenario lab", "Advanced journal insights"], popular: true },
  { name: "Strategist", price: 49, tone: "violet", features: ["Portfolio simulations", "Custom learning paths", "Priority learning support"] },
];

const users = [
  { name: "Aina Rahman", email: "aina@example.test", plan: "Analyst", status: "Active", balance: "$96,420" },
  { name: "Marcus Lee", email: "marcus@example.test", plan: "Explorer", status: "Review", balance: "$100,000" },
  { name: "Sara Ibrahim", email: "sara@example.test", plan: "Strategist", status: "Active", balance: "$121,804" },
  { name: "Daniel Tan", email: "daniel@example.test", plan: "Analyst", status: "Paused", balance: "$88,310" },
];

function Sparkline({ positive }: { positive: boolean }) {
  return (
    <span className={`spark ${positive ? "positive" : "negative"}`} aria-hidden="true">
      <i /><i /><i /><i /><i /><i /><i />
    </span>
  );
}

function Logo() {
  return (
    <button className="brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Aegis AI Trade home">
      <span className="shield">A</span>
      <span>Aegis <b>AI Trade</b></span>
    </button>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [selected, setSelected] = useState(markets[0]);
  const [series, setSeries] = useState(seedSeries["EUR/USD"]);
  const [balance, setBalance] = useState(100000);
  const [activePlan, setActivePlan] = useState("Explorer");
  const [modal, setModal] = useState<Modal>(null);
  const [amount, setAmount] = useState("1000");
  const [toast, setToast] = useState("");
  const [adminFilter, setAdminFilter] = useState("All");

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSeries((current) => {
        const last = current[current.length - 1];
        const next = Math.max(10, Math.min(96, last + (Math.random() - 0.47) * 13));
        return [...current.slice(1), next];
      });
    }, 1400);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const chartPath = useMemo(
    () => series.map((value, index) => `${index === 0 ? "M" : "L"} ${index * (720 / (series.length - 1))} ${210 - value * 1.85}`).join(" "),
    [series],
  );

  const displayPrice = useMemo(() => {
    const movement = (series[series.length - 1] - 50) * (selected.price < 10 ? 0.00002 : selected.price < 1000 ? 0.003 : 0.16);
    return selected.price + movement;
  }, [selected, series]);

  function selectMarket(market: typeof markets[number]) {
    setSelected(market);
    setSeries(seedSeries[market.symbol]);
  }

  function navigate(next: View) {
    setView(next);
    window.setTimeout(() => document.querySelector("#app-view")?.scrollIntoView({ behavior: "smooth" }), 30);
  }

  function submitFunds() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setToast("Enter a valid virtual amount.");
      return;
    }
    if (modal === "withdraw" && value > balance) {
      setToast("Virtual withdrawal exceeds your practice balance.");
      return;
    }
    setBalance((current) => modal === "funds" ? current + value : current - value);
    setToast(modal === "funds" ? `$${value.toLocaleString()} added to your virtual balance.` : `Virtual withdrawal of $${value.toLocaleString()} recorded.`);
    setModal(null);
  }

  return (
    <main>
      <div className="education-strip">
        <span><i /> EDUCATIONAL USE ONLY</span>
        <p>Aegis AI Trade uses virtual funds for learning and practice.</p>
        <span className="system"><i /> Live simulation active</span>
      </div>

      <header className="nav-shell">
        <Logo />
        <nav aria-label="Main navigation">
          <button onClick={() => navigate("terminal")}>Markets</button>
          <button onClick={() => navigate("terminal")}>AI Insights</button>
          <button onClick={() => navigate("plans")}>Plans</button>
          <button onClick={() => navigate("academy")}>Academy</button>
        </nav>
        <div className="nav-actions">
          <button className="icon-button" aria-label="Toggle appearance">☼</button>
          <button className="language">◎ EN⌄</button>
          <button className="button ghost" onClick={() => { navigate("terminal"); setToast("Practice account opened."); }}>Open practice app</button>
        </div>
      </header>

      <section className="ticker" aria-label="Simulated market ticker">
        <div className="ticker-track">
          {[...markets, ...markets].map((market, index) => (
            <button key={`${market.symbol}-${index}`} onClick={() => { selectMarket(market); navigate("terminal"); }}>
              <span><b>{market.symbol}</b><small>{market.price.toLocaleString(undefined, { maximumFractionDigits: 5 })}</small></span>
              <span className={market.change > 0 ? "up" : "down"}>{market.change > 0 ? "+" : ""}{market.change}%</span>
              <Sparkline positive={market.change > 0} />
            </button>
          ))}
        </div>
      </section>

      {view === "home" ? (
        <>
          <section className="hero" id="app-view">
            <div className="hero-copy">
              <p className="eyebrow">PRACTICE • LEARN • IMPROVE</p>
              <h1>AI-assisted market practice, <span>built for clarity.</span></h1>
              <p className="lead">Build market literacy with virtual funds, responsive charts, and risk-aware AI explanations—without putting real money at risk.</p>
              <div className="hero-actions">
                <button className="button primary" onClick={() => navigate("terminal")}>Start paper trading <span>→</span></button>
                <button className="button secondary" onClick={() => navigate("academy")}>Explore the academy <span>→</span></button>
              </div>
              <div className="trust-row">
                <div><span>⌾</span><b>Risk-aware insights</b><small>Understand risk before action.</small></div>
                <div><span>▥</span><b>Practice with purpose</b><small>Test ideas with virtual funds.</small></div>
                <div><span>◇</span><b>Learn continuously</b><small>Turn activity into lessons.</small></div>
              </div>
              <p className="fine-print">ⓘ No real funds. No brokerage execution. No guaranteed returns.</p>
            </div>
            <TerminalCard selected={selected} setSelected={selectMarket} chartPath={chartPath} displayPrice={displayPrice} balance={balance} compact onOpen={() => navigate("terminal")} />
          </section>

          <section className="feature-section">
            <p className="eyebrow center">ONE WORKSPACE, THREE LEARNING LOOPS</p>
            <h2>From market movement to better decisions.</h2>
            <div className="feature-grid">
              <article><span>01</span><h3>Observe</h3><p>Follow continuously updating simulated markets with focused watchlists and clear price context.</p></article>
              <article><span>02</span><h3>Understand</h3><p>Ask AI to explain volatility, drawdown, trend structure, and position-sizing concepts in plain language.</p></article>
              <article><span>03</span><h3>Reflect</h3><p>Review practice decisions in a journal designed to reveal habits—not chase winning streaks.</p></article>
            </div>
          </section>

          <section className="cta-panel">
            <div><p className="eyebrow">PAPER TRADING, REFRAMED</p><h2>Train your process before you risk capital.</h2></div>
            <button className="button primary" onClick={() => navigate("terminal")}>Enter the practice terminal →</button>
          </section>
        </>
      ) : (
        <section className="workspace" id="app-view">
          <aside className="side-nav">
            <div>
              <p className="side-label">Workspace</p>
              <button className={view === "terminal" ? "active" : ""} onClick={() => setView("terminal")}><span>⌁</span>Terminal</button>
              <button className={view === "plans" ? "active" : ""} onClick={() => setView("plans")}><span>◇</span>AI plans</button>
              <button className={view === "academy" ? "active" : ""} onClick={() => setView("academy")}><span>▤</span>Academy</button>
              <button className={view === "admin" ? "active" : ""} onClick={() => setView("admin")}><span>⚙</span>Admin demo</button>
            </div>
            <div className="account-card">
              <span>NA</span><div><b>Practice user</b><small>{activePlan} plan</small></div>
            </div>
          </aside>
          <div className="workspace-main">
            {view === "terminal" && (
              <>
                <div className="page-head">
                  <div><p className="eyebrow">PAPER TRADING TERMINAL</p><h2>Your market practice workspace</h2></div>
                  <div className="wallet-actions">
                    <div><small>Virtual balance</small><b>${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</b></div>
                    <button className="button secondary" onClick={() => setModal("withdraw")}>Withdraw virtual</button>
                    <button className="button primary" onClick={() => setModal("funds")}>Add virtual funds</button>
                  </div>
                </div>
                <div className="terminal-layout">
                  <TerminalCard selected={selected} setSelected={selectMarket} chartPath={chartPath} displayPrice={displayPrice} balance={balance} />
                  <aside className="insight-panel">
                    <div className="panel-title"><span>✦</span><b>AI Risk Insight</b><small>Educational</small></div>
                    <div className="insight-score"><span>72</span><div><b>Moderate volatility</b><small>Based on this simulation window</small></div></div>
                    <article><p>What changed?</p><h3>Momentum strengthened, but range expanded.</h3><p>The latest simulated candles show higher short-term movement. A larger range can increase both opportunity and downside.</p></article>
                    <div className="lesson"><span>◎</span><p><b>Risk concept</b>Smaller practice positions can help you study volatile conditions without over-weighting one idea.</p></div>
                    <button className="button secondary full" onClick={() => setToast("AI learning note saved to your journal.")}>Save explanation</button>
                  </aside>
                </div>
              </>
            )}

            {view === "plans" && (
              <div className="content-view">
                <div className="page-head"><div><p className="eyebrow">AI LEARNING PLANS</p><h2>Choose the depth of your practice</h2><p>These prototype purchases use virtual credits only.</p></div></div>
                <div className="plan-grid">
                  {plans.map((plan) => (
                    <article className={`plan-card ${plan.popular ? "featured" : ""}`} key={plan.name}>
                      {plan.popular && <span className="popular">MOST POPULAR</span>}
                      <p className="plan-name">{plan.name}</p>
                      <h3>{plan.price === 0 ? "Free" : `$${plan.price}`}<small>{plan.price > 0 && "/ month"}</small></h3>
                      <p>Structured tools for disciplined market learning.</p>
                      <ul>{plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul>
                      <button className={`button ${activePlan === plan.name ? "secondary" : "primary"} full`} onClick={() => { setActivePlan(plan.name); setToast(`${plan.name} activated with virtual credits.`); }}>
                        {activePlan === plan.name ? "Current plan" : `Choose ${plan.name}`}
                      </button>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {view === "academy" && (
              <div className="content-view">
                <div className="page-head"><div><p className="eyebrow">AEGIS ACADEMY</p><h2>Learn the mechanics before the markets</h2><p>Short, practical lessons with progress that stays on this device.</p></div></div>
                <div className="academy-grid">
                  {[
                    ["01", "Market foundations", "8 lessons", "62%", "How prices move, spread, sessions, and order basics."],
                    ["02", "Risk before reward", "6 lessons", "35%", "Drawdown, position sizing, and protecting a practice account."],
                    ["03", "Reading price action", "10 lessons", "18%", "Trend, range, support, resistance, and volatility."],
                    ["04", "Build a review habit", "5 lessons", "0%", "Journal decisions and separate process from outcomes."],
                  ].map(([number, title, lessons, progress, text]) => (
                    <article key={title}><span>{number}</span><small>{lessons}</small><h3>{title}</h3><p>{text}</p><div className="progress"><i style={{ width: progress }} /></div><button onClick={() => setToast(`${title} opened in demo mode.`)}>Continue · {progress}</button></article>
                  ))}
                </div>
              </div>
            )}

            {view === "admin" && (
              <div className="content-view">
                <div className="page-head"><div><p className="eyebrow">ADMIN CONTROL CENTER</p><h2>Platform overview</h2><p>Prototype controls use sample data and do not affect real accounts.</p></div><button className="button secondary" onClick={() => setToast("Demo report exported.")}>Export report</button></div>
                <div className="stats-grid">
                  <article><small>Practice users</small><b>2,481</b><span className="up">+12.4% this month</span></article>
                  <article><small>Active AI plans</small><b>1,308</b><span className="up">+8.1% this month</span></article>
                  <article><small>Virtual transactions</small><b>18,942</b><span>Simulation only</span></article>
                  <article><small>Items for review</small><b>14</b><span className="warning">Needs attention</span></article>
                </div>
                <div className="admin-grid">
                  <section className="table-card">
                    <div className="table-head"><div><h3>User management</h3><p>Review sample accounts, plans, and status.</p></div><select value={adminFilter} onChange={(e) => setAdminFilter(e.target.value)}><option>All</option><option>Active</option><option>Review</option><option>Paused</option></select></div>
                    <div className="table-wrap"><table><thead><tr><th>User</th><th>Plan</th><th>Status</th><th>Virtual balance</th><th /></tr></thead><tbody>
                      {users.filter((user) => adminFilter === "All" || user.status === adminFilter).map((user) => <tr key={user.email}><td><b>{user.name}</b><small>{user.email}</small></td><td>{user.plan}</td><td><span className={`status ${user.status.toLowerCase()}`}>{user.status}</span></td><td>{user.balance}</td><td><button onClick={() => setToast(`${user.name}'s demo profile opened.`)}>•••</button></td></tr>)}
                    </tbody></table></div>
                  </section>
                  <aside className="activity-card"><h3>Review queue</h3><p>Recent simulated actions requiring attention.</p>{["Virtual withdrawal review", "Plan access request", "Profile verification demo", "AI feedback report"].map((item, index) => <button key={item} onClick={() => setToast(`${item} marked as reviewed.`)}><span>{index + 1}</span><div><b>{item}</b><small>{index + 2} minutes ago</small></div><i>→</i></button>)}</aside>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <footer>
        <Logo />
        <p>Educational paper-trading prototype. Market data is simulated and delayed.</p>
        <div><button onClick={() => navigate("academy")}>Risk disclosure</button><button onClick={() => navigate("admin")}>Admin demo</button><span>© 2026 Aegis</span></div>
      </footer>

      {modal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setModal(null)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" aria-label="Close" onClick={() => setModal(null)}>×</button>
            <span className="modal-icon">{modal === "funds" ? "+" : "↗"}</span>
            <p className="eyebrow">SIMULATION ONLY</p>
            <h2 id="modal-title">{modal === "funds" ? "Add virtual funds" : "Record virtual withdrawal"}</h2>
            <p>No payment method is used. This changes only your local practice balance.</p>
            <label>Virtual amount (USD)<input autoFocus inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
            <button className="button primary full" onClick={submitFunds}>Confirm virtual transaction</button>
          </section>
        </div>
      )}
      {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
    </main>
  );
}

function TerminalCard({
  selected,
  setSelected,
  chartPath,
  displayPrice,
  balance,
  compact = false,
  onOpen,
}: {
  selected: typeof markets[number];
  setSelected: (market: typeof markets[number]) => void;
  chartPath: string;
  displayPrice: number;
  balance: number;
  compact?: boolean;
  onOpen?: () => void;
}) {
  return (
    <section className={`terminal-card ${compact ? "compact" : ""}`}>
      <div className="terminal-top">
        <label>
          <span className="asset-dot">{selected.symbol.slice(0, 2)}</span>
          <select value={selected.symbol} onChange={(event) => setSelected(markets.find((market) => market.symbol === event.target.value) ?? markets[0])}>
            {markets.map((market) => <option key={market.symbol}>{market.symbol}</option>)}
          </select>
          <small>{selected.name}</small>
        </label>
        <span className="paper-pill">PAPER</span>
        <div className="mini-balance"><small>Virtual balance</small><b>{balance.toLocaleString()} USD</b></div>
      </div>
      <div className="chart-controls">
        <div>{["1m", "5m", "15m", "1H", "4H", "1D"].map((time) => <button className={time === "15m" ? "active" : ""} key={time}>{time}</button>)}</div>
        <button>Indicators⌄</button>
        <span>│⌁ ⛶</span>
      </div>
      <div className="ohlc"><span>O {displayPrice.toFixed(selected.price < 10 ? 5 : 2)}</span><span>H {(displayPrice * 1.0014).toFixed(selected.price < 10 ? 5 : 2)}</span><span>L {(displayPrice * .9988).toFixed(selected.price < 10 ? 5 : 2)}</span><span className="up">C {displayPrice.toFixed(selected.price < 10 ? 5 : 2)} +0.02%</span></div>
      <div className="chart">
        <div className="grid-lines" />
        <svg viewBox="0 0 720 220" preserveAspectRatio="none" role="img" aria-label={`${selected.symbol} continuously updating simulated price chart`}>
          <defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#21e7b0" stopOpacity=".35" /><stop offset="1" stopColor="#21e7b0" stopOpacity="0" /></linearGradient></defs>
          <path className="area" d={`${chartPath} L 720 220 L 0 220 Z`} />
          <path className="line" d={chartPath} />
        </svg>
        <div className="live-price" style={{ top: `${Math.max(18, Math.min(184, 210 - (displayPrice / selected.price) * 98))}px` }}>{displayPrice.toFixed(selected.price < 10 ? 5 : 2)}</div>
        <span className="live-label"><i /> LIVE SIMULATION</span>
      </div>
      <div className="terminal-tabs"><button className="active">Positions</button><button>Orders</button><button>History</button><button>Trade journal</button></div>
      <div className="empty-state"><span>⌁</span><div><b>No open practice positions</b><small>Explore market movement before recording an idea.</small></div>{onOpen && <button className="button secondary" onClick={onOpen}>Open terminal</button>}</div>
    </section>
  );
}
