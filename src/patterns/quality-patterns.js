/**
 * Preloaded Data Quality Patterns for Zotero Search & Replace Plugin
 * Patterns for common bibliographic data issues
 *
 * Format: Array of condition objects, each with:
 *   - operator: 'AND' (default), 'OR', 'AND_NOT', 'OR_NOT'
 *   - field: the field to search
 *   - pattern: the search pattern
 *   - patternType: 'regex' (default), 'exact', 'contains'
 *
 * Note: For OR logic across fields, use operator: 'OR' on ALL conditions.
 * The engine uses the first condition's operator to determine group logic.
 */

export const PATTERN_CATEGORIES = [
  'Parsing Errors',
  'Capitalization',
  'Diacritics',
  'Data Quality',
  'Classification'
];

export const DATA_QUALITY_PATTERNS = [
  // === Parsing Errors ===
  {
    id: 'fix-jr-suffix',
    name: 'Fix: Move Jr/Sr Suffix',
    description: 'Moves "Jr" from given name to surname',
    conditions: [
      { operator: 'OR', field: 'creator.lastName', pattern: '(.+), (Jr|Sr|III|II|IV)$', patternType: 'regex' },
      { operator: 'OR', field: 'creator.firstName', pattern: '(.+), (Jr|Sr|III|II|IV)$', patternType: 'regex' }
    ],
    replace: '$2, $1',
    category: 'Parsing Errors'
  },
  {
    id: 'fix-double-comma',
    name: 'Fix: Double Commas',
    description: 'Removes duplicate commas in author names',
    conditions: [
      { operator: 'OR', field: 'creator.lastName', pattern: ',,', patternType: 'regex' },
      { operator: 'OR', field: 'creator.firstName', pattern: ',,', patternType: 'regex' }
    ],
    replace: ',',
    category: 'Parsing Errors'
  },
  {
    id: 'fix-trailing-comma',
    name: 'Fix: Trailing Comma',
    description: 'Removes trailing comma at end of name',
    conditions: [
      { field: 'creator.lastName', pattern: ',$', patternType: 'regex' }
    ],
    replace: '',
    category: 'Parsing Errors'
  },
  {
    id: 'find-spurious-dot',
    name: 'Find: Spurious Dot in Given Name',
    description: 'Finds spurious dots after given names (e.g., "John." instead of "John")',
    conditions: [
      { field: 'creator.firstName', pattern: '([a-z]{2,})\\.$', patternType: 'regex' }
    ],
    replace: '$1',
    category: 'Parsing Errors'
  },
  {
    id: 'remove-parens',
    name: 'Remove: Nicknames in Parens',
    description: 'Removes "(nickname)" from names',
    conditions: [
      { operator: 'OR', field: 'creator.firstName', pattern: '\\s*\\([^)]+\\)\\s*', patternType: 'regex' },
      { operator: 'OR', field: 'creator.lastName', pattern: '\\s*\\([^)]+\\)\\s*', patternType: 'regex' }
    ],
    replace: '',
    category: 'Data Quality'
  },
  {
    id: 'fix-whitespace-colon',
    name: 'Fix: Whitespace Before Colon',
    description: 'Removes whitespace before colons (all fields)',
    conditions: [
      { field: 'all', pattern: '\\s+:', patternType: 'regex' }
    ],
    replace: ':',
    category: 'Parsing Errors'
  },
  {
    id: 'fix-whitespace-semicolon',
    name: 'Fix: Whitespace Before Semicolon',
    description: 'Removes whitespace before semicolons (all fields)',
    conditions: [
      { field: 'all', pattern: '\\s+;', patternType: 'regex' }
    ],
    replace: ';',
    category: 'Parsing Errors'
  },
  {
    id: 'fix-missing-space-paren',
    name: 'Fix: Missing Space Before (',
    description: 'Adds space before opening parenthesis (all fields)',
    conditions: [
      { field: 'all', pattern: '([a-z])\\(', patternType: 'regex' }
    ],
    replace: '$1 (',
    category: 'Parsing Errors'
  },

  // === Capitalization ===
  {
    id: 'lowercase-van-de',
    name: 'Normalize: Dutch Prefixes',
    description: 'Ensures van/de prefixes stay lowercase',
    conditions: [
      { field: 'creator.lastName', pattern: '\\b(Van|De|Van Der|De La)\\b', patternType: 'regex' }
    ],
    replace: (match) => match.toLowerCase(),
    category: 'Capitalization'
  },
  {
    id: 'lowercase-von',
    name: 'Normalize: German von',
    description: 'Ensures von prefix stays lowercase',
    conditions: [
      { field: 'creator.lastName', pattern: '\\bVon\\b', patternType: 'regex' }
    ],
    replace: 'von',
    category: 'Capitalization'
  },
  {
    id: 'normalize-mc',
    name: 'Normalize: Mc Prefix',
    description: 'Fixes MCCULLOCH -> McCulloch and McDonald -> McDonald',
    conditions: [
      { field: 'creator.lastName', pattern: '\\b[Mm][Cc][A-Za-z]*', patternType: 'regex' }
    ],
    replace: (m) => m.charAt(0).toUpperCase() + m.charAt(1).toLowerCase() + m.slice(2).charAt(0).toUpperCase() + m.slice(3).toLowerCase(),
    category: 'Capitalization'
  },
  {
    id: 'normalize-mac',
    name: 'Normalize: Mac Prefix',
    description: 'Fixes MACDONALD -> MacDonald',
    conditions: [
      { field: 'creator.lastName', pattern: '\\b[Mm][Aa][Cc][A-Za-z]*', patternType: 'regex' }
    ],
    replace: (m) => m.charAt(0).toUpperCase() + m.charAt(1).toLowerCase() + m.charAt(2).toUpperCase() + m.slice(3).toLowerCase(),
    category: 'Capitalization'
  },

  // === Diacritics ===
  {
    id: 'fix-polish-diacritics',
    name: 'Restore: Polish Diacritics',
    description: 'Fixes BibTeX-encoded Polish diacritics (l/→ł, n/→ń, s/→ś)',
    conditions: [
      { field: 'all', pattern: 'l/', patternType: 'regex' }
    ],
    replace: 'ł',
    category: 'Diacritics'
  },
  {
    id: 'fix-german-diacritics',
    name: 'Restore: German Diacritics',
    description: 'Fixes German umlauts from stripped characters (a"→ä, o"→ö, u"→ü, e"→ë)',
    conditions: [
      { field: 'all', pattern: 'a"', patternType: 'regex' }
    ],
    replace: 'ä',
    category: 'Diacritics'
  },
  {
    id: 'fix-german-eszett',
    name: 'Restore: German Eszett',
    description: 'Fixes ß from ss (BibTeX strips ß to ss)',
    conditions: [
      { operator: 'OR', field: 'creator.lastName', pattern: 'ss(?=[a-zA-Z]|$)', patternType: 'regex' },
      { operator: 'OR', field: 'creator.firstName', pattern: 'ss(?=[a-zA-Z]|$)', patternType: 'regex' },
      { operator: 'OR', field: 'title', pattern: 'ss(?=[a-zA-Z]|$)', patternType: 'regex' }
    ],
    replace: 'ß',
    category: 'Diacritics'
  },

  // === Data Quality ===
  {
    id: 'find-empty-creators',
    name: 'Find: Empty Creator Fields',
    description: 'Find items with missing creator names (empty lastName OR empty firstName)',
    conditions: [
      { operator: 'OR', field: 'creator.lastName', pattern: '^$', patternType: 'regex' },
      { operator: 'OR', field: 'creator.firstName', pattern: '^$', patternType: 'regex' }
    ],
    replace: '',
    category: 'Data Quality'
  },
  {
    id: 'find-empty-titles',
    name: 'Find: Empty Titles',
    description: 'Find items with missing or empty titles',
    conditions: [
      { field: 'title', pattern: '^\\s*$', patternType: 'regex' }
    ],
    replace: '',
    category: 'Data Quality'
  },
  {
    id: 'fix-url-http',
    name: 'Normalize: HTTP to HTTPS',
    description: 'Updates URLs from http:// to https://',
    conditions: [
      { field: 'url', pattern: 'http://', patternType: 'regex' }
    ],
    replace: 'https://',
    category: 'Data Quality'
  },
  {
    id: 'remove-all-urls',
    name: 'Remove: All URLs',
    description: 'Removes all URLs from the URL field',
    conditions: [
      { field: 'url', pattern: '.+', patternType: 'regex' }
    ],
    replace: '',
    category: 'Data Quality'
  },
  {
    id: 'remove-google-books-urls',
    name: 'Remove: Google Books URLs',
    description: 'Removes Google Books URLs from books (books.google.com)',
    conditions: [
      { field: 'url', pattern: 'https?://books\\.google\\.com/[^\\s]*', patternType: 'regex' }
    ],
    secondCondition: { field: 'itemType', pattern: 'book' },
    replace: '',
    category: 'Data Quality'
  },
  {
    id: 'remove-worldcat-urls',
    name: 'Remove: WorldCat URLs',
    description: 'Removes WorldCat URLs from books (www.worldcat.org)',
    conditions: [
      { field: 'url', pattern: 'https?://www\\.worldcat\\.org/[^\\s]*', patternType: 'regex' }
    ],
    secondCondition: { field: 'itemType', pattern: 'book' },
    replace: '',
    category: 'Data Quality'
  },

  // === Classification ===
  {
    id: 'find-corporate-authors',
    name: 'Find: Corporate Authors',
    description: 'Find likely corporate/group authors in person fields',
    conditions: [
      { field: 'creator.lastName', pattern: '\\s+(Collaborators|Group|Association|Institute|Center|Society|Journal|Proceedings)\\s*$', patternType: 'regex' }
    ],
    replace: '',
    category: 'Classification'
  },
  {
    id: 'find-journal-in-author',
    name: 'Find: Journal Name in Author',
    description: 'Find items where journal name appears as author',
    conditions: [
      { field: 'creator.lastName', pattern: '(Journal|Review|Proceedings|Transactions)', patternType: 'regex' }
    ],
    replace: '',
    category: 'Classification'
  }
];

export default DATA_QUALITY_PATTERNS;
