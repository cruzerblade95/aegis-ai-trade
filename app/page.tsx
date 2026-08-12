"use client";

import { useEffect, useState } from "react";
import { HomeAuthActions } from "./components/home-auth-actions";
import {
  LiveMarketTerminal,
  liveMarkets,
  type MarketKey,
} from "./components/live-market-terminal";

type View = "home" | "terminal" | "plans" | "academy" | "admin";
type Modal = "funds" | "withdraw" | null;

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

function Logo({ onHome }: { onHome: () => void }) {
  return (
    <button className="brand" onClick={onHome} aria-label="Return to Aegis AI Trade homepage">
      <span className="aegis-logo" aria-hidden="true">
        <svg viewBox="0 0 48 52" role="img">
          <path className="logo-shell" d="M24 2 43 10v14c0 12-7.8 21.7-19 26C12.8 45.7 5 36 5 24V10L24 2Z" />
          <path className="logo-a" d="m14 35 10-22 10 22M18.5 27h11" />
          <path className="logo-signal" d="M35 13.5h5M37.5 11v5" />
        </svg>
      </span>
      <span className="brand-copy"><strong>Aegis</strong><b>AI Trade</b><small>Autonomous strategy engine</small></span>
    </button>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [selectedKey, setSelectedKey] =
    useState<(typeof liveMarkets)[number]["key"]>("BTCUSD");
  const [availableSymbols, setAvailableSymbols] = useState<
    MarketKey[] | null
  >(null);
  const [balance, setBalance] = useState(100000);
  const [activePlan, setActivePlan] = useState("Explorer");
  const [modal, setModal] = useState<Modal>(null);
  const [amount, setAmount] = useState("1000");
  const [toast, setToast] = useState("");
  const [adminFilter, setAdminFilter] = useState("All");

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

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
        <span><i /> AI TRADE AUTOMATION</span>
        <p>Plan-powered strategy scanning, automated entries, TP/SL and position management.</p>
        <span className="system"><i /> Background engine online</span>
      </div>

      <header className="nav-shell">
        <Logo onHome={() => { setView("home"); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
        <nav aria-label="Main navigation">
          <button onClick={() => navigate("home")}>Home</button>
          <button onClick={() => navigate("terminal")}>Live Terminal</button>
          <button onClick={() => navigate("terminal")}>AI Strategies</button>
          <button onClick={() => navigate("plans")}>Plans</button>
          <button onClick={() => navigate("academy")}>How It Works</button>
        </nav>
        <HomeAuthActions />
      </header>

      <section className="ticker" aria-label="Live market shortcuts">
        <div className="ticker-track">
          {[...liveMarkets, ...liveMarkets].map((market, index) => (
            <button
              aria-disabled={
                availableSymbols !== null &&
                !availableSymbols.includes(market.key)
              }
              disabled={
                availableSymbols !== null &&
                !availableSymbols.includes(market.key)
              }
              key={`${market.key}-${index}`}
              onClick={() => {
                setSelectedKey(market.key);
                navigate("terminal");
              }}
            >
              <span>
                <b>{market.label}</b>
                <small>{market.name}</small>
              </span>
              <span className="ticker-live">
                {availableSymbols !== null &&
                !availableSymbols.includes(market.key)
                  ? "Unavailable with selected provider"
                  : "Open live chart →"}
              </span>
            </button>
          ))}
        </div>
      </section>

      {view === "home" ? (
        <>
          <section className="hero" id="app-view">
            <div className="hero-copy">
              <p className="eyebrow">AUTOMATE • MONITOR • CONTROL</p>
              <h1>Automated AI trading, <span>guided by strategy.</span></h1>
              <p className="lead">Run plan-based AI strategies that scan markets, open independent positions, apply TP/SL, and manage exits in the background across Virtual and Current Balance environments.</p>
              <div className="hero-actions">
                <button className="button primary" onClick={() => navigate("terminal")}>Launch AI Trade <span>→</span></button>
                <button className="button secondary" onClick={() => navigate("plans")}>View AI plans <span>→</span></button>
              </div>
              <div className="trust-row">
                <div><span>⌾</span><b>Multi-strategy analysis</b><small>RSI, Bollinger Bands, momentum and trend confirmation.</small></div>
                <div><span>▥</span><b>Automated execution</b><small>Open and manage positions using saved settings.</small></div>
                <div><span>◇</span><b>Always-on monitoring</b><small>Background scans continue across user pages.</small></div>
              </div>
              <p className="fine-print">ⓘ AI trading involves risk. Strategy signals and higher-tier plans do not guarantee profit or winning trades.</p>
            </div>
            <LiveMarketTerminal
              balance={balance}
              compact
              onAvailabilityChange={setAvailableSymbols}
              onMarketChange={setSelectedKey}
              onOpen={() => navigate("terminal")}
              selectedKey={selectedKey}
            />
          </section>

          <section className="feature-section">
            <p className="eyebrow center">ONE ENGINE, THREE AUTOMATED WORKFLOWS</p>
            <h2>From live signals to managed positions.</h2>
            <div className="feature-grid">
              <article><span>01</span><h3>Scan</h3><p>The AI engine monitors supported markets using the strategy set available in the user’s active plan.</p></article>
              <article><span>02</span><h3>Execute</h3><p>Qualified signals can open independent Buy or Sell tickets with user-defined volume, Take Profit and Stop Loss.</p></article>
              <article><span>03</span><h3>Manage</h3><p>Background automation monitors open AI positions and can close them through TP, SL or strategy reversal rules.</p></article>
            </div>
          </section>

          <section className="cta-panel">
            <div><p className="eyebrow">AI TRADING, UNDER YOUR CONTROL</p><h2>Choose a plan, configure your risk settings, and let the AI engine monitor the market.</h2></div>
            <button className="button primary" onClick={() => navigate("terminal")}>Open the AI Trade terminal →</button>
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
                  <LiveMarketTerminal
                    balance={balance}
                    onAvailabilityChange={setAvailableSymbols}
                    onMarketChange={setSelectedKey}
                    selectedKey={selectedKey}
                  />
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
        <Logo onHome={() => { setView("home"); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
        <p>AI-powered automated trading platform. Market data and execution timing may vary by provider.</p>
        <div><button onClick={() => navigate("academy")}>Risk disclosure</button><button onClick={() => navigate("plans")}>Plans</button><span>© 2026 Aegis</span></div>
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
