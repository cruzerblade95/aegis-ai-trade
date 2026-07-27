# Aegis AI Trade

A premium educational market-learning platform with live reference
candlesticks, risk-aware AI learning tools, virtual wallet workflows, plan
management, an academy, and an admin control center.

> Aegis is an educational prototype. It does not accept real deposits, process withdrawals, execute brokerage orders, or promise investment returns.

## Product overview

Aegis helps users practice a repeatable market-learning process:

1. Observe real, provider-sourced reference candles.
2. Ask for plain-language, risk-aware explanations.
3. Record decisions and review habits.
4. Explore plans and lessons using virtual credits.

## Current features

- Responsive Obsidian Signal landing page
- Selectable Kraken or Twelve Data market provider
- Live BTC/USD, ETH/USD, and SOL/USD candlesticks with either provider
- XAU/USD candlesticks with Twelve Data (shown as unavailable with Kraken)
- Working 1m, 5m, 1h, and 1D timeframe controls
- Kraken WebSocket candle updates with a thirty-second REST fallback
- Thirty-second polling for Twelve Data with visible connection and error states
- Optional 20-period simple moving average
- Working Positions, Orders, History, and Trade journal panels
- Persistent personal watchlists for supported learning markets
- Configurable educational price thresholds with pause and delete controls
- Persistent learning-journal observations with edit and delete controls
- Market, timeframe, risk, and later-reflection fields for each journal entry
- Protected Market Explorer route with live chart controls and order-type glossary
- Protected Virtual Trade route with live provider-sourced charts
- Persistent virtual USD balance shared with the member dashboard
- Virtual market buy, market sell, limit buy, and limit sell orders
- Immediate chart refresh after virtual order actions
- Buy/sell execution markers and pending-limit price lines on the chart
- Server-priced Close Position action with automatic pending-sell cancellation
- Limit-order virtual USD reservation, position reservation, fill, and cancellation
- Persistent virtual positions, pending orders, execution history, and trade journal
- Scrollable record panels with responsive tables and sticky headers
- Selectable Virtual/Real environments with Real execution connection-gated
- Market selector shared by the homepage and signed-in Market Lab
- Virtual account balance
- Virtual top-up and withdrawal flows
- AI risk explanation panel
- Three educational AI plan tiers
- Learning academy with progress indicators
- Admin dashboard with user, plan, status, balance, and review-queue controls
- Accessibility labels, keyboard-friendly controls, and reduced-motion support
- Mobile, tablet, and desktop layouts

## Tech stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Vinext + Cloudflare Workers build target

## Local development

Requirements:

- Node.js 22.13 or newer
- npm

Windows Command Prompt, PowerShell, macOS, and Linux:

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. Press `Ctrl+C` in the terminal to
stop the development server.

Copy `.dev.vars.example` to `.dev.vars`, then set:

```env
MARKET_DATA_PROVIDER=kraken
```

Kraken's public OHLC endpoint does not require an API key. To switch back to
Twelve Data, use:

```env
MARKET_DATA_PROVIDER=twelve_data
TWELVE_DATA_API_KEY=your_actual_key
```

Restart the development server after changing `.dev.vars`. The Twelve Data key
stays server-side and is never sent to the browser.

Production checks:

```bash
npm run lint
npm run build
npm run validate:artifact
```

To preview the production build locally:

```bash
npm run build
npm run start
```

## Project structure

```text
app/
  api/trade/      Authenticated virtual-order and account endpoint
  api/market/     Validated server-side market-data proxy
  components/     Live chart, selectors, tabs, and journal interface
  globals.css     Visual system, layout, animation, and responsive styles
  layout.tsx      Metadata and root layout
  page.tsx        Landing page and interactive prototype workspace
  trade/          Protected virtual USD trading environment
.openai/
  hosting.json    Sites project configuration
README.md         Product, setup, release history, and roadmap
```

## Safety and compliance boundaries

The current release is intentionally paper-trading only:

- All balances and transactions are virtual.
- Market candles are read-only reference data and may be delayed.
- Viewed history and chart observations are educational interface state.
- AI output is educational, not personalized financial advice.
- There are no real payment credentials, wallets, or broker connections.
- There are no guaranteed-profit messages or automated real-money orders.

Before any real-money release, engage qualified legal and compliance professionals and integrate licensed providers for identity verification, KYC/AML, custody, payments, brokerage execution, audit logging, data licensing, security review, and age/jurisdiction controls.

## Roadmap

### v0.2 — Application foundation

- Separate authenticated user and admin routes
- Persistent database schema for profiles, plans, virtual ledgers, and journals
- Role-based access control
- Email verification and secure session management
- Automated unit, integration, and end-to-end tests

### v0.3 — Market learning

- AI explanation history with citations
- Structured learning review

### v0.4 — Operations

- Admin approval workflows
- Configurable plan catalogue
- Audit log and security event dashboard
- Notification centre
- Support ticket workflow

### v1.0 — Regulated integration track

- Jurisdiction and age eligibility controls
- Licensed KYC/AML provider
- Licensed payment and custody provider
- Regulated broker API integration
- Independent penetration test and security audit
- Legal review, risk disclosures, privacy policy, and terms
- Responsible AI evaluation and model-monitoring controls

## Release history

### v0.3.6 — 2026-07-28

- Added chart markers for filled virtual buys and sells.
- Added horizontal chart lines for pending limit orders.
- Added Kraken WebSocket OHLC updates with automatic reconnect and REST fallback.
- Added an immediate chart refresh after place, cancel, and close actions.
- Added a server-validated Close Position action using the latest provider price.
- Added automatic cancellation of pending limit sells before a full position close.
- Made the Real environment selectable with an explicit broker-connection state.
- Kept real balances and order execution disabled until a specific regulated provider is integrated.

### v0.3.5 — 2026-07-28

- Added the protected `/trade` virtual trading environment.
- Added a persistent virtual USD account balance for every user.
- Added market buy, market sell, limit buy, and limit sell.
- Added virtual positions, pending-order cancellation, execution history, and realized/unrealized P/L views.
- Added automatic limit-order checks against server-fetched provider prices.
- Added a persistent trade journal inside the trading workspace.
- Added scrollable Positions, Orders, History, and Trade Journal panels.
- Added a Virtual/Real selector while keeping Real trading disabled and disconnected.
- Kept deposits, withdrawals, broker credentials, and real-money execution out of the project.

### v0.3.3 — 2026-07-28

- Added database-backed learning-journal observations.
- Added market and timeframe context to every saved entry.
- Added guided evidence, uncertainty, and later-reflection fields.
- Added edit and delete controls with per-user ownership checks.
- Added a bounded, scrollable review history.
- Kept the journal educational and disconnected from order execution.

### v0.3.4 — 2026-07-28

- Added a protected `/market-explorer` route linked from the member navigation.
- Reused provider-sourced chart, market, timeframe, SMA, connection, and chart-journal controls.
- Added a view-only order-type glossary for buy, sell, market order, and limit order terms.
- Kept balances, virtual-order placement, and real trading unavailable on the new page.

### v0.3.2 — 2026-07-27

- Added database-backed personal market watchlists.
- Added configurable educational reference-price alerts.
- Added enable, pause, and delete alert controls.
- Linked watchlist markets directly to the selected live chart.
- Kept alerts read-only with no brokerage or order-execution integration.

### v0.3.1 — 2026-07-27

- Added `.dev.vars` provider selection between Kraken and Twelve Data.
- Made Kraken the default provider with no API key required.
- Added Kraken OHLC support for BTC/USD, ETH/USD, and SOL/USD.
- Disabled XAU/USD when Kraken is active and restored it under Twelve Data.

### v0.3.0 — 2026-07-27

- Replaced the manually animated SVG graph with provider-sourced OHLC candles.
- Added functional 1m, 5m, 1h, and 1D timeframe requests.
- Added BTC/USD, ETH/USD, SOL/USD, and XAU/USD selection.
- Added automatic refresh, loading, connection, and provider-error states.
- Added an optional SMA 20 overlay.
- Wired the Positions, Orders, History, and Trade journal tabs.
- Kept the workspace read-only with no brokerage or order execution.
- Added regression coverage for the live-data route and interactive controls.

### v0.1.0 — 2026-07-27

- Selected the Obsidian Signal visual direction.
- Built the responsive product landing page.
- Added a continuously updating simulated chart and market selector.
- Added virtual wallet and plan-purchase interactions.
- Added risk-aware AI learning content and academy.
- Added the admin control centre and review workflow.
- Added safety disclosures and the upgrade roadmap.

## Updating this README for each GitHub release

For every meaningful update:

1. Add the shipped feature to **Current features**.
2. Move completed work out of **Roadmap**.
3. Add a dated entry under **Release history**.
4. Update screenshots and environment keys if they changed.
5. Use a clear commit, for example:

```text
feat: add persistent paper-trading journal
docs: update roadmap and release history for v0.2.0
```

## License

No license has been selected yet. Add a license before accepting external contributions or distributing the source.
