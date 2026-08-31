# Phase 5 — Recruiter & Hiring-Manager Intelligence

## Added

- New **Recruiter Outreach** workspace in the sidebar.
- Public LinkedIn profile discovery for each tracked application using SerpApi/Google Search; no LinkedIn password or logged-in scraping.
- Two targeted discovery searches per employer:
  - talent acquisition / university / early-career recruiters;
  - HEOR, RWE, epidemiology, market access, value/evidence and related functional leaders.
- Deterministic contact ranking with transparent relevance reasons.
- Contact tracking statuses, notes, verified public/work email field, and follow-up dates.
- GPT-5.6 Luna personalized outreach generation by default, with Sol only when Deep Review is selected.
- Fact-locked candidate claims in LinkedIn notes, follow-up messages, and recruiter emails.
- Editable LinkedIn connection note (capped at 280 characters), LinkedIn follow-up, email subject and email body.
- One-click copy actions, Open LinkedIn, and Open Gmail Compose. The app never sends the message automatically.
- `networking_contacts` and `outreach_messages` Supabase tables with Row Level Security.
- New protected Edge Functions:
  - `find-contacts`
  - `prepare-outreach`

## Safety / quality behavior

- Public profiles are labeled as likely relevant contacts, **not confirmed hiring managers**, unless their public title proves the relationship.
- Phase 5 refuses contact discovery until the employer name is resolved.
- It does not infer or guess personal email addresses. A public/business email may be captured only when visible in public search evidence, or entered manually after verification.
- Work-authorization/CPT/sponsorship information is not inserted into cold outreach by default.
- SKIP/eligibility-fail roles can still be used for informational networking, but GPT is instructed not to turn the outreach into application advocacy unless the user has explicitly overridden eligibility elsewhere.
- Final LinkedIn and Gmail sending remains under the user's control.

## Database migration

`006_phase5.sql` creates:

- `networking_contacts`
- `outreach_messages`

Both tables use authenticated-user RLS policies.
