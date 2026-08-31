# Phase 2 — GPT Job Intelligence

## Added

- GPT-5.6 Sol analysis on demand for individual jobs.
- New protected `analyze-job` Supabase Edge Function.
- Server-side attempt to read the public job page before model analysis.
- OpenAI web-search support to corroborate public job details when available.
- Structured GPT output with:
  - APPLY / REVIEW / SKIP recommendation
  - PASS / REVIEW / FAIL eligibility
  - sponsorship compatibility assessment
  - semantic CV match percentage
  - overall fit percentage
  - HEOR relevance
  - job-description evidence completeness
  - required/preferred qualifications
  - strengths, gaps, ATS/JD terms, tailoring actions, caution flags, evidence notes, and source URLs
- Candidate eligibility profile:
  - expected graduation
  - current status
  - CPT eligibility
  - future sponsorship need
  - relocation flexibility
- Standard vs Deep reasoning selection.
- GPT Analysis workspace and analyzed-job summary counts.
- Local caching of analyses in the browser.
- Server persistence in `job_analyses` without storing raw CV text.
- New database migration `002_phase2.sql`.

## Privacy

The raw uploaded CV file remains local. Phase 2 sends the extracted CV text to the protected `analyze-job` Edge Function only when the user explicitly clicks **Analyze with GPT**. The Edge Function sends that text to the OpenAI API for that analysis. The raw CV text is not written to the `job_analyses` database table.

## New GitHub Action secret

- `OPENAI_API_KEY`
