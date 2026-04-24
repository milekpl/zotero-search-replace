# Changelog

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