# Zotero Search & Replace Plugin - Implementation Plan (REVISED)

## Overview

A Zotero plugin providing advanced search and replace functionality for library fields, with preloaded patterns for common data quality issues. Inspired by Zotero's Advanced Search but enhanced with regex support, replace functionality, and batch operations.

## Design Decisions (Revisions from Original)

| Decision | Original Plan | Revised Plan |
|----------|---------------|--------------|
| Script loading | Bundled + direct | Core engines bundled, UI loaded directly (simpler debugging) |
| Item iteration | Load all items first | Use Zotero.Search for initial filter, then load full items |
| Dialog technology | HTML dialog | HTML in Browser element (modern Zotero 7/8) |
| Creator modification | setField | Full creators array manipulation + saveTx |

## MVP Feature Set

### Included in MVP
| Feature | Description |
|---------|-------------|
| Search dialog | Opens XUL-based dialog in Zotero |
| Field selector | Dropdown with Title, Creator fields, etc. |
| Pattern input | Text box for regex/Like patterns |
| Search button | Finds matching items |
| Results virtual collection | Shows matches in Zotero's item list |
| Preloaded patterns | 15-20 common fixes from data-quality-issues.md |
| Replace (basic) | String replacement with capture groups |
| **Dry run preview** | Show what WOULD change in modal |
| **Progress dialog** | Show progress during batch operations |
| Create collection | Put matches in new collection |

### Excluded (Future)
- Save/load presets (JSON in prefs)
- Raw SQL mode
- AI suggestions
- Online pattern library
- CSV export (use Zotero's built-in export)
- Undo (recommend Zotero backup instead)

### Backup Workflow
1. Warn users to use Zotero's built-in backup first
2. Show "Items to be modified" count before confirm
3. Use `saveTx()` for atomic transactions

---

## Post-MVP Enhancements (Future)
1. CSV export of matching items
2. Batch rename operations
3. Tag automation
4. More preloaded patterns based on user feedback

---

## Architecture

### Plugin Structure (Reusing zotero-ner patterns)

```
zotero-search-replace/
├── manifest.json              # Extension manifest
├── package.json              # NPM config with zotero-plugin-scaffold
├── webpack.config.js          # Build configuration
├── bootstrap.js              # Lifecycle hooks (same pattern as zotero-ner)
├── content/
│   ├── search-dialog.html    # Main search & replace dialog
│   └── scripts/
│       └── zotero-search.js  # Window integration, menu hooks
├── src/
│   ├── index.js             # Entry point
│   ├── ui/
│   │   └── search-dialog.js # Dialog controller
│   ├── zotero/
│   │   └── search-engine.js # Search implementation
│   └── patterns/
│       └── quality-patterns.js # Preloaded data quality patterns
└── tests/
    └── ...
```

### Key Patterns to Reuse from zotero-ner

| Pattern | File | Usage |
|---------|------|-------|
| Bootstrap lifecycle | `bootstrap.js` | `startup`, `shutdown`, `onMainWindowLoad` |
| Bundle loading | `content/scripts/zotero-ner.js` | `Services.scriptloader.loadSubScript` |
| Menu integration | `content/scripts/zotero-ner.js` | Tools menu item |
| HTML dialog | `content/dialog.html` | Opened via `window.openDialog()` |
| Zotero API access | `src/zotero/*.js` | `Zotero.Items`, `Zotero.Search` |
| Test framework | `zotero-plugin-scaffold` | `npm run test:unit`, `npm run test:zotero` |

### Architecture Decision: Hybrid Loading

```
zotero-search-replace/
├── manifest.json              # Extension manifest
├── package.json              # NPM config with zotero-plugin-scaffold
├── webpack.config.js          # Build - bundles src/ to content/scripts/
├── bootstrap.js              # Lifecycle hooks (copied from zotero-ner)
├── content/
│   ├── dialog.html          # Main HTML dialog
│   ├── progress.html         # Progress dialog for batch operations
│   └── scripts/
│       ├── zotero-search.js  # Window integration, menu hooks
│       └── dialog-controller.js # Dialog controller (loaded directly)
├── src/
│   ├── index.js              # Module exports (bundled)
│   ├── zotero/
│   │   ├── search-engine.js  # Search logic (bundled)
│   │   ├── replace-engine.js # Replace logic (bundled)
│   │   └── progress-manager.js # Progress dialog helper (bundled)
│   └── patterns/
│       └── quality-patterns.js # Preloaded patterns (bundled)
└── tests/
    └── zotero-framework/
        └── test/tests/
            └── search-replace.spec.js
```

### 1. Search Engine (`src/zotero/search-engine.js`)

**Key Design: Two-Phase Search**
1. Use `Zotero.Search` for initial filtering (SQL efficient)
2. Load full items only for matches
3. Apply regex refinement on item fields

```javascript
// Pattern types
const PATTERN_TYPES = {
  REGEX: 'regex',       // JavaScript regex: /pattern/flags
  SQL_LIKE: 'sql_like', // SQLite LIKE: %pattern%
  SQL_GLOB: 'sql_glob', // SQLite GLOB: *pattern*
  EXACT: 'exact'        // Exact string match
};

// Fields to search (Zotero field names)
const SEARCH_FIELDS = {
  TITLE: 'title',
  CREATOR_FIRST: 'firstName',
  CREATOR_LAST: 'lastName',
  CREATOR_FULL: 'fullName',
  ABSTRACT: 'abstractNote',
  TAGS: 'tags',
  DATE: 'date',
  PUBLICATION: 'publicationTitle',
  PUBLISHER: 'publisher',
  DOI: 'DOI',
  ISBN: 'ISBN',
  URL: 'url',
  CALL_NUMBER: 'callNumber',
  EXTRA: 'extra'
};

// Search result structure
class SearchResult {
  constructor(item, matchedFields = [], matchDetails = []) {
    this.item = item;           // Zotero.Item
    this.itemID = item.id;
    this.itemKey = item.key;
    this.libraryID = item.libraryID;
    this.matchedFields = matchedFields;  // ['title', 'lastName']
    this.matchDetails = matchDetails;    // [{field, value, matchIndex, matchLength}]
  }
}

// Error handling for invalid regex
class SearchError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'SearchError';
    this.code = code; // 'INVALID_REGEX', 'FIELD_NOT_FOUND', etc.
  }
}

class SearchEngine {
  constructor() {
    this.patternType = PATTERN_TYPES.REGEX;
  }

  // Validate regex pattern before search
  validatePattern(pattern, patternType) {
    if (patternType === PATTERN_TYPES.REGEX) {
      try {
        new RegExp(pattern);
      } catch (e) {
        throw new SearchError(`Invalid regex: ${e.message}`, 'INVALID_REGEX');
      }
    }
  }

  // Convert regex to SQL LIKE pattern (basic escape)
  regexToSqlLike(pattern) {
    // Escape special SQL LIKE chars: %, _, \
    const escaped = pattern.replace(/([%_\\])/g, '\\$1');
    return `%${escaped}%`;
  }

  // Convert regex to SQL GLOB pattern
  regexToSqlGlob(pattern) {
    // Convert * to *, ? to ?, handle regex specials
    const escaped = pattern
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')  // Escape regex specials
      .replace(/\\\*/g, '*')
      .replace(/\\\?/g, '?');
    return `*${escaped}*`;
  }

  // Main search method - TWO PHASE
  async search(pattern, options = {}) {
    const {
      fields = Object.values(SEARCH_FIELDS),
      patternType = PATTERN_TYPES.REGEX,
      caseSensitive = false,
      libraryID = Zotero.Libraries.userLibraryID,
      progressCallback = () => {}
    } = options;

    // Validate
    this.validatePattern(pattern, patternType);

    // Phase 1: Use Zotero.Search for initial filter
    // This is much faster than loading all items
    const search = new Zotero.Search();
    search.libraryID = libraryID;

    // Build search conditions
    for (const field of fields) {
      if (field === 'tags') {
        search.addCondition('tag', 'is', pattern);
      } else if (field.startsWith('creator.')) {
        // Creator fields need special handling
        const creatorField = field.split('.')[1];
        search.addCondition('creator', creatorField, 'contains', pattern);
      } else {
        search.addCondition(field, 'contains', pattern);
      }
    }

    const itemIDs = await search.search();
    progressCallback({ phase: 'filter', count: itemIDs.length });

    if (itemIDs.length === 0) {
      return [];
    }

    // Phase 2: Load items and apply regex refinement
    const items = await Zotero.Items.getAsync(itemIDs);
    const results = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      progressCallback({ phase: 'refine', current: i + 1, total: items.length });

      const { matchedFields, matchDetails } = this.matchItem(item, pattern, {
        fields,
        patternType,
        caseSensitive
      });

      if (matchedFields.length > 0) {
        results.push(new SearchResult(item, matchedFields, matchDetails));
      }
    }

    return results;
  }

  // Match item against pattern
  matchItem(item, pattern, options = {}) {
    const { fields, patternType, caseSensitive } = options;
    const matchedFields = [];
    const matchDetails = [];

    for (const field of fields) {
      let value;

      // Handle creator fields specially
      if (field.startsWith('creator.')) {
        const creators = item.getCreators();
        if (!creators || creators.length === 0) continue;

        const creatorField = field.split('.')[1]; // 'firstName', 'lastName', 'fullName'
        for (const creator of creators) {
          if (creatorField === 'fullName') {
            value = creator.name;
          } else {
            value = creator[creatorField];
          }

          if (value && this.testValue(value, pattern, patternType, caseSensitive)) {
            matchedFields.push(field);
            const matchIdx = value.indexOf(pattern);
            matchDetails.push({ field, value, matchIndex: matchIdx, matchLength: pattern.length });
            break; // Found match, move to next field
          }
        }
      } else if (field === 'tags') {
        const tags = item.getTags();
        for (const tag of tags) {
          if (this.testValue(tag.name, pattern, patternType, caseSensitive)) {
            matchedFields.push(field);
            matchDetails.push({ field, value: tag.name, matchIndex: -1, matchLength: -1 });
            break;
          }
        }
      } else {
        // Standard field
        value = item.getField(field);
        if (value && this.testValue(value, pattern, patternType, caseSensitive)) {
          matchedFields.push(field);
          const matchIdx = caseSensitive
            ? value.indexOf(pattern)
            : value.toLowerCase().indexOf(pattern.toLowerCase());
          matchDetails.push({ field, value, matchIndex: matchIdx, matchLength: pattern.length });
        }
      }
    }

    return { matchedFields, matchDetails };
  }

  // Test a value against pattern
  testValue(value, pattern, patternType, caseSensitive) {
    const str = String(value);

    switch (patternType) {
      case PATTERN_TYPES.REGEX:
        try {
          const regex = new RegExp(pattern, caseSensitive ? '' : 'i');
          return regex.test(str);
        } catch (e) {
          return false;
        }

      case PATTERN_TYPES.LIKE:
      case PATTERN_TYPES.SQL_LIKE:
        const likePattern = this.regexToSqlLike(pattern);
        const regexFromLike = new RegExp(
          likePattern.replace(/%/g, '.*').replace(/_/g, '.'),
          caseSensitive ? '' : 'i'
        );
        return regexFromLike.test(str);

      case PATTERN_TYPES.GLOB:
      case PATTERN_TYPES.SQL_GLOB:
        const globPattern = this.regexToSqlGlob(pattern);
        return Cu.import('resource://gre/modules/gloda/public.js').Glob.matchString(
          str, '*' + pattern + '*'
        );

      case PATTERN_TYPES.EXACT:
        return caseSensitive
          ? str === pattern
          : str.toLowerCase() === pattern.toLowerCase();

      default:
        return false;
    }
  }
}
```

### 2. Replace Engine (`src/zotero/replace-engine.js`)

**Key Design: Creator Field Handling**
- Creators require array manipulation, not simple setField
- Use `saveTx()` for atomic transactions
- Return detailed preview before modification

```javascript
// Placeholder patterns
const PLACEHOLDER_PATTERN = /\$(\d+)|\$\{([^}]+)\}|&(\w+)/g;

class ReplaceError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ReplaceError';
    this.code = code; // 'INVALID_REPLACE_PATTERN', 'SAVE_FAILED', etc.
  }
}

class ReplaceEngine {
  constructor() {
    this.placeholderPattern = PLACEHOLDER_PATTERN;
  }

  // Compile replacement pattern
  compileReplacePattern(pattern) {
    // Returns: (match, groups, offset, input) => replacement string
    return (match, p1, p2, p3) => {
      if (p1 !== undefined) {
        // $1, $2, etc.
        return p1;
      }
      if (p2 !== undefined) {
        // ${name}
        return p2;
      }
      if (p3 !== undefined) {
        // &match, &field, etc.
        return match;
      }
      return match;
    };
  }

  // Apply replace to a single value
  applyReplace(value, searchPattern, replacePattern, options = {}) {
    const { patternType = 'regex', caseSensitive = false } = options;
    const str = String(value);

    if (patternType === 'regex') {
      const regex = new RegExp(searchPattern, caseSensitive ? 'g' : 'gi');
      const result = str.replace(regex, this.compileReplacePattern(replacePattern));
      const replacements = (str.match(regex) || []).length;
      return { result, replacements };
    }

    // For non-regex, use simple string replace
    const result = str.split(searchPattern).join(replacePattern);
    const replacements = str.split(searchPattern).length - 1;
    return { result, replacements };
  }

  // Preview replace on an item (no save)
  previewReplace(item, searchPattern, replacePattern, options = {}) {
    const { fields = [] } = options;
    const changes = [];

    for (const field of fields) {
      if (field.startsWith('creator.')) {
        // Handle creator fields
        const creators = item.getCreators();
        const modifiedCreators = [...creators];
        let changed = false;

        const creatorField = field.split('.')[1];
        for (let i = 0; i < modifiedCreators.length; i++) {
          const creator = modifiedCreators[i];
          const value = creatorField === 'fullName' ? creator.name : creator[creatorField];

          if (value) {
            const { result } = this.applyReplace(value, searchPattern, replacePattern, options);
            if (result !== value) {
              if (creatorField === 'fullName') {
                modifiedCreators[i] = { ...creator, name: result };
              } else {
                modifiedCreators[i] = { ...creator, [creatorField]: result };
              }
              changed = true;
            }
          }
        }

        if (changed) {
          changes.push({
            field,
            original: JSON.stringify(creators),
            replaced: JSON.stringify(modifiedCreators)
          });
        }
      } else {
        // Standard field
        const original = item.getField(field);
        const { result } = this.applyReplace(original, searchPattern, replacePattern, options);

        if (result !== original) {
          changes.push({ field, original, replaced: result });
        }
      }
    }

    return changes;
  }

  // Apply replace to item (with save)
  async applyReplaceToItem(item, searchPattern, replacePattern, options = {}) {
    const { fields = [], progressCallback = () => {} } = options;

    // Get preview first
    const changes = this.previewReplace(item, searchPattern, replacePattern, options);
    if (changes.length === 0) {
      return { success: false, changes: [], message: 'No changes needed' };
    }

    // Apply changes
    for (const change of changes) {
      progressCallback({ itemID: item.id, field: change.field });

      if (change.field.startsWith('creator.')) {
        // Creator modification - get creators, modify, set back
        const creators = item.getCreators();
        const newCreators = JSON.parse(change.replaced);
        item.setCreators(newCreators);
      } else {
        // Standard field
        item.setField(change.field, change.replaced);
      }
    }

    // Save in transaction
    try {
      await item.saveTx();
      return { success: true, changes, message: 'Saved successfully' };
    } catch (e) {
      return { success: false, changes, message: e.message };
    }
  }

  // Batch process items
  async processItems(items, searchPattern, replacePattern, options = {}) {
    const { fields = [], progressCallback = () => {} } = options;
    const results = {
      modified: 0,
      skipped: 0,
      errors: []
    };

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      progressCallback({ current: i + 1, total: items.length, itemID: item.id });

      try {
        const result = await this.applyReplaceToItem(item, searchPattern, replacePattern, options);

        if (result.success) {
          if (result.changes.length > 0) {
            results.modified++;
          } else {
            results.skipped++;
          }
        } else {
          results.errors.push({ itemID: item.id, error: result.message });
        }
      } catch (e) {
        results.errors.push({ itemID: item.id, error: e.message });
      }
    }

    return results;
  }
}
```

### 3. Progress Manager (`src/zotero/progress-manager.js`)

Handles progress dialog and batch operation feedback.

```javascript
class ProgressManager {
  constructor(window) {
    this.window = window;
    this.dialog = null;
    this.progressMeter = null;
    this.statusLabel = null;
    this.canceled = false;
  }

  // Open progress dialog
  open(title, totalItems) {
    this.canceled = false;
    this.dialog = this.window.openDialog(
      'chrome://zotero-search-replace/content/progress.xul',
      'progress',
      'modal,titlebar,centerscreen',
      { title, total: totalItems }
    );
    return this.dialog;
  }

  // Update progress
  update(current, status) {
    if (!this.dialog || this.canceled) return false;

    const percent = Math.round((current / this.dialog.arguments.total) * 100);
    this.progressMeter.value = percent;
    this.statusLabel.value = status;

    // Process events to keep UI responsive
    this.window.setTimeout(() => {}, 0);

    return !this.canceled;
  }

  // Close dialog
  close() {
    if (this.dialog) {
      this.dialog.close();
      this.dialog = null;
    }
  }

  // Cancel operation
  cancel() {
    this.canceled = true;
  }
}
```

### 4. Preloaded Patterns (`src/patterns/quality-patterns.js`)

```javascript
const DATA_QUALITY_PATTERNS = [
  {
    id: 'fix-comma-space',
    name: 'Fix: Space Before Comma',
    description: 'Fixes "surname , name" → "surname, name"',
    fields: ['creator.lastName', 'creator.firstName'],
    patternType: 'regex',
    search: ' ,',
    replace: ',',
    category: 'Parsing Errors'
  },
  {
    id: 'fix-jr-suffix',
    name: 'Fix: Move Jr/Sr Suffix',
    description: 'Moves "Jr" from given name to surname',
    fields: ['creator.lastName', 'creator.firstName'],
    patternType: 'regex',
    search: '(.+), (Jr|Sr|III|II|IV)$',
    replace: '$2, $1',
    category: 'Parsing Errors'
  },
  {
    id: 'lowercase-van-de',
    name: 'Normalize: Dutch Prefixes',
    description: 'Ensures van/de prefixes stay lowercase',
    fields: ['creator.lastName'],
    patternType: 'regex',
    search: '\\b(Van|De|Van Der|De La)\\b',
    replace: (match) => match.toLowerCase(),
    category: 'Capitalization'
  },
  {
    id: 'normalize-mc-mac',
    name: 'Normalize: Mc/Mac Prefixes',
    description: 'Fixes MCCULLOCH → McCulloch, MACDONALD → MacDonald',
    fields: ['creator.lastName'],
    patternType: 'regex',
    search: '\\bMc([A-Z][a-z]+)\\b',
    replace: 'Mc$1',
    category: 'Capitalization'
  },
  {
    id: 'remove-parens',
    name: 'Remove: Nicknames in Parens',
    description: 'Removes "(nickname)" from names',
    fields: ['creator.firstName', 'creator.lastName'],
    patternType: 'regex',
    search: '\\s*\\([^)]+\\)\\s*',
    replace: '',
    category: 'Data Quality'
  },
  {
    id: 'fix-polish-diacritics',
    name: 'Restore: Polish Diacritics',
    description: 'Fixes common diacritics errors',
    fields: ['creator.lastName', 'title'],
    patternType: 'regex',
    search: '[lns]slash',
    replace: (match) => {
      const map = {'lslash': 'ł', 'nslash': 'ń', 'sslash': 'ś'};
      return map[match] || match;
    },
    category: 'Diacritics'
  },
  {
    id: 'find-empty-creators',
    name: 'Find: Empty Creator Fields',
    description: 'Find items with missing creator names',
    fields: ['creators'],
    patternType: 'custom',
    customCheck: (creators) => creators.some(c => !c.firstName && !c.lastName),
    category: 'Data Quality'
  },
  {
    id: 'find-corporate-authors',
    name: 'Find: Corporate Authors',
    description: 'Find likely corporate/group authors in person fields',
    fields: ['creator.lastName'],
    patternType: 'regex',
    search: '(Collaborators|Group|Association|Institute|Center|Society|Journal|Proceedings)$',
    category: 'Classification'
  }
];

const PATTERN_CATEGORIES = [
  'Parsing Errors',
  'Capitalization',
  'Diacritics',
  'Data Quality',
  'Classification'
];
```

### 4. Search Dialog (`content/dialog.html`)

**Using HTML for modern Zotero 7/8 compatibility**

```html
<!DOCTYPE html>
<html>
<head>
  <title>Search &amp; Replace</title>
  <style>
    html, body {
      font-family: -moz-dialog, Arial, sans-serif;
      padding: 12px;
      margin: 0;
      background: #f9f9f9;
      color: #333;
    }
    .search-panel { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
    .search-panel label { font-weight: bold; }
    .search-panel select, .search-panel input[type="text"] { padding: 4px; }
    .results-panel { flex: 1; display: flex; flex-direction: column; margin-bottom: 12px; }
    .results-header { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
    .results-list { flex: 1; border: 1px solid #ccc; overflow-y: auto; max-height: 300px; background: white; }
    .result-item { display: flex; gap: 8px; padding: 4px 8px; border-bottom: 1px solid #eee; }
    .result-item:hover { background: #f0f0ff; }
    .result-item.selected { background: #e0e0ff; }
    .result-item .match { background: #ffff00; }
    .replace-panel { border-top: 1px solid #ccc; padding-top: 12px; }
    .replace-input-row { display: flex; gap: 8px; margin-bottom: 8px; }
    .replace-input-row input[type="text"] { flex: 1; padding: 4px; }
    .preview-output { width: 100%; height: 80px; font-family: monospace; font-size: 12px; }
    .replace-actions { display: flex; gap: 8px; margin-top: 8px; }
    .patterns-panel { border-top: 1px solid #ccc; padding-top: 8px; }
    .pattern-category { margin: 8px 0; }
    .pattern-item { display: flex; justify-content: space-between; gap: 8px; padding: 4px; }
    .pattern-item:hover { background: #f0f0f0; cursor: pointer; }
    .error { color: red; font-size: 12px; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="search-panel">
    <label for="search-field">Search in:</label>
    <select id="search-field">
      <option value="all">All Fields</option>
      <option value="title">Title</option>
      <option value="creator.lastName">Author (Last)</option>
      <option value="creator.firstName">Author (First)</option>
      <option value="abstractNote">Abstract</option>
      <option value="tags">Tags</option>
      <option value="date">Date</option>
      <option value="publicationTitle">Publication</option>
      <option value="DOI">DOI</option>
      <option value="extra">Extra</option>
    </select>

    <label for="pattern-type">Pattern type:</label>
    <select id="pattern-type">
      <option value="regex">Regular Expression</option>
      <option value="exact">Exact Match</option>
      <option value="sql_like">SQL LIKE (%)</option>
    </select>

    <label><input type="checkbox" id="case-sensitive"> Case sensitive</label>
  </div>

  <div class="search-panel">
    <input type="text" id="search-input" placeholder="Enter search pattern..." style="flex: 1;">
    <button id="search-button">Search</button>
  </div>

  <div class="results-panel">
    <div class="results-header">
      <span id="results-count">0 items found</span>
      <button id="select-all">Select All</button>
      <button id="deselect-all">Deselect All</button>
    </div>
    <div class="results-list" id="results-list">
      <!-- Results rendered here -->
    </div>
    <div id="search-error" class="error"></div>
  </div>

  <div class="replace-panel">
    <div class="replace-input-row">
      <input type="text" id="replace-input" placeholder="Replacement text..." style="flex: 1;">
      <button id="preview-replace">Preview</button>
    </div>
    <textarea id="preview-output" class="preview-output" readonly></textarea>
    <div class="replace-actions">
      <button id="apply-replace" disabled>Replace in Selected</button>
      <button id="create-collection">Create Collection...</button>
    </div>
  </div>

  <div class="patterns-panel">
    <details>
      <summary>Preloaded Data Quality Patterns</summary>
      <div class="patterns-list" id="patterns-list">
        <!-- Patterns rendered here by category -->
      </div>
    </details>
  </div>

  <script src="dialog-controller.js"></script>
</body>
</html>
```

### 5. Progress Dialog (`content/progress.html`)

Simple modal dialog for batch operation progress.

```html
<!DOCTYPE html>
<html>
<head>
  <title>Processing...</title>
  <style>
    html, body {
      font-family: -moz-dialog, Arial, sans-serif;
      padding: 20px;
      margin: 0;
      text-align: center;
    }
    #status-label { margin-bottom: 12px; }
    #progress-bar { width: 100%; height: 24px; }
    #cancel-button { margin-top: 12px; }
  </style>
</head>
<body>
  <div id="status-label">Processing...</div>
  <progress id="progress-bar" value="0" max="100"></progress>
  <div>
    <button id="cancel-button">Cancel</button>
  </div>
  <script src="progress-dialog.js"></script>
</body>
</html>
```

### 6. Dialog Controller (`content/scripts/dialog-controller.js`)

```javascript
var ZoteroSearchDialog = {
  state: {
    searchPattern: '',
    replacePattern: '',
    patternType: 'regex',
    caseSensitive: false,
    fields: [],
    results: [],
    selectedItemIDs: new Set(),
    replacedCount: 0
  },

  elements: {},

  init: function() {
    this.cacheElements();
    this.loadPreloadedPatterns();
    this.setupKeyboardShortcuts();
    this.updateUIState();
  },

  cacheElements: function() {
    this.elements = {
      searchInput: document.getElementById('search-input'),
      searchField: document.getElementById('search-field'),
      patternType: document.getElementById('pattern-type'),
      caseSensitive: document.getElementById('case-sensitive'),
      searchButton: document.getElementById('search-button'),
      resultsCount: document.getElementById('results-count'),
      resultsList: document.getElementById('results-list'),
      replaceInput: document.getElementById('replace-input'),
      previewOutput: document.getElementById('preview-output'),
      applyReplace: document.getElementById('apply-replace'),
      createCollection: document.getElementById('create-collection'),
      patternsList: document.getElementById('patterns-list'),
      searchError: document.getElementById('search-error')
    };
  },

  setupKeyboardShortcuts: function() {
    document.addEventListener('keydown', (event) => {
      const target = event.target.tagName;
      if (target === 'INPUT' || target === 'TEXTAREA' || target === 'SELECT') {
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        if (event.key === 'Enter') {
          event.preventDefault();
          this.performSearch();
        } else if (event.key === 'r') {
          event.preventDefault();
          this.elements.replaceInput.focus();
        }
      } else if (event.key === 'Escape') {
        window.close();
      }
    });
  },

  performSearch: async function() {
    const pattern = this.elements.searchInput.value;
    if (!pattern) {
      this.showError('Please enter a search pattern');
      return;
    }

    const field = this.elements.searchField.value;
    const fields = field === 'all'
      ? ['title', 'abstractNote', 'tags', 'date', 'publicationTitle', 'DOI', 'extra',
         'creator.lastName', 'creator.firstName']
      : [field];

    const patternType = this.elements.patternType.value;
    const caseSensitive = this.elements.caseSensitive.checked;

    this.showProgress('Searching...');

    try {
      const engine = new ZoteroSearchEngine();
      const results = await engine.search(pattern, {
        fields,
        patternType,
        caseSensitive,
        progressCallback: (progress) => {
          if (progress.phase === 'filter') {
            this.showProgress(`Found ${progress.count} potential matches...`);
          } else if (progress.phase === 'refine') {
            this.showProgress(`Refining ${progress.current}/${progress.total}...`);
          }
        }
      });

      this.state.results = results;
      this.state.fields = fields;
      this.renderResults();

    } catch (e) {
      if (e.name === 'SearchError') {
        this.showError(`Search error: ${e.message}`);
      } else {
        this.showError(`Unexpected error: ${e.message}`);
      }
    }
  },

  renderResults: function() {
    const list = this.elements.resultsList;
    while (list.firstChild) {
      list.removeChild(list.firstChild);
    }

    for (const result of this.state.results) {
      for (const detail of result.matchDetails) {
        const item = document.createElement('div');
        item.className = 'result-item';
        item.dataset.itemID = result.itemID;

        const title = document.createElement('span');
        title.textContent = result.item.getField('title');
        title.style.flex = '1';

        const field = document.createElement('span');
        field.textContent = detail.field;
        field.style.width = '120px';

        const match = document.createElement('span');
        const preview = this.getMatchPreview(detail.value, detail.matchIndex, detail.matchLength);
        match.textContent = preview;

        item.appendChild(title);
        item.appendChild(field);
        item.appendChild(match);

        item.addEventListener('click', () => {
          item.classList.toggle('selected');
          const id = parseInt(item.dataset.itemID);
          if (this.state.selectedItemIDs.has(id)) {
            this.state.selectedItemIDs.delete(id);
          } else {
            this.state.selectedItemIDs.add(id);
          }
          this.updateUIState();
        });

        list.appendChild(item);
      }
    }

    this.elements.resultsCount.textContent = `${this.state.results.length} items found`;
    this.updateUIState();
  },

  getMatchPreview: function(value, matchIndex, matchLength) {
    if (matchIndex < 0) return value;

    const start = Math.max(0, matchIndex - 20);
    const end = Math.min(value.length, matchIndex + matchLength + 20);
    let preview = value.substring(start, end);

    if (start > 0) preview = '...' + preview;
    if (end < value.length) preview = preview + '...';

    return preview;
  },

  selectAll: function() {
    const items = this.elements.resultsList.querySelectorAll('.result-item');
    items.forEach(item => {
      item.classList.add('selected');
      this.state.selectedItemIDs.add(parseInt(item.dataset.itemID));
    });
    this.updateUIState();
  },

  deselectAll: function() {
    const items = this.elements.resultsList.querySelectorAll('.result-item');
    items.forEach(item => {
      item.classList.remove('selected');
    });
    this.state.selectedItemIDs.clear();
    this.updateUIState();
  },

  previewReplace: async function() {
    if (this.state.results.length === 0) {
      this.showError('No results to preview');
      return;
    }

    const firstResult = this.state.results[0];
    const searchPattern = this.elements.searchInput.value;
    const replacePattern = this.elements.replaceInput.value;
    const patternType = this.elements.patternType.value;
    const caseSensitive = this.elements.caseSensitive.checked;

    const engine = new ZoteroReplaceEngine();
    const changes = engine.previewReplace(firstResult.item, searchPattern, replacePattern, {
      fields: this.state.fields,
      patternType,
      caseSensitive
    });

    if (changes.length === 0) {
      this.elements.previewOutput.value = 'No changes would be made';
    } else {
      let preview = 'Preview for first item:\n\n';
      for (const change of changes) {
        preview += `${change.field}:\n`;
        preview += `  Original: "${change.original}"\n`;
        preview += `  Replaced: "${change.replaced}"\n\n`;
      }
      this.elements.previewOutput.value = preview;
    }
  },

  applyReplace: async function() {
    const selectedIDs = Array.from(this.state.selectedItemIDs);
    if (selectedIDs.length === 0) {
      this.showError('No items selected');
      return;
    }

    const selectedItems = this.state.results
      .filter(r => this.state.selectedItemIDs.has(r.itemID))
      .map(r => r.item);

    const searchPattern = this.elements.searchInput.value;
    const replacePattern = this.elements.replaceInput.value;
    const patternType = this.elements.patternType.value;
    const caseSensitive = this.elements.caseSensitive.checked;

    if (!confirm(`Replace in ${selectedItems.length} items?`)) {
      return;
    }

    const progressWindow = window.open('progress.html', 'progress',
      'width=400,height=200,modal=yes,centerscreen');

    try {
      const engine = new ZoteroReplaceEngine();
      const result = await engine.processItems(selectedItems, searchPattern, replacePattern, {
        fields: this.state.fields,
        patternType,
        caseSensitive,
        progressCallback: (progress) => {
          this.updateProgress(progressWindow, progress);
        }
      });

      progressWindow.close();

      let message = `Modified: ${result.modified}\n`;
      message += `Skipped: ${result.skipped}\n`;
      if (result.errors.length > 0) {
        message += `Errors: ${result.errors.length}`;
      }
      alert(message);

      this.performSearch();

    } catch (e) {
      progressWindow.close();
      this.showError(`Replace failed: ${e.message}`);
    }
  },

  createCollection: async function() {
    const selectedIDs = Array.from(this.state.selectedItemIDs);
    if (selectedIDs.length === 0) {
      this.showError('No items selected');
      return;
    }

    const name = prompt('Enter collection name:');
    if (!name) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      this.showError('Collection name cannot be empty');
      return;
    }

    try {
      const collection = new Zotero.Collection();
      collection.name = trimmedName;
      await collection.saveTx();

      const items = await Zotero.Items.getAsync(selectedIDs);
      for (const item of items) {
        item.addToCollection(collection.id);
        await item.saveTx();
      }

      alert(`Created collection "${trimmedName}" with ${selectedIDs.length} items`);

    } catch (e) {
      this.showError(`Failed to create collection: ${e.message}`);
    }
  },

  loadPreloadedPatterns: function() {
    if (typeof DATA_QUALITY_PATTERNS === 'undefined') return;

    const container = this.elements.patternsList;
    if (!container) return;

    const categories = {};
    for (const pattern of DATA_QUALITY_PATTERNS) {
      if (!categories[pattern.category]) {
        const catDiv = document.createElement('div');
        catDiv.className = 'pattern-category';
        const catTitle = document.createElement('strong');
        catTitle.textContent = pattern.category;
        catDiv.appendChild(catTitle);
        container.appendChild(catDiv);
        categories[pattern.category] = [];
      }
      categories[pattern.category].push(pattern);
    }

    for (const catName in categories) {
      const catDiv = container.lastChild;
      for (const pattern of categories[catName]) {
        const item = document.createElement('div');
        item.className = 'pattern-item';

        const name = document.createElement('span');
        name.textContent = pattern.name;

        const desc = document.createElement('span');
        desc.style.color = '#666';
        desc.style.fontSize = '12px';
        desc.textContent = pattern.description;

        item.appendChild(name);
        item.appendChild(desc);

        item.addEventListener('click', () => {
          this.elements.searchInput.value = pattern.search;
          this.elements.replaceInput.value = pattern.replace || '';
          if (pattern.fields && pattern.fields.length > 0) {
            this.elements.searchField.value = pattern.fields[0];
          }
          if (pattern.patternType) {
            this.elements.patternType.value = pattern.patternType;
          }
        });

        catDiv.appendChild(item);
      }
    }
  },

  updateUIState: function() {
    const hasResults = this.state.results.length > 0;
    const hasSelection = this.state.selectedItemIDs.size > 0;
    const hasReplace = this.elements.replaceInput.value.length > 0;

    this.elements.applyReplace.disabled = !hasSelection || !hasReplace;
  },

  showError: function(message) {
    this.elements.searchError.textContent = message;
    setTimeout(() => {
      this.elements.searchError.textContent = '';
    }, 5000);
  },

  showProgress: function(message) {
    this.elements.resultsCount.textContent = message;
  },

  updateProgress: function(progressWindow, progress) {
    if (progressWindow && !progressWindow.closed) {
      const percent = Math.round((progress.current / progress.total) * 100);
      progressWindow.postMessage({ type: 'progress', percent, status: progress.status }, '*');
    }
  }
};

document.addEventListener('DOMContentLoaded', function() {
  ZoteroSearchDialog.init();
});
```

---

## Implementation Plan

### Phase 1: Project Setup (Day 1)

1. **Create project structure**
   ```
   mkdir -p zotero-search-replace/{content/scripts,src/zotero,src/patterns,tests/unit}
   ```

2. **Copy configuration files from zotero-ner**
   - `manifest.json` - Modify for new plugin ID: `zotero-search-replace@marcinmilkowski.pl`
   - `package.json` - Update name, version, repos
   - `webpack.config.js` - Update entry points to bundle `src/index.js`
   - `bootstrap.js` - Copy from zotero-ner, update plugin name references

3. **Set up zotero-plugin-scaffold**
   - Run `npm install`
   - Verify `npm run start` serves the addon

### Phase 2: Core Search Engine (Day 2)

1. **Implement `src/zotero/search-engine.js`**
   - Pattern type constants (REGEX, EXACT, SQL_LIKE)
   - Field mappings (Zotero field names)
   - `SearchResult` class
   - Two-phase search: `Zotero.Search` + regex refinement
   - Error handling for invalid regex
   - Export as `ZoteroSearchEngine`

2. **Add tests for search engine**
   - Mock Zotero.Items and Zotero.Search
   - Test pattern matching
   - Test field extraction
   - Test error handling

### Phase 3: Replace Engine (Day 3)

1. **Implement `src/zotero/replace-engine.js`**
   - Placeholder pattern compilation ($1, ${name}, &match)
   - `previewReplace()` method for dry-run
   - `applyReplaceToItem()` with creator array handling
   - `processItems()` batch processing
   - Export as `ZoteroReplaceEngine`

2. **Add tests for replace engine**
   - Test placeholder replacement
   - Test creator field modification
   - Test multi-field replace
   - Test error handling

### Phase 4: Preloaded Patterns (Day 4)

1. **Implement `src/patterns/quality-patterns.js`**
   - Define PATTERN_CATEGORIES array
   - Implement 15-20 patterns from data-quality-issues.md
   - Pattern metadata: id, name, description, fields, patternType, search, replace, category
   - Export as `DATA_QUALITY_PATTERNS` and `PATTERN_CATEGORIES`

2. **Add tests for patterns**
   - Validate pattern syntax
   - Test pattern on sample data

### Phase 5: UI Implementation (Day 5-6)

1. **Create `content/dialog.html`**
   - HTML dialog structure with styled elements
   - Select dropdowns for field and pattern type
   - Results list div
   - Preview textarea for replace results

2. **Create `content/progress.html`**
   - Simple modal progress dialog
   - HTML progress element
   - Status label
   - Cancel button

3. **Create `content/scripts/dialog-controller.js`**
   - `ZoteroSearchDialog` namespace
   - `init()`, `performSearch()`, `renderResults()`
   - HTML DOM manipulation (createElement, appendChild)
   - Replace and preview logic
   - Collection creation

4. **Create `content/scripts/zotero-search.js`**
   - Menu item in Tools

3. **Create `content/scripts/zotero-search.js`**
   - Menu item in Tools
   - Dialog opening function: `window.openDialog()`
   - Bootstrap hooks integration

### Phase 6: Testing & Polish (Day 7)

1. **Integration tests**
   - Full search workflow
   - Replace confirmation dialog
   - Collection creation
   - Pattern application on real data

2. **Manual testing**
   - Search across all fields
   - Regex pattern matching
   - Replace preserves item structure
   - Collection creation
   - Preloaded patterns
   - Progress dialog
   - Keyboard shortcuts
   - Dialog closes properly

3. **Documentation**
   - README.md with features
   - Pattern catalog inline documentation
   - Developer guide for adding patterns

---

## Critical Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `manifest.json` | Create | Extension manifest (MV3) |
| `package.json` | Create | NPM configuration (uses zotero-plugin-scaffold) |
| `webpack.config.js` | Create | Build configuration |
| `bootstrap.js` | Copy+modify | Lifecycle hooks |
| `content/dialog.html` | Create | Main HTML dialog UI |
| `content/progress.html` | Create | Progress dialog for batch operations |
| `content/scripts/zotero-search.js` | Create | Menu integration, window hooks |
| `content/scripts/dialog-controller.js` | Create | Dialog controller |
| `src/index.js` | Create | Module exports (bundled) |
| `src/zotero/search-engine.js` | Create | Search implementation (bundled) |
| `src/zotero/replace-engine.js` | Create | Replace implementation (bundled) |
| `src/zotero/progress-manager.js` | Create | Progress dialog helper (bundled) |
| `src/patterns/quality-patterns.js` | Create | Preloaded patterns (bundled) |
| `tests/unit/` | Create | Jest unit tests (npm run test:unit) |
| `tests/zotero-framework/` | Create | Zotero integration tests (npm run test:zotero) |

---

## Zotero API Usage Reference

```javascript
// TWO-PHASE SEARCH: More efficient for large libraries

// Phase 1: Use Zotero.Search for initial filtering
const search = new Zotero.Search();
search.libraryID = Zotero.Libraries.userLibraryID;
search.addCondition('title', 'contains', pattern);  // Uses SQL LIKE
search.addCondition('creator', 'lastName', 'contains', pattern);
const itemIDs = await search.search();
// itemIDs is filtered array - much smaller than all items

// Phase 2: Load full items only for matches
const items = await Zotero.Items.getAsync(itemIDs);

// Item fields
const title = item.getField('title');
const creators = item.getCreators();  // Returns array of creator objects
const tags = item.getTags();  // Returns array of {tag, type}

// Setting item fields
item.setField('title', newTitle);

// Setting creators (must set full array)
const newCreators = [...creators];
newCreators[index] = { firstName: 'New', lastName: 'Name', creatorType: 1 };
item.setCreators(newCreators);
await item.saveTx();  // Atomic transaction

// Creating collection
const collection = new Zotero.Collection();
collection.name = 'Collection Name';
await collection.saveTx();
item.addToCollection(collection.id);
await item.saveTx();

// Virtual collection (future - for showing results in Zotero UI)
Zotero.VirtualCollections.create('search-results', itemIDs);
```

---

## Testing Strategy

**Following zotero-plugin-scaffold approach**

### Unit Tests (`npm run test:unit`)
Using Jest in `tests/unit/` directory:
- **SearchEngine tests**: Mock `Zotero.Search` and `Zotero.Items`
  - Regex pattern matching
  - Field extraction
  - Error handling (invalid regex)
- **ReplaceEngine tests**: Mock Zotero item operations
  - Placeholder replacement ($1, ${name})
  - Creator array modification
  - Batch processing with progress callbacks
- **QualityPatterns**: Pattern syntax validation

### Integration Tests (`npm run test:zotero`)
Using zotero-plugin-scaffold test framework:
- **Full search workflow**
  - Search with various pattern types
  - Verify results match expected items
- **Replace with confirmation**
  - Preview shows correct changes
  - Replace modifies items correctly
  - Verify items are saved
- **Collection creation**
  - Verify collection is created
  - Verify items are added to collection
- **Pattern application**
  - Apply preloaded patterns
  - Verify pattern modifies expected fields

### Manual Testing Checklist
- [ ] Search across all fields works
- [ ] Regex patterns match correctly
- [ ] Invalid regex shows error message
- [ ] Replace preserves item structure
- [ ] Creator modifications work correctly
- [ ] Progress dialog shows during batch operations
- [ ] Collection is created correctly
- [ ] Preloaded patterns apply correctly
- [ ] Keyboard shortcuts work (Ctrl+Enter, Escape)
- [ ] Dialog closes properly
- [ ] Large library performance is acceptable

---

## Known Constraints & Solutions

| Constraint | Solution |
|------------|----------|
| Large libraries | Two-phase search: `Zotero.Search` for filter, load full items only for matches |
| Invalid regex crashes | Try/catch with `SearchError`/`ReplaceError` exceptions |
| Creator modification | Must use `getCreators()` → modify array → `setCreators()` → `saveTx()` |
| Dialog modal blocking | Use `window.openDialog` with return values and callbacks |
| No undo | Recommend Zotero backup; show "Items to be modified" count before confirm |
| Test SQL complexity | Mock `Zotero.Search` for unit tests |
| Batch performance | Each item saves independently; use progress dialog |

---

## Post-MVP Enhancements (Future)

1. **Save/load presets** - User-defined saved searches in prefs (JSON)
2. **Virtual collection view** - Show results in Zotero's item list instead of dialog tree
3. **CSV export** - Export matching items using Zotero's built-in export
4. **Tag automation** - Auto-tag items matching patterns
5. **Advanced SQL mode** - Raw SQL WHERE clause input for power users
6. **Pattern library online** - Download patterns from server
7. **Batch undo** - Store previous values, allow rollback

1. **Save search presets** - User-defined saved searches
2. **Export/Import patterns** - Share patterns with others
3. **Dry run mode** - Preview changes without applying
4. **Undo last operation** - Rollback last replace
5. **CSV export** - Export matching items
6. **Advanced SQL mode** - Raw SQL for power users
7. **Pattern library online** - Download patterns from server
8. **AI pattern suggestions** - ML-based pattern detection

---

## Appendix: Preloaded Pattern Catalog

From data-quality-issues.md analysis:

| Pattern ID | Name | Category | Fields |
|------------|------|----------|--------|
| fix-comma-space | Fix: Space Before Comma | Parsing Errors | creator.lastName |
| fix-jr-suffix | Fix: Jr/Sr/III Suffix | Parsing Errors | creator.* |
| fix-inverted-name | Fix: Inverted Full Name | Parsing Errors | creator.* |
| lowercase-van | Normalize: Dutch van/de | Capitalization | creator.lastName |
| lowercase-von | Normalize: German von | Capitalization | creator.lastName |
| lowercase-y | Normalize: Spanish y | Capitalization | creator.lastName |
| normalize-mc | Normalize: Mc Prefix | Capitalization | creator.lastName |
| normalize-mac | Normalize: Mac Prefix | Capitalization | creator.lastName |
| remove-parens | Remove: Nickname Parens | Data Quality | creator.* |
| restore-diacritics | Restore: Polish Diacritics | Diacritics | creator.lastName, title |
| find-empty-creators | Find: Empty Creator Fields | Data Quality | creators |
| find-corporate | Find: Corporate Authors | Classification | creator.lastName |
| find-roman-numeral | Find: Jr/Sr/III in Given | Data Quality | creator.firstName |
