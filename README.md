# HEOR Career Agent — Phase 5

A private HEOR/RWE career workspace deployed with GitHub Pages + Supabase.

## Current pipeline

1. **Job Discovery** — configurable Google Jobs + public LinkedIn job discovery with a strict recency gate.
2. **GPT Analysis** — GPT-5.6 Luna evaluates eligibility, sponsorship/CPT risk, HEOR relevance and semantic CV fit by default. GPT-5.6 Sol is optional Deep Review.
3. **CV Tailoring** — fact-locked job-specific CV generation with editable DOCX download.
4. **Applications** — application tracker + fact-locked cover letter and employer-question package.
5. **Recruiter Outreach** — public recruiter/HEOR-leader discovery + fact-locked LinkedIn/email drafting and follow-up tracking.

The app intentionally keeps the final employer application submission, LinkedIn message send, and Gmail send under the user's control.

## Phase 5 contact discovery

Phase 5 works from a tracked application with a resolved employer name. It performs two public Google searches through SerpApi:

- likely university / early-career / talent-acquisition contacts at the employer;
- likely HEOR, RWE, epidemiology, market-access, value/evidence or evidence-generation leaders at the employer.

Only public LinkedIn profile URLs are collected. The app does **not** log into LinkedIn, use your LinkedIn password, or scrape a private session.

Contacts are ranked deterministically and show why they were surfaced. A profile is treated as a **likely relevant contact**, not as a confirmed hiring manager unless public evidence explicitly supports that claim.

## Phase 5 outreach generation

For a selected contact, `prepare-outreach` can generate:

- LinkedIn connection note (<=280 characters);
- LinkedIn follow-up message;
- recruiter/networking email subject;
- recruiter/networking email body;
- personalization points and cautions.

Candidate claims are fact-locked to exact evidence from the uploaded master CV. GPT is not allowed to invent skills, experience, degrees, publications or achievements.

The default model remains **GPT-5.6 Luna**. Deep Review uses **GPT-5.6 Sol** only when deliberately selected.

## Email / LinkedIn sending

Phase 5 does not automatically send messages.

- **Open LinkedIn** opens the public profile so you can paste/review the prepared note.
- **Open Gmail compose** opens Gmail with the verified work/public email, subject and body prefilled.
- No personal email address is guessed or inferred. Enter an email only when it is publicly listed or otherwise verified.
- **Mark outreach sent** records the outreach and sets a 7-day follow-up date.

A future Gmail OAuth integration could add an authorized send-with-confirmation action, but it is intentionally not required for Phase 5.

## Required GitHub Actions secrets

No new secret is required for Phase 5. Keep:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`
- `SUPABASE_DB_PASSWORD`
- `SERPAPI_KEY`
- `ALLOWED_EMAIL`
- `OPENAI_API_KEY`

## Deploy

Push the complete project to `main`. GitHub Actions will:

1. install dependencies;
2. build the Vite/React frontend;
3. apply migrations through `006_phase5.sql`;
4. deploy all Edge Functions, including `find-contacts` and `prepare-outreach`;
5. deploy GitHub Pages.

## Phase 5 database objects

### `networking_contacts`
Stores public contact metadata, relevance ranking, status, follow-up date, notes and optional verified business email under RLS.

### `outreach_messages`
Stores generated/edited LinkedIn and email drafts, fact-lock audit fields, status and follow-up dates under RLS.

The raw uploaded master CV is not stored in either table.

## AI model routing

- **Standard (default):** `gpt-5.6-luna`
- **Deep Review (optional):** `gpt-5.6-sol`

The same selected reasoning mode applies to job analysis, CV tailoring, application packages and Phase 5 outreach generation.
