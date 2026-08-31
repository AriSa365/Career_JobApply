# Phase 4.2 — Eligibility guardrails and employer recovery

## Guardrails

- `APPLY / PASS`: normal application workflow.
- `REVIEW`: visible warning, but package generation and submission tracking remain available.
- `SKIP` or `Eligibility FAIL`: CV tailoring, application-package generation, submitted/interview/offer status changes, and the “I submitted” action are blocked by default.
- CV tailoring has its own explicit one-session override so API credits are not spent accidentally; the Applications workspace uses a persistent override with a written reason of at least 10 characters.
- Overrides are persisted and can be revoked.
- The protected `prepare-application` Edge Function enforces the same rule server-side, so the UI cannot silently bypass it.

## Company-name quality control

- Applications now expose an editable `Company / employer` field.
- If discovery leaves the employer as `Company not parsed` or `Unknown company`, package generation first tries a secondary deterministic recovery from the public application page.
- Recovery checks JobPosting JSON-LD, common company metadata, Open Graph/page titles, and LinkedIn-style `Company hiring Role` title patterns.
- If the employer still cannot be resolved reliably, the application pack is not generated; the app asks the user to enter the employer manually instead of letting GPT guess.
- Company resolution is audited as `ORIGINAL`, `RECOVERED`, `MANUAL`, or `UNRESOLVED`.

## Database

Migration `005_phase4_2.sql` adds:

- `eligibility_override`
- `eligibility_override_reason`
- `company_resolution`

No new secret is required.
