# HEOR Career Agent — Phase 4

A private HEOR/RWE career application workspace deployed with GitHub Pages + Supabase.

## Phase 4 pipeline

1. **Job Discovery** — configurable Google Jobs + public LinkedIn discovery with recency filtering.
2. **GPT Analysis** — GPT-5.6 Sol evaluates eligibility, sponsorship/CPT risk, HEOR relevance, and semantic CV fit.
3. **CV Tailoring** — fact-locked job-specific CV generation with editable DOCX download.
4. **Applications** — application tracker + fact-locked cover letter and application-answer package.

The app intentionally keeps the final employer/LinkedIn **Submit** click with the user.

## Phase 4 features

- Track each application separately.
- Store status, deadline, applied date, follow-up date, and notes.
- Mark an application as submitted after you complete the employer form.
- Generate a job-specific application package only after Phase 2 analysis + Phase 3 CV tailoring.
- Add employer-specific questions and character limits before generating answers.
- Download an editable cover letter DOCX.
- Copy individual answers or the full application package.
- Review work-authorization and future-sponsorship guidance before answering employer questions.
- Persist application records and generated packages in Supabase under Row Level Security.

## Required GitHub Actions secrets

No new secret is required for Phase 4. Keep the existing secrets:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`
- `SUPABASE_DB_PASSWORD`
- `SERPAPI_KEY`
- `ALLOWED_EMAIL`
- `OPENAI_API_KEY`

## Deploy

Push the complete project to `main`. The existing GitHub Action will:

1. install dependencies;
2. build the Vite/React frontend;
3. run Supabase migrations, including `004_phase4.sql`;
4. deploy all Edge Functions, including `prepare-application`;
5. deploy GitHub Pages.

No manual Supabase SQL step is needed when the workflow is configured correctly.

## Phase 4 database objects

### `applications`
Stores the authenticated user's job snapshot and application status metadata.

### `application_packages`
Stores generated structured application packages. The protected Edge Function performs writes; users can read only their own packages.

The raw uploaded master CV is **not** stored in either Phase 4 table.

## Application Pack fact lock

The master CV remains the factual authority for candidate claims. Each generated cover-letter paragraph and each generated application answer must include exact source evidence from the uploaded CV. The backend rejects generated items whose evidence cannot be found.

Work-authorization guidance is generated separately from the candidate profile because employer questions differ. Always read the exact employer wording before selecting a Yes/No response.
