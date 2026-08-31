# HEOR Career Agent — Phase 2

A private career-search dashboard for HEOR/RWE/health economics and adjacent opportunities.

Phase 2 adds GPT-5.6 Sol job intelligence on top of the existing flexible job discovery, LinkedIn public-job discovery, local CV parsing, and deterministic CV match.

## What Phase 2 does

1. Search recent opportunities through Google Jobs and public LinkedIn job pages indexed by Google.
2. Apply configurable filters for opportunity type, year, season, degree, work arrangement, country/region, recency, research areas, and custom keywords.
3. Upload a DOCX/PDF/TXT CV and calculate a transparent preliminary keyword match locally.
4. Click **Analyze with GPT** on an individual job.
5. The protected `analyze-job` Edge Function:
   - authenticates the user;
   - attempts to read the public application page;
   - sends job evidence + extracted CV text + candidate eligibility profile to GPT-5.6 Sol;
   - may use OpenAI web search to corroborate public job details;
   - returns structured eligibility, sponsorship, semantic-fit, and CV-tailoring analysis.
6. The app displays **APPLY / REVIEW / SKIP** plus evidence and uncertainty.

## Phase 2 decision fields

- Recommendation: APPLY / REVIEW / SKIP
- Eligibility: PASS / REVIEW / FAIL
- Sponsorship: COMPATIBLE / UNKNOWN / INCOMPATIBLE
- Semantic CV match: 0–100
- Overall fit: 0–100
- HEOR relevance: HIGH / MEDIUM / LOW
- Job-description evidence: FULL / PARTIAL / SNIPPET
- Required and preferred qualifications
- Strong matches and gaps
- Important job-description/ATS terms
- Truthful CV-tailoring actions
- Caution flags and evidence notes
- Public source links

The scores are **not an employer ATS score**.

## Privacy behavior

- Raw CV files are parsed in the browser.
- Search providers do not receive the CV.
- Phase 2 sends extracted CV text to the protected Supabase Edge Function only when the user explicitly clicks **Analyze with GPT**.
- That extracted CV text is sent to the OpenAI API for analysis.
- Raw CV text is not stored in the `job_analyses` database table.
- Completed structured analyses may be persisted in Supabase and cached in the browser.

## Required GitHub Actions secrets

Repository → Settings → Secrets and variables → Actions:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
SUPABASE_ACCESS_TOKEN
SUPABASE_PROJECT_ID
SUPABASE_DB_PASSWORD
SERPAPI_KEY
ALLOWED_EMAIL
OPENAI_API_KEY
```

`OPENAI_API_KEY` must be an OpenAI API project key with billing/API access enabled. A ChatGPT subscription by itself is separate from API billing.

Never put `OPENAI_API_KEY`, `SERPAPI_KEY`, database passwords, or Supabase secret/service keys into React/Vite source code.

## Deploy

The included `.github/workflows/deploy.yml` runs on pushes to `main` and manual workflow dispatch.

It will:

1. build the React/Vite frontend;
2. link the Supabase project;
3. run all migrations, including `002_phase2.sql`;
4. sync `SERPAPI_KEY`, `ALLOWED_EMAIL`, and `OPENAI_API_KEY` to Supabase Edge Function secrets;
5. deploy both `search-jobs` and `analyze-job` Edge Functions;
6. deploy GitHub Pages.

## OpenAI model

Phase 2 uses `gpt-5.6-sol` through the Responses API with structured JSON output. The UI provides:

- **Standard** → medium reasoning
- **Deep** → high reasoning

Analysis is manual/on-demand so API cost remains under the user's control.

## Important eligibility logic

The analysis prompt is deliberately conservative:

- CPT eligibility does not imply employer sponsorship.
- If future sponsorship is needed and the posting explicitly prohibits present/future sponsorship, the role should be flagged incompatible.
- If sponsorship language is missing, it remains UNKNOWN.
- Graduation-year restrictions are compared with the candidate's expected graduation.
- Thin LinkedIn snippets should produce REVIEW/UNKNOWN rather than fabricated certainty.
- CV tailoring may only reframe facts supported by the uploaded CV.

## Phase 2 files

```text
src/
  App.tsx
  types.ts
  components/
    AnalysisWorkspace.tsx
    CandidateProfilePanel.tsx
    GptAnalysisPanel.tsx
    JobCard.tsx
  lib/
    candidate.ts
    cv.ts
supabase/
  functions/
    search-jobs/index.ts
    analyze-job/index.ts
  migrations/
    001_phase1.sql
    002_phase2.sql
.github/workflows/deploy.yml
```

## First Phase 2 test

After deployment:

1. Upload your CV.
2. Run a search.
3. Open **GPT Analysis** and verify candidate settings.
4. Return to Job Discovery.
5. Choose one job with a known eligibility issue and one strong HEOR match.
6. Click **Analyze with GPT** on each.
7. Confirm the model distinguishes semantic fit from hard eligibility/sponsorship.

