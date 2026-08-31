# HEOR Career Agent — Phase 1

A private, GitHub-ready internship discovery dashboard focused on **Summer 2027 U.S. PhD/graduate opportunities** in:

- Health Economics & Outcomes Research (HEOR)
- Real-World Evidence (RWE) / Real-World Data
- Epidemiology / Pharmacoepidemiology
- Market Access / Value & Access
- Patient-Centered Outcomes / PRO / Patient Preference

Phase 1 intentionally uses deterministic filtering rather than an LLM. Phase 2 can add GPT-based eligibility, sponsorship, fit and CV analysis without changing the search foundation.

## What Phase 1 already does

- Runs a live job search through a server-side provider integration.
- Searches four focused HEOR/RWE/market-access/patient-centered query groups.
- Enforces a **hard server-side maximum of 30 days**.
- Rejects ambiguous dates such as `1 month ago` rather than guessing they are within 30 days.
- Requires a Summer 2027 signal.
- Requires an internship signal.
- Requires a PhD/doctoral/graduate-level signal.
- Requires at least one HEOR-adjacent domain signal.
- Requires at least one current application route from the job provider.
- Rejects obvious closed/expired language.
- Deduplicates semantically identical title/company/location combinations.
- Gives each retained job a transparent deterministic relevance score (not an ATS score).
- Shows category, age, work-arrangement signals, source, keywords and application link.
- Stores saved jobs in the browser.
- Optionally persists search runs and jobs to Supabase for later phases.
- Uses Supabase Auth plus a single allowed email check to prevent public abuse of the search API.

## Architecture

```text
GitHub Pages (React + Vite)
          |
          | authenticated request
          v
Supabase Edge Function: search-jobs
          |
          | private SERPAPI_KEY
          v
SerpApi Google Jobs API
          |
          v
strict filter -> dedupe -> score -> dashboard
          |
          +--> Supabase Postgres (history; optional but recommended)
```

The private job-provider key never appears in the browser or GitHub Pages bundle.

## 1. Requirements

- Node.js 20.19+ or 22.12+ (Node 22 is recommended for the included workflow)
- A Supabase project
- Supabase CLI for local/deployment workflow
- A SerpApi API key with Google Jobs access
- A GitHub repository if you want GitHub Pages deployment

## 2. Local frontend setup

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_BROWSER_SAFE_PUBLISHABLE_OR_ANON_KEY
```

Do **not** place the SerpApi key, Supabase secret key, or service-role key in a `VITE_` variable. Vite variables are bundled into the browser.

## 3. Create the database tables

Run the contents of:

```text
supabase/migrations/001_phase1.sql
```

in the Supabase SQL Editor, or initialize/link the CLI and use your normal migration workflow.

The tables are:

- `search_runs`
- `job_postings`

RLS permits authenticated users to read only their own rows. Writes are done by the Edge Function.

## 4. Create your Supabase Auth user

In the Supabase Dashboard:

1. Open **Authentication > Users**.
2. Create your account using the email you want to authorize.
3. Use that email in the `ALLOWED_EMAIL` secret below.

For a private single-user deployment, disable public sign-ups unless you intentionally want additional accounts.

## 5. Configure Edge Function secrets

Set these server-side secrets:

```bash
supabase secrets set SERPAPI_KEY=YOUR_SERPAPI_KEY
supabase secrets set ALLOWED_EMAIL=your-email@example.com
```

Supabase automatically provides the project URL and its platform keys to hosted Edge Functions. The included function supports both newer publishable/secret key environment maps and the legacy anon/service-role variables.

## 6. Deploy the search function

Link your Supabase project if you have not already:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy search-jobs
```

The function requires an authenticated request and then checks the signed-in user's email against `ALLOWED_EMAIL`.

## 7. Run locally

```bash
npm run dev
```

Sign in with the Supabase Auth user you created, then click **Run search now**.

## 8. Deploy from GitHub Actions

The repo includes `.github/workflows/deploy.yml`. A push to `main` now deploys **both** the Supabase backend and the GitHub Pages frontend. Pull requests only build the app and do not deploy.

### GitHub repository secrets

Go to **Settings > Secrets and variables > Actions > New repository secret** and add:

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase publishable/anon key used by the browser
- `SUPABASE_ACCESS_TOKEN` — personal Supabase access token for the CLI
- `SUPABASE_PROJECT_ID` — your Supabase project reference ID
- `SUPABASE_DB_PASSWORD` — database password for migration deployment
- `SERPAPI_KEY` — private SerpApi key; the workflow syncs it to Supabase Edge Function secrets
- `ALLOWED_EMAIL` — the single email address allowed to use the search function

Do **not** put these values in source code or commit a `.env` file.

### Enable GitHub Pages

In the repository, open **Settings > Pages** and set **Source** to **GitHub Actions**.

### What happens on every push to `main`

```text
Push to main
    ↓
Build React/Vite frontend
    ↓
Link Supabase project
    ↓
Apply supabase/migrations/*
    ↓
Sync SERPAPI_KEY + ALLOWED_EMAIL to Supabase
    ↓
Deploy Supabase Edge Functions
    ↓
Deploy dist/ to GitHub Pages
```

You can also run the same deployment manually from **Actions > CI and Deploy HEOR Career Agent > Run workflow**.

> Note: the `.github` directory begins with a dot, so some local file browsers hide it by default. GitHub itself will display `.github/workflows/deploy.yml` normally after you push the repository.

## Search policy in this version

A job is retained only when all of these gates pass:

```text
posting age known AND <= 30 days
AND active apply route detected
AND not obviously expired/closed
AND internship signal detected
AND Summer 2027 signal detected
AND PhD/doctoral/graduate-level signal detected
AND HEOR/RWE/epidemiology/market access/patient-centered signal detected
```

This policy is deliberately conservative. A posting with an unknown date is excluded instead of being silently treated as current.

## Provider behavior

Phase 1 uses SerpApi's Google Jobs endpoint. One run currently makes four search requests (one per query group), and the provider typically returns up to 10 jobs on the first page per query. The app then performs its own strict filtering and deduplication.

This means Phase 1 is a strong discovery foundation, but it is not a claim of exhaustive coverage of every employer website. Later phases can add more authorized providers and direct company-career feeds behind the same normalized job interface.

## What is deliberately NOT in Phase 1

- GPT/LLM judgment
- sponsorship/CPT reasoning
- CV comparison or rewriting
- ATS/job-CV alignment analysis
- recruiter/hiring-manager discovery
- Gmail outreach
- LinkedIn messaging
- automatic final job submission
- scheduled 8:00 AM search inside this app

Those are added incrementally so each component can be tested before the agent is allowed to make higher-stakes decisions.

## Phase 2 hook

Each normalized job already contains fields that GPT analysis can consume later:

```ts
{
  title,
  company,
  location,
  description,
  postedAtISO,
  daysOld,
  category,
  applyUrl,
  highlights,
  degreeSignal,
  sourceQuery
}
```

Phase 2 can add a new `analyze-job` Edge Function using a strong OpenAI model and store structured eligibility/fit results alongside each `job_postings` row.

## Security notes

- Never commit `.env` or `.env.local`.
- Never use a Supabase secret/service-role key in browser code.
- Never expose `SERPAPI_KEY` to the frontend.
- Keep the function authenticated.
- Keep `ALLOWED_EMAIL` set for a single-user deployment.
- Treat the provider's apply URL as a navigation route; the user should make the final application submission.
