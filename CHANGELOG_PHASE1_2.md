# Phase 1.2 changes

This release turns the original fixed Summer-2027/U.S./PhD-internship search into a configurable search builder.

## Added

- Opportunity type: Internship / Full-time job / Any
- Target year: Any / 2026 / 2027 / 2028 / 2029
- Season: Any / Summer / Fall / Spring
- Degree: Any / PhD / Graduate / Master's / Bachelor's
- Work arrangement: Any / Remote / Hybrid / On-site
- Posting window: 7 / 14 / 30 days (server maximum remains 30)
- Country selector: U.S., Canada, U.K., Germany, Switzerland, Ireland, Netherlands, France, Belgium, Denmark, Sweden, Norway, Australia, India, Singapore
- Optional city/state/region field
- Search-source toggles: Google Jobs and LinkedIn
- Public LinkedIn job discovery via Google-indexed `linkedin.com/jobs/view` pages
- LinkedIn verification badge when public snippets omit eligibility details
- Search-profile persistence in local storage
- Estimated provider-call count
- Per-source counts in search audit

## Important LinkedIn behavior

The application does not sign into LinkedIn, store LinkedIn credentials, scrape a logged-in LinkedIn session, send LinkedIn messages, or submit LinkedIn applications. It discovers public LinkedIn job pages through web search and opens the original posting for verification and user action.
