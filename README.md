# HEOR Career Agent — Phase 3

Phase 3 extends the HEOR Career Agent from job discovery and GPT eligibility analysis into **fact-locked, job-specific CV tailoring**.

## Current pipeline

1. **Job Discovery**
   - Google Jobs + public LinkedIn job pages
   - configurable opportunity type, year, season, degree, work arrangement, country, location, recency, research areas, and custom keywords
   - hard maximum 30-day posting-age gate
2. **CV Match**
   - local DOCX/PDF/TXT parsing
   - preliminary transparent job–CV alignment score
3. **GPT Analysis**
   - GPT-5.6 Sol semantic fit analysis
   - graduation/degree eligibility
   - CPT and sponsorship reasoning
   - APPLY / REVIEW / SKIP
4. **CV Tailoring (Phase 3)**
   - job-specific CV draft
   - evidence-linked rewrites
   - server-side fact-lock validation
   - editable preview
   - editable DOCX export
   - audit JSON export

## Phase 3 integrity model

The master CV remains the factual source. The `tailor-cv` Edge Function tells GPT that every generated block and bullet must include an **exact contiguous evidence excerpt** copied from the uploaded master CV. The server then checks those excerpts against the master CV before returning the draft.

If an evidence excerpt cannot be found:
- the unsupported block/claim is removed;
- it is listed under rejected claims;
- projected alignment is penalized;
- the job requirement stays a gap rather than becoming fake experience.

This reduces hallucinated CV content but does not replace final human review. Manual browser edits after generation are explicitly marked as needing re-review.

## Privacy

- Raw CV files are parsed in the browser.
- Raw CV text is sent to the protected `analyze-job` and `tailor-cv` Edge Functions only when the user explicitly requests GPT work.
- The `job_analyses` table does not store the raw master CV.
- The `cv_versions` table stores generated tailored document JSON/version metadata, not the raw master CV.
- SerpApi does not receive the CV.
- `OPENAI_API_KEY`, `SERPAPI_KEY`, and other server secrets never go to GitHub Pages frontend code.

## Required GitHub Actions secrets

Phase 3 uses the same secrets as Phase 2:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`
- `SUPABASE_DB_PASSWORD`
- `SERPAPI_KEY`
- `ALLOWED_EMAIL`
- `OPENAI_API_KEY`

No new secret is required for Phase 3.

## Deploy

Push the complete project to `main`. The existing GitHub Action will:

1. install dependencies;
2. build the React/Vite frontend;
3. apply all Supabase migrations including `003_phase3.sql`;
4. sync Edge Function secrets;
5. deploy `search-jobs`, `analyze-job`, and `tailor-cv`;
6. deploy GitHub Pages.

## Phase 3 usage

1. Upload your master CV in **Job Discovery**.
2. Find a promising job.
3. Click **Analyze with GPT** and review APPLY / REVIEW / SKIP.
4. Click **Tailor CV** on an analyzed role or open **CV Tailoring** in the sidebar.
5. Choose a document format and emphasis.
6. Click **Generate tailored CV**.
7. Review the fact-lock audit, retained gaps, and warnings.
8. Make any final manual bullet edits.
9. Download the editable `.docx` and review it before submission.

## Important scoring language

- Discovery score = deterministic search relevance.
- CV match = transparent preliminary job–CV alignment.
- GPT match = semantic fit from Phase 2.
- Projected alignment = post-tailoring job–CV alignment estimate.

None of these is represented as an employer's proprietary ATS score.
