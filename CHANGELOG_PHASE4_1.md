# Phase 4.1 — Luna-default cost optimization

- Changed the default AI model from `gpt-5.6-sol` to `gpt-5.6-luna`.
- Standard mode now uses GPT-5.6 Luna across Phase 2 job analysis, Phase 3 CV tailoring, and Phase 4 application-package generation.
- Deep Review explicitly uses GPT-5.6 Sol and must be selected by the user.
- The app now starts with Standard mode selected instead of Deep.
- Updated UI labels so the active cost tier is visible before a request is made.
- No new secrets or database migrations are required.
