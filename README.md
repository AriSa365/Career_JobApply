# HEOR Career Agent — Phase 1.2

A private, GitHub-ready HEOR career discovery dashboard with configurable opportunity type, year, season, degree, work arrangement, country, city/region, research area, recency window and search source.

- Health Economics & Outcomes Research (HEOR)
- Real-World Evidence (RWE) / Real-World Data
- Epidemiology / Pharmacoepidemiology
- Market Access / Value & Access
- Patient-Centered Outcomes / PRO / Patient Preference

Phase 1 intentionally uses deterministic filtering rather than an LLM. Phase 2 can add GPT-based eligibility, sponsorship, fit and CV analysis without changing the search foundation.

## What Phase 1.2 already does

- Searches **internships, full-time jobs, or both**.
- Lets you choose target year (`2026`–`2029` or Any) and season (Summer/Fall/Spring/Any) independently.
- Lets you choose degree level and work arrangement (Remote/Hybrid/On-site/Any).
- Supports multiple countries plus an optional city/state/region field.
- Lets you choose 7-, 14-, or 30-day posting windows; the backend still enforces a hard maximum of 30 days.
- Searches Google Jobs and public LinkedIn job pages indexed by Google.
- Does **not** log into LinkedIn, store a LinkedIn password, or automate LinkedIn messaging.
- Rejects ambiguous/unknown posting dates rather than guessing they are recent.
- Rejects obvious closed/expired language and requires an application route.
- Deduplicates title/company/location combinations across sources.
- Gives retained results a transparent deterministic relevance score (not an ATS score).
- Marks LinkedIn-indexed results as **Verify details** when public snippets do not expose degree/work-mode/employment details.
- Stores saved jobs and the current search profile in the browser.
- Persists search runs/jobs to Supabase when the Phase 1 migration is present.
- Uses Supabase Auth plus a single allowed email check to protect the search API.

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
SerpApi
   |-- Google Jobs API
   `-- Google Search API -> public LinkedIn job pages
          |
          v
filter -> dedupe -> score -> dashboard
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

The dashboard sends the selected profile to the Edge Function. The backend validates every option and applies the selected filters server-side. The recency window may be 7, 14, or 30 days, but **never more than 30 days**. Unknown dates are excluded.

Google Jobs results are retained only when the structured posting text supports the chosen opportunity/year/season/degree/work-mode criteria. Public LinkedIn search snippets are less complete, so a LinkedIn result may be retained as a discovery candidate when the selected degree, work-mode, or employment detail is not visible; those cards are explicitly marked **Verify details**.

## Provider behavior

Phase 1.2 uses the same private `SERPAPI_KEY` for two discovery channels:

- **Google Jobs** via SerpApi `engine=google_jobs`.
- **LinkedIn discovery** via SerpApi Google Search (`engine=google`) restricted to public `linkedin.com/jobs/view` pages and the selected country.

The query builder groups the selected research areas in pairs to control API usage. The dashboard shows the estimated provider-call count before each run. Selecting fewer sources or research areas reduces calls.

The LinkedIn channel is intentionally public-index discovery rather than authenticated LinkedIn automation. It opens the original LinkedIn posting for verification/application.

## What is deliberately NOT in Phase 1

- GPT/LLM judgment
- sponsorship/CPT reasoning
- CV comparison or rewriting
- ATS/job-CV alignment analysis
- recruiter/hiring-manager discovery
- Gmail outreach
- LinkedIn messaging or authenticated LinkedIn scraping
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

## Phase 1.3 additions

### Custom research keywords
The Search Builder now supports user-defined keyword phrases in addition to the built-in HEOR, RWE/Epidemiology, Market Access, and Patient-Centered presets. Up to 24 custom phrases are accepted. The Edge Function groups them four per query to control provider usage.

Examples:
- pharmacoeconomics
- causal inference
- oncology HEOR
- discrete choice experiment
- clinical outcomes assessment
- value-based healthcare

### Local CV matching
The dashboard includes a CV Match Workspace. DOCX, PDF, and TXT files are parsed in the browser using `mammoth` and `pdfjs-dist`. The raw file is not uploaded to Supabase and is never sent to SerpApi in Phase 1.3.

The extracted text is stored in the browser's localStorage and used to calculate a transparent job–CV alignment score. This is not an employer ATS score. It is intended to help prioritize postings and expose matched/missing terminology before the GPT-based Phase 2 analysis.

If the browser cache/site data is cleared, upload the CV again.
