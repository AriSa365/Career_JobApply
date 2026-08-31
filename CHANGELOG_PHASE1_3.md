# Phase 1.3 — Custom Research Keywords + CV Match

## New search flexibility
- Core HEOR/RWE/Market Access/Patient-Centered presets remain optional.
- Add up to 24 custom research keywords/phrases.
- Enter one keyword at a time or a comma-separated list.
- Custom keywords are persisted in the browser and sent to the secure Edge Function only when a search runs.
- Custom keywords are grouped up to four per provider query to limit SerpApi usage.
- Search can run using only custom keywords, only preset research areas, or both.
- Target-year dropdown expanded through 2032.
- Winter added as a season option.

## CV match workspace
- Upload DOCX, PDF, or TXT CV files.
- CV text is extracted locally in the browser.
- Raw CV files are not uploaded to Supabase or sent to SerpApi in this phase.
- Extracted CV text is stored only in localStorage on the current browser so the match feature survives refreshes.
- Each job card shows a 0–98% transparent job–CV alignment score.
- Each card lists matched CV terms and potential keyword gaps.
- LinkedIn/snippet-based matches are marked Preliminary when the public description is too thin.
- The score is explicitly not presented as an employer ATS score.

## Matching logic
The deterministic score uses visible job-description signals such as HEOR/RWE methods, economic modeling, evidence synthesis, technical software, degree evidence, research/publication evidence, and user-defined custom keywords. Phase 2 can later augment this with GPT semantic analysis of the full job description and CV.
