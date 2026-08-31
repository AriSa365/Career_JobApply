# Phase 3 — Fact-Locked CV Tailoring

## Added

- New **CV Tailoring** workspace in the left navigation.
- Job-specific CV generation powered by `gpt-5.6-sol`.
- Phase 3 requires a Phase 2 analysis before generation so eligibility, sponsorship, requirements, strengths, and gaps are already available.
- Three document formats:
  - Industry CV · 2 pages
  - Academic CV · full
  - Concise resume · 1 page
- Three emphasis modes:
  - Balanced
  - HEOR / research
  - Quantitative / technical
- Server-side **fact lock**:
  - every generated block and bullet must contain an exact source-evidence excerpt from the uploaded master CV;
  - evidence excerpts are checked against the master CV before the response is returned;
  - unsupported claims are removed and recorded in the audit;
  - unsupported job requirements remain visible as retained gaps.
- Editable bullet preview before download.
- Editable Word (`.docx`) export.
- Plain-text copy action.
- JSON audit export containing evidence, gaps, warnings, and change rationale.
- Projected job–CV alignment after truthful tailoring (explicitly not an employer ATS score).
- Generated CVs are stored separately from the master CV in browser storage.
- New `cv_versions` Supabase table for server-side version history. Raw master CV text is not stored in this table.
- New protected `tailor-cv` Supabase Edge Function.

## Safety / integrity rules

- No invented tools, methods, dates, metrics, titles, publications, therapeutic areas, or outcomes.
- PhD Scholar status must not be upgraded to a completed PhD.
- Known qualification gaps must not be silently inserted into the CV.
- Manual edits after generation are marked as no longer automatically fact-locked.

## New files

- `src/components/CvTailoringWorkspace.tsx`
- `src/lib/docx.ts`
- `supabase/functions/tailor-cv/index.ts`
- `supabase/migrations/003_phase3.sql`
- `CHANGELOG_PHASE3.md`

## New dependency

- `docx` for browser-side editable Word export.

No new GitHub or Supabase secret is required beyond the Phase 2 `OPENAI_API_KEY`.
