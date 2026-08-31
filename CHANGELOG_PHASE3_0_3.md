# Phase 3.0.3 — Fact-lock formatting tolerance

- Fixed false-negative evidence rejections caused by DOCX/PDF bullet glyph differences.
- Added Unicode normalization and bullet normalization before evidence comparison.
- Added a punctuation-tolerant exact phrase comparison.
- Added token-boundary matching for short explicit skill names such as SAS, SQL, R, SPSS, HTA, and DCE.
- Fact-lock still rejects unsupported claims; this change only ignores formatting artifacts.
