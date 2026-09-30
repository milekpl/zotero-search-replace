# Taste

- Prefers release/publish pipelines to be fully automated (test → build → upload → release) rather than manual steps. Confidence: 0.6
- When configuring tooling/CI/release automation, prefers mirroring an already-working project of theirs (e.g. a sibling repo like `../zotero-ner`) as the template rather than inventing new configuration; expect them to name the reference repo to follow. Confidence: 0.8
- Expects the whole pipeline (build, tests, release automation) to be verified working before pushing/deploying. Confidence: 0.5
- Prefers machine-specific paths/config (e.g. Zotero binary and profile paths) to be loaded from a local, git-ignored `.env` file rather than hardcoded in committed config. Confidence: 0.6
- Avoids speculative fixes: don't change code for bugs that don't reproduce locally — only fix something once it's verified as a real bug. Confidence: 0.7
