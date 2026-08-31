# Phase 4 — Application Manager & Submission Pack

Phase 4 turns analyzed and tailored jobs into a human-in-the-loop application workflow.

## Added

- **Applications** workspace enabled in the sidebar.
- Persistent application tracker with statuses:
  - Ready to apply
  - Applied
  - Interview
  - Offer
  - Rejected
  - Withdrawn
- Per-application deadline, applied date, follow-up date, and notes.
- One-click **I submitted this application** action that records the applied date and proposes a 7-day follow-up date.
- **Add to Applications** action from the Phase 3 CV tailoring workspace.
- GPT-powered **Application Pack** generation for jobs that already have:
  - Phase 2 GPT analysis
  - Phase 3 tailored CV
- Fact-locked cover letter generation.
- Editable cover letter with DOCX download.
- Standard application answer bank plus user-defined employer questions and optional character limits.
- Deterministic work-authorization / sponsorship guidance based on the candidate profile.
- Final submission checklist that keeps the user responsible for the employer/LinkedIn Submit button.
- Application-package fact-lock audit against the uploaded master CV.
- Supabase persistence for application records and generated application packages.

## New files

- `src/components/ApplicationsWorkspace.tsx`
- `src/lib/application-docx.ts`
- `supabase/functions/prepare-application/index.ts`
- `supabase/migrations/004_phase4.sql`

## Important safety behavior

- The app does not submit external applications automatically.
- It does not answer immigration/work-authorization questions by guessing.
- Future sponsorship requirements remain explicit.
- Candidate claims in cover letters and generated answers require CV evidence.
- Manual edits are not automatically re-verified by the server.
