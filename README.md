# Aegis AI Trade

A premium educational paper-trading platform prototype with continuously updating simulated charts, risk-aware AI learning tools, virtual wallet workflows, plan management, an academy, and an admin control center.

> Aegis is an educational prototype. It does not accept real deposits, process withdrawals, execute brokerage orders, or promise investment returns.

## Product overview

Aegis helps users practice a repeatable market-learning process:

1. Observe simulated market movement.
2. Ask for plain-language, risk-aware explanations.
3. Record decisions and review habits.
4. Explore plans and lessons using virtual credits.

## Current features

- Responsive Obsidian Signal landing page
- Continuously updating simulated market chart
- Currency and market selector
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
  globals.css     Visual system, layout, animation, and responsive styles
  layout.tsx      Metadata and root layout
  page.tsx        Landing page and interactive prototype workspace
.openai/
  hosting.json    Sites project configuration
README.md         Product, setup, release history, and roadmap
```

## Safety and compliance boundaries

The current release is intentionally paper-trading only:

- All balances and transactions are virtual.
- Market movement is simulated and is not live brokerage data.
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

- Licensed delayed market-data integration
- Candlestick and technical-indicator components
- Watchlists and alert simulations
- AI explanation history with citations
- Structured trade journal and performance review

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
