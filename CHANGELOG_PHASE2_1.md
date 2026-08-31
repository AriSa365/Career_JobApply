# Phase 2.1 hotfix — GPT analysis authentication

## Fixed
- Correctly reads Supabase's current `SUPABASE_PUBLISHABLE_KEYS` and `SUPABASE_SECRET_KEYS`, which may be JSON maps of named keys.
- Falls back to legacy/raw `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_SECRET_KEY` when appropriate.
- Explicitly extracts the user's bearer JWT and verifies it with `auth.getUser(token)`.

## Symptom fixed
The app could sign in and `search-jobs` could work, while `analyze-job` returned `Unauthorized.` before it ever called OpenAI.
