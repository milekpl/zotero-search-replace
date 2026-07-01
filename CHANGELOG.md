# Changelog

## 0.2.6 - 2026-07-01

### Fixed
- Fixed automatic updates: the XPI's `manifest.json` had an `update_url` pointing at a nonexistent GitHub release asset (a scaffold default that was never overridden), so Zotero could never find new versions. It now correctly points to the maintained `update.json` on `main`. **Note:** existing installs need one manual reinstall to pick up this fix before auto-update starts working again.
- Fixed the README's preloaded pattern count and category breakdown, which had drifted out of date (claimed 18, code has 23: added German eszett restoration, WorldCat URL removal, corporate-author detection, and journal-name-as-author detection to the documented list).

### Added
- Added CI (lint/unit tests/build) on every push and PR via GitHub Actions.
- Added a tag-triggered release workflow that builds the extension, publishes the GitHub release and XPI, and syncs `update.json`/`update-beta.json` back to `main` automatically.
- Added `eslint.config.js` (flat config) since `npm run lint` had no config file and was silently failing.

## 0.2.5 - 2026-06-15

### Fixed
- Fixed Phase 2 candidate collection for searches that skip Phase 1 by fetching library item IDs via `Zotero.Items.getAll(...)`, preventing false-empty results in Zotero 8 for `All Fields` and regex-heavy queries.
- Fixed one-character `contains`/`exact` searches (for example `Place = B`) by bypassing Phase 1 prefiltering for single-character terms and matching in Phase 2.
- Fixed `All Fields` coverage to include the `language` field, so searches such as `de`, `nl|de`, and language negation workflows can match language metadata correctly.

### Added
- Added `Language` to the field dropdown in the search dialog.
- Added unit coverage for language matching in `All Fields` and single-character prefilter fallback behavior.

## 0.2.3 - 2026-04-24

### Added
- Added focused unit coverage for dialog helpers, replacement placeholders, exact and contains replacement semantics, creator full-name handling, and regex Phase 1 search behavior.

### Changed
- Updated the plugin for Zotero 9 compatibility.
- Simplified the live dialog startup path by removing heavyweight dialog arguments and deferring preloaded pattern rendering until after initial paint.
- Consolidated the live dialog onto the HTML controller and canonical bundled pattern definitions.
- Improved release automation so `npm run release` rebuilds first and refreshes the root update manifests from the build output.

### Fixed
- Fixed mixed AND/OR condition evaluation so multi-condition searches respect each row's operator in sequence.
- Fixed all-field matching and empty-field matching, including whitespace-only title detection.
- Fixed exact and contains replacement behavior so literal text is handled correctly instead of using regex-style semantics.
- Fixed replacement placeholder handling for numbered groups, named groups, `$<name>`, `$$`, `$&`, `$'`, `$`` and `$+`.
- Fixed replacement previews and apply behavior for multi-condition searches and field-targeted replacements.
- Fixed creator full-name search and replacement for normal two-field creators as well as single-field creator records.
- Fixed batch replace accounting so unchanged items are counted as skipped rather than reported as errors.
- Fixed the dialog replace textbox so manual replacements use the current input value instead of a stale empty state value.
- Fixed the `Normalize: Mac Prefix` pattern so names such as `MACDONALD` normalize correctly.
- Removed duplicate dialog and pattern definitions that had diverged from the runtime implementation.

### Performance
- Restored safe Phase 1 prefiltering for regex searches when a literal candidate can be extracted, avoiding unnecessary full-library scans for common regex searches.