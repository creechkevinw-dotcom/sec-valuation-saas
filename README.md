# SEC Valuation SaaS

Production-ready MVP for deterministic valuation from SEC XBRL filings:
- Supabase Auth + Postgres + Storage
- Next.js App Router API + UI
- Deterministic health score + projections + DCF + sensitivity
- PDF report export
- Free-tier usage limits

## What I Need From You (One-Time Inputs)

To keep your work in VS Code minimal, provide these once and I can do the rest of the wiring/edit flow:

1. `NEXT_PUBLIC_SUPABASE_URL`
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. `SUPABASE_SERVICE_ROLE_KEY`
4. `SEC_USER_AGENT` in SEC-required format, for example:
   - `sec-valuation-saas/1.0 your-email@domain.com`
5. `OPENAI_API_KEY` (required for AI analysis)
6. `FINNHUB_API_KEY` (required for live market, technicals, options, and trade recommendation engine)
7. Stripe (optional for MVP hook now, required before paid launch):
   - `STRIPE_SECRET_KEY`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_WEBHOOK_SECRET`
8. Deployment targets:
   - Supabase project ref + org
   - Vercel team/project (or permission to create)
   - GitHub repo URL to push this code

## APIs and Services Checklist

1. Supabase
   - Enable Auth (Email provider)
   - Create Storage bucket: `reports` (private)
   - Run SQL migration: `supabase/migrations/001_init.sql`
2. SEC Data API
   - No API key required
   - Must use valid `User-Agent` with contact email
3. Vercel
   - Add all environment variables
   - Deploy from GitHub repo
4. OpenAI API
   - Add `OPENAI_API_KEY`
5. Finnhub API
   - Add `FINNHUB_API_KEY`
   - Used by: live market snapshots, technical indicators, options chain, earnings, trade recommendations
6. Stripe (optional in this MVP phase)
   - Create products/prices for `pro`
   - Configure webhook endpoint

## Local Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` from `.env.example` and fill values.

3. Run dev server:
```bash
npm run dev
```

4. Validate quality gates:
```bash
npm run lint
npm run build
```

## Supabase Step-by-Step (Prod)

1. Create Supabase project.
2. In SQL editor, run:
   - `supabase/migrations/001_init.sql`
   - `supabase/migrations/002_ai_watchlist.sql`
   - `supabase/migrations/003_trade_recommendations.sql`
3. In Storage, create private bucket `reports`.
4. In Auth, ensure email auth is enabled.
5. Copy API keys from Project Settings -> API.
6. Put these into Vercel and local `.env.local`.

## Vercel Step-by-Step (Prod)

1. Push this folder to GitHub.
2. In Vercel, import the GitHub repo.
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SEC_USER_AGENT`
   - `OPENAI_API_KEY`
   - `FINNHUB_API_KEY`
   - Stripe vars (if enabled)
4. Deploy.
5. Smoke test:
   - Sign up/login
   - Run valuation for `MSFT`
   - Open `/dashboard`
   - Open report detail
   - Download PDF
   - Verify usage increments
   - Verify user cannot read another user's valuation

## Minimal-Touch Operating Model With Codex

If you want me to handle nearly everything, give me this block filled once:

```txt
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SEC_USER_AGENT=
OPENAI_API_KEY=
FINNHUB_API_KEY=
VERCEL_PROJECT_NAME=
VERCEL_TEAM=
GITHUB_REPO_URL=
STRIPE_SECRET_KEY= (optional)
STRIPE_PUBLISHABLE_KEY= (optional)
STRIPE_WEBHOOK_SECRET= (optional)
```

Then I can:
1. Edit code and config
2. Add missing integrations
3. Prepare deployment config
4. Give you exact one-command/one-click actions when auth tokens must be entered manually

## Current Scope Lock

Included:
- Auth
- Dashboard
- Ticker valuation flow
- SEC ingestion
- 5Y normalization
- Health score
- Deterministic projections + DCF + sensitivity
- Saved reports
- PDF export
- Usage tracking

Excluded:
- Real-time pricing
- Portfolio tracking
- Sentiment
- Monte Carlo
- Analyst consensus
- Multi-currency/international filings
- Collaboration features
