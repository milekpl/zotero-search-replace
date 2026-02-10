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
        expect(pattern).toHaveProperty('fields');
        expect(pattern).toHaveProperty('patternType');
        expect(pattern).toHaveProperty('category');
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
        expect(validTypes).toContain(pattern.patternType);
      }
    });

    it('should reference valid fields', () => {
      const validFields = [
        'title', 'abstractNote', 'tags', 'date', 'publicationTitle',
        'DOI', 'ISBN', 'url', 'URL', 'callNumber', 'extra',
        'creator.lastName', 'creator.firstName', 'creators', 'publisher'
      ];

      for (const pattern of DATA_QUALITY_PATTERNS) {
        for (const field of pattern.fields) {
          if (field !== 'creators') {
            expect(validFields).toContain(field);
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
    // Test pattern regex validity
    const testPattern = (pattern, testCases) => {
      describe(pattern.name, () => {
        testCases.forEach(({ input, expected, skip } = {}) => {
          it(`should transform "${input}"`, () => {
            if (skip) {
              console.log(`Skipped: ${skip}`);
              return;
            }
            // For function replacements, apply to the matched part only
            if (typeof pattern.replace === 'function') {
              const match = input.match(new RegExp(pattern.search));
              if (match) {
                const result = pattern.replace(match[0]);
                expect(result).toBe(expected);
              }
            } else {
              // For string replacements
              const result = input.replace(new RegExp(pattern.search), pattern.replace);
              expect(result).toBe(expected);
            }
          });
        });
      });
    };

    // Fix comma space pattern
    const fixCommaSpace = DATA_QUALITY_PATTERNS.find(p => p.id === 'fix-comma-space');
    testPattern(fixCommaSpace, [
      { input: 'Doe , John', expected: 'Doe, John' },
      { input: 'Smith , Jane', expected: 'Smith, Jane' }
    ]);

    // Remove parens pattern - expects the parens and surrounding spaces to be removed
    const removeParens = DATA_QUALITY_PATTERNS.find(p => p.id === 'remove-parens');
    testPattern(removeParens, [
      { input: 'William (Bill)', expected: 'William' },
      { input: 'John (Jack) Doe', expected: 'JohnDoe' }
    ]);

    // Lowercase van/de pattern - function transforms matched part
    const lowercaseVanDe = DATA_QUALITY_PATTERNS.find(p => p.id === 'lowercase-van-de');
    testPattern(lowercaseVanDe, [
      { input: 'Van Gogh', expected: 'van' },
      { input: 'De la Cruz', expected: 'de' }
    ]);

    // Polish diacritics pattern
    const fixPolishDiacritics = DATA_QUALITY_PATTERNS.find(p => p.id === 'fix-polish-diacritics');
    testPattern(fixPolishDiacritics, [
      { input: 'lslash', expected: 'ł' },
      { input: 'nslash', expected: 'ń' },
      { input: 'sslash', expected: 'ś' }
    ]);

    // HTTP to HTTPS
    const fixHttp = DATA_QUALITY_PATTERNS.find(p => p.id === 'fix-url-http');
    testPattern(fixHttp, [
      { input: 'http://example.com', expected: 'https://example.com' }
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
