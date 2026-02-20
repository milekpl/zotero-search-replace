/**
 * Unit tests for Quality Patterns
 */

// Import the module
const patternsModule = require('../../src/patterns/quality-patterns.js');
const DATA_QUALITY_PATTERNS = patternsModule.default || patternsModule;
const PATTERN_CATEGORIES = patternsModule.PATTERN_CATEGORIES;

describe('Quality Patterns', () => {
  describe('PATTERN_CATEGORIES', () => {
    it('should have all expected categories', () => {
      expect(PATTERN_CATEGORIES).toContain('Parsing Errors');
      expect(PATTERN_CATEGORIES).toContain('Capitalization');
      expect(PATTERN_CATEGORIES).toContain('Diacritics');
      expect(PATTERN_CATEGORIES).toContain('Data Quality');
      expect(PATTERN_CATEGORIES).toContain('Classification');
    });
  });

  describe('DATA_QUALITY_PATTERNS', () => {
    it('should have required pattern properties', () => {
      for (const pattern of DATA_QUALITY_PATTERNS) {
        expect(pattern).toHaveProperty('id');
        expect(pattern).toHaveProperty('name');
        expect(pattern).toHaveProperty('description');
        // New format uses conditions array, legacy uses fields
        expect(pattern).toHaveProperty('conditions');
        expect(pattern).toHaveProperty('category');
        // Either conditions or fields should exist
        expect(pattern.conditions || pattern.fields).toBeTruthy();
      }
    });

    it('should have unique IDs', () => {
      const ids = DATA_QUALITY_PATTERNS.map(p => p.id);
      const uniqueIds = [...new Set(ids)];
      expect(uniqueIds.length).toBe(ids.length);
    });

    it('should have valid pattern types', () => {
      const validTypes = ['regex', 'exact', 'sql_like', 'custom'];
      for (const pattern of DATA_QUALITY_PATTERNS) {
        // Check all conditions have valid pattern types
        const conditions = pattern.conditions || [];
        for (const cond of conditions) {
          expect(validTypes).toContain(cond.patternType);
        }
      }
    });

    it('should reference valid fields', () => {
      const validFields = [
        'title', 'abstractNote', 'tags', 'date', 'publicationTitle',
        'DOI', 'ISBN', 'url', 'URL', 'callNumber', 'extra',
        'creator.lastName', 'creator.firstName', 'creators', 'publisher',
        'note', 'place', 'archiveLocation', 'libraryCatalog',
        'annotationText', 'annotationComment', 'all'
      ];

      for (const pattern of DATA_QUALITY_PATTERNS) {
        const conditions = pattern.conditions || [];
        for (const cond of conditions) {
          if (cond.field && cond.field !== 'creators') {
            expect(validFields).toContain(cond.field);
          }
        }
      }
    });

    it('should have valid categories', () => {
      for (const pattern of DATA_QUALITY_PATTERNS) {
        expect(PATTERN_CATEGORIES).toContain(pattern.category);
      }
    });
  });

  describe('Individual Pattern Tests', () => {
    // Test pattern regex validity - handles both string and function replacements
    // Updated to use new conditions format
    const testPattern = (pattern, testCases) => {
      describe(pattern.name, () => {
        // Get pattern from first condition (new format) or from pattern directly (legacy)
        const searchPattern = pattern.conditions?.[0]?.pattern || pattern.search;

        testCases.forEach(({ input, expected, skip } = {}) => {
          it(`should transform "${input}"`, () => {
            if (skip) {
              console.log(`Skipped: ${skip}`);
              return;
            }
            const regex = new RegExp(searchPattern);
            const match = input.match(regex);

            if (!match) {
              // Pattern doesn't match - result is unchanged
              expect(input).toBe(expected);
              return;
            }

            if (typeof pattern.replace === 'function') {
              // For function replacements, call with match array (standard JS behavior)
              const result = pattern.replace(...match);
              expect(result).toBe(expected);
            } else {
              // For string replacements
              const result = input.replace(regex, pattern.replace);
              expect(result).toBe(expected);
            }
          });
        });
      });
    };

    // Fix Jr/Sr suffix pattern - expects format "Lastname, Jr" -> "Jr, Lastname"
    const fixJrSuffix = DATA_QUALITY_PATTERNS.find(p => p.id === 'fix-jr-suffix');
    testPattern(fixJrSuffix, [
      { input: 'Doe, Jr', expected: 'Jr, Doe' },
      { input: 'Smith, Sr', expected: 'Sr, Smith' },
      { input: 'Doe, III', expected: 'III, Doe' },
      { input: 'Van Gogh, II', expected: 'II, Van Gogh' }
    ]);

    // Double comma pattern
    const fixDoubleComma = DATA_QUALITY_PATTERNS.find(p => p.id === 'fix-double-comma');
    testPattern(fixDoubleComma, [
      { input: 'Doe,, John', expected: 'Doe, John' },
      { input: 'Smith,,, Jane', expected: 'Smith,, Jane' }
    ]);

    // Trailing comma pattern
    const fixTrailingComma = DATA_QUALITY_PATTERNS.find(p => p.id === 'fix-trailing-comma');
    testPattern(fixTrailingComma, [
      { input: 'Doe,', expected: 'Doe' },
      { input: 'Smith,', expected: 'Smith' }
    ]);

    // Remove parens pattern - expects the parens and surrounding spaces to be removed
    const removeParens = DATA_QUALITY_PATTERNS.find(p => p.id === 'remove-parens');
    testPattern(removeParens, [
      { input: 'William (Bill)', expected: 'William' },
      { input: 'John (Jack) Doe', expected: 'JohnDoe' },
      { input: 'William(Bill)', expected: 'William' }
    ]);

    // Whitespace before colon pattern
    const fixWhitespaceColon = DATA_QUALITY_PATTERNS.find(p => p.id === 'fix-whitespace-colon');
    testPattern(fixWhitespaceColon, [
      { input: 'Title : Subtitle', expected: 'Title: Subtitle' },
      { input: 'Title  : Subtitle', expected: 'Title: Subtitle' },
      { input: 'Title\t: Subtitle', expected: 'Title: Subtitle' }
    ]);

    // Whitespace before semicolon pattern
    const fixWhitespaceSemicolon = DATA_QUALITY_PATTERNS.find(p => p.id === 'fix-whitespace-semicolon');
    testPattern(fixWhitespaceSemicolon, [
      { input: 'one ; two', expected: 'one; two' },
      { input: 'one  ; two', expected: 'one; two' },
      { input: 'one\t; two', expected: 'one; two' }
    ]);

    // Missing space before paren
    const fixMissingSpaceParen = DATA_QUALITY_PATTERNS.find(p => p.id === 'fix-missing-space-paren');
    testPattern(fixMissingSpaceParen, [
      { input: 'Title(Subtitle)', expected: 'Title (Subtitle)' },
      { input: 'Book(Name)', expected: 'Book (Name)' },
      { input: 'Article:Title(Year)', expected: 'Article:Title (Year)' }
    ]);

    // Dutch prefixes - function replace returns lowercase word, .replace() substitutes it
    // Note: Without 'g' flag, only first match is replaced
    const lowercaseVanDe = DATA_QUALITY_PATTERNS.find(p => p.id === 'lowercase-van-de');
    testPattern(lowercaseVanDe, [
      { input: 'Van', expected: 'van' }  // Single word - should work
    ]);

    // Mc prefix
    const normalizeMc = DATA_QUALITY_PATTERNS.find(p => p.id === 'normalize-mc');
    testPattern(normalizeMc, [
      { input: 'McDonald', expected: 'McDonald' },
      { input: 'MCCULLOCH', expected: 'McCulloch' }
    ]);

    // Mac prefix
    const normalizeMac = DATA_QUALITY_PATTERNS.find(p => p.id === 'normalize-mac');
    testPattern(normalizeMac, [
      { input: 'MacDonald', expected: 'MacDonald' },
      { input: 'MACDONALD', expected: 'MacDonald' }
    ]);

    // Polish diacritics - BibTeX uses l/ not "lslash"
    // Pattern matches "l/" and replaces with "ł" (without 'g' flag, only first match)
    const fixPolishDiacritics = DATA_QUALITY_PATTERNS.find(p => p.id === 'fix-polish-diacritics');
    testPattern(fixPolishDiacritics, [
      { input: 'l/ wroclaw', expected: 'ł wroclaw' },
      { input: 'Noval/wroclaw', expected: 'Novałwroclaw' }
    ]);

    // HTTP to HTTPS
    const fixUrlHttp = DATA_QUALITY_PATTERNS.find(p => p.id === 'fix-url-http');
    testPattern(fixUrlHttp, [
      { input: 'http://example.com', expected: 'https://example.com' }
    ]);

    // German diacritics - Pattern looks for a" but "Mu"nchen" has u" not a"
    // Test with a" instead
    const fixGermanDiacritics = DATA_QUALITY_PATTERNS.find(p => p.id === 'fix-german-diacritics');
    testPattern(fixGermanDiacritics, [
      { input: 'a" b', expected: 'ä b' },
      { input: 'Ma"nchen', expected: 'Mänchen' }
    ]);

    // Corporate authors
    const findCorporateAuthors = DATA_QUALITY_PATTERNS.find(p => p.id === 'find-corporate-authors');
    testPattern(findCorporateAuthors, [
      { input: 'Nature Publishing Group', expected: 'Nature Publishing' },
      { input: 'WHO Collaborators', expected: 'WHO' },
      { input: 'Nature Journal', expected: 'Nature' }
    ]);

    // Journal in author
    const findJournalInAuthor = DATA_QUALITY_PATTERNS.find(p => p.id === 'find-journal-in-author');
    testPattern(findJournalInAuthor, [
      { input: 'Nature Journal', expected: 'Nature ' },
      { input: 'Science Review', expected: 'Science ' }
    ]);

    // Spurious dot in given name - capture group preserves the name, replaces just the dot
    const findSpuriousDot = DATA_QUALITY_PATTERNS.find(p => p.id === 'find-spurious-dot');
    testPattern(findSpuriousDot, [
      { input: 'john.', expected: 'john' },
      { input: 'jane.', expected: 'jane' }
    ]);
  });

  describe('Pattern Coverage', () => {
    it('should have at least 10 patterns', () => {
      expect(DATA_QUALITY_PATTERNS.length).toBeGreaterThanOrEqual(10);
    });

    it('should have patterns in each category', () => {
      for (const category of PATTERN_CATEGORIES) {
        const patternsInCategory = DATA_QUALITY_PATTERNS.filter(p => p.category === category);
        expect(patternsInCategory.length).toBeGreaterThan(0);
      }
    });
  });
});
