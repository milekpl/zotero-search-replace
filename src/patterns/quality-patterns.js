/**
 * Preloaded Data Quality Patterns for Zotero Search & Replace Plugin
 * Patterns for common bibliographic data issues
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
    id: 'fix-double-comma',
    name: 'Fix: Double Commas',
    description: 'Removes duplicate commas in author names',
    fields: ['creator.lastName', 'creator.firstName'],
    patternType: 'regex',
    search: ',,',
    replace: ',',
    category: 'Parsing Errors'
  },
  {
    id: 'fix-trailing-comma',
    name: 'Fix: Trailing Comma',
    description: 'Removes trailing comma at end of name',
    fields: ['creator.lastName'],
    patternType: 'regex',
    search: ',$',
    replace: '',
    category: 'Parsing Errors'
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

  // === Capitalization ===
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
    id: 'lowercase-von',
    name: 'Normalize: German von',
    description: 'Ensures von prefix stays lowercase',
    fields: ['creator.lastName'],
    patternType: 'regex',
    search: '\\bVon\\b',
    replace: 'von',
    category: 'Capitalization'
  },
  {
    id: 'normalize-mc-mac',
    name: 'Normalize: Mc/Mac Prefixes',
    description: 'Fixes MCCULLOCH → McCulloch, MACDONALD → MacDonald',
    fields: ['creator.lastName'],
    patternType: 'regex',
    search: '\\bMc([A-Z][a-z]+)',
    replace: 'Mc$1',
    category: 'Capitalization'
  },
  {
    id: 'normalize-mac',
    name: 'Normalize: Mac Prefix',
    description: 'Fixes MAC→Mac when followed by lowercase letters',
    fields: ['creator.lastName'],
    patternType: 'regex',
    search: '\\bMac([a-z])',
    replace: (match) => 'Mac' + match[3].toUpperCase(),
    category: 'Capitalization'
  },

  // === Diacritics ===
  {
    id: 'fix-polish-diacritics',
    name: 'Restore: Polish Diacritics',
    description: 'Fixes common diacritics errors for Polish names',
    fields: ['creator.lastName', 'creator.firstName', 'title'],
    patternType: 'regex',
    search: '[lns]slash',
    replace: (match) => {
      const map = { 'lslash': 'ł', 'nslash': 'ń', 'sslash': 'ś' };
      return map[match] || match;
    },
    category: 'Diacritics'
  },
  {
    id: 'fix-german-diacritics',
    name: 'Restore: German Diacritics',
    description: 'Fixes German umlauts from stripped characters',
    fields: ['creator.lastName', 'creator.firstName', 'title'],
    patternType: 'regex',
    search: 'a"',
    replace: 'ä',
    category: 'Diacritics'
  },

  // === Data Quality ===
  {
    id: 'find-empty-creators',
    name: 'Find: Empty Creator Fields',
    description: 'Find items with missing creator names',
    fields: ['creators'],
    patternType: 'custom',
    customCheck: (creators) => creators && creators.some(c => !c.firstName && !c.lastName),
    category: 'Data Quality'
  },
  {
    id: 'find-empty-titles',
    name: 'Find: Empty Titles',
    description: 'Find items with missing or empty titles',
    fields: ['title'],
    patternType: 'regex',
    search: '^\\s*$',
    replace: '',
    category: 'Data Quality'
  },
  {
    id: 'fix-url-http',
    name: 'Normalize: HTTP to HTTPS',
    description: 'Updates URLs from http:// to https://',
    fields: ['url'],
    patternType: 'regex',
    search: 'http://',
    replace: 'https://',
    category: 'Data Quality'
  },

  // === Classification ===
  {
    id: 'find-corporate-authors',
    name: 'Find: Corporate Authors',
    description: 'Find likely corporate/group authors in person fields',
    fields: ['creator.lastName'],
    patternType: 'regex',
    search: '(Collaborators|Group|Association|Institute|Center|Society|Journal|Proceedings)$',
    replace: '',
    category: 'Classification'
  },
  {
    id: 'find-journal-in-author',
    name: 'Find: Journal Name in Author',
    description: 'Find items where journal name appears as author',
    fields: ['creator.lastName'],
    patternType: 'regex',
    search: '(Journal|Review|Proceedings|Transactions)',
    replace: '',
    category: 'Classification'
  }
];

export default DATA_QUALITY_PATTERNS;
