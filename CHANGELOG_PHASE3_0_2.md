# Phase 3.0.2

Hotfix for CV Tailoring structured-output truncation.

- Raises the initial GPT output budget from 10,000 to 18,000 tokens.
- Detects incomplete Responses API generations before JSON parsing.
- Joins all output_text chunks instead of reading only the first chunk.
- Automatically retries once with a 26,000-token budget and compact CV/evidence rules.
- Returns a clear retry message instead of exposing JSON.parse errors such as "Unterminated string".
- Asks the model to use the shortest exact fact-lock evidence excerpt needed for each claim.
