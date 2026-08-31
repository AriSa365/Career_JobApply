# Phase 1.2 verification checklist

- [ ] GitHub Actions build succeeds.
- [ ] Supabase `search-jobs` Edge Function deploys.
- [ ] GitHub Pages deploys.
- [ ] Login works for the `ALLOWED_EMAIL` account.
- [ ] Opportunity type dropdown changes Internship / Full-time job / Any.
- [ ] Target year and season can be changed independently.
- [ ] Degree and work arrangement dropdowns work.
- [ ] Country dropdown and optional city/state/region field work.
- [ ] Posting-age dropdown supports 7 / 14 / 30 days; backend never accepts >30.
- [ ] At least one research category and one source are required.
- [ ] Google Jobs source returns structured results when available.
- [ ] LinkedIn source opens public `linkedin.com/jobs/view` postings when available.
- [ ] LinkedIn cards with incomplete snippets display `Verify details`.
- [ ] Unknown/ambiguous posting dates are excluded.
- [ ] Results deduplicate across search queries/sources.
- [ ] Provider-call estimate changes with selected categories/sources.
- [ ] Search profile persists after browser refresh.
- [ ] Saved jobs persist after browser refresh.


## Phase 1.3 checks
- [ ] Add/remove custom research keywords and confirm they persist after refresh.
- [ ] Search with only custom keywords selected.
- [ ] Upload a DOCX CV and confirm word count appears.
- [ ] Upload a text-based PDF CV and confirm extraction works.
- [ ] Confirm each result shows CV match % after a CV is loaded.
- [ ] Confirm matched and potential-gap keywords appear.
- [ ] Confirm clearing the CV removes job-specific CV scores.
