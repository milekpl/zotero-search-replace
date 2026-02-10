/**
 * Unit tests for Search Engine
 */

// Mock Zotero for testing
const mockZotero = {
  Search: jest.fn().mockImplementation(() => ({
    libraryID: 1,
    addCondition: jest.fn(),
    search: jest.fn().mockResolvedValue([1, 2, 3])
  })),
  Items: {
    getAsync: jest.fn().mockResolvedValue([])
  },
  Libraries: {
    userLibraryID: 1
  },
  debug: jest.fn()
};

// Set up mock globals
global.Zotero = mockZotero;

// Import the module
const searchEngineModule = require('../../src/zotero/search-engine.js');
const SearchEngine = searchEngineModule.default || searchEngineModule;
const PATTERN_TYPES = searchEngineModule.PATTERN_TYPES;
const SearchError = searchEngineModule.SearchError;

describe('SearchEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new SearchEngine();
  });

  describe('validatePattern', () => {
    it('should accept valid regex patterns', () => {
      expect(() => engine.validatePattern('test.*pattern', 'regex')).not.toThrow();
    });

    it('should throw SearchError for invalid regex', () => {
      expect(() => engine.validatePattern('[unclosed', 'regex')).toThrow(SearchError);
      expect(() => engine.validatePattern('[unclosed', 'regex')).toThrow('Invalid regex');
    });

    it('should not validate non-regex patterns', () => {
      expect(() => engine.validatePattern('test', 'exact')).not.toThrow();
      expect(() => engine.validatePattern('test', 'sql_like')).not.toThrow();
    });
  });

  describe('regexToSqlLike', () => {
    it('should escape SQL LIKE special characters', () => {
      expect(engine.regexToSqlLike('test')).toBe('%test%');
      expect(engine.regexToSqlLike('test%value')).toBe('%test\\%value%');
      expect(engine.regexToSqlLike('test_value')).toBe('%test\\_value%');
    });
  });

  describe('regexToSqlGlob', () => {
    it('should convert regex to SQL GLOB pattern', () => {
      expect(engine.regexToSqlGlob('test')).toBe('*test*');
      expect(engine.regexToSqlGlob('.*')).toBe('*\\.**');
    });
  });

  describe('buildSearchTerm', () => {
    it('should extract literal substring for simple regex', () => {
      expect(engine.buildSearchTerm('test')).toBe('test');
    });

    it('should remove anchors from pattern', () => {
      expect(engine.buildSearchTerm('^test')).toBe('test');
      expect(engine.buildSearchTerm('test$')).toBe('test');
      expect(engine.buildSearchTerm('^test$')).toBe('test');
    });

    it('should extract literal substring while preserving escapes for Phase 2', () => {
      // For patterns like http://books\.google, extract "books" or "google"
      // The escaped dot is preserved in the original pattern for Phase 2 regex
      const result = engine.buildSearchTerm('http://books\\.google');
      expect(result).toMatch(/^(http|books|google)$/);
    });

    it('should handle optional groups like https?', () => {
      // https? should extract "http" (without the optional 's')
      const result = engine.buildSearchTerm('https?://');
      // Result should be from after removing optional chars, then extracting longest literal
      // After cleanup: http://, so literals are ["http"]
      expect(result).toBe('http');
    });

    it('should handle complex regex with escaped dots', () => {
      // Pattern with escaped dots should extract a literal substring
      const result = engine.buildSearchTerm('http://books\\.google\\.com');
      expect(result.length).toBeGreaterThanOrEqual(4);
      expect(result).toMatch(/^(http|books|google|com)$/);
    });

    it('should extract longest literal from complex pattern', () => {
      // https?://books.google.*$ should extract "google" (longest literal)
      const result = engine.buildSearchTerm('https?://books.google.*$');
      expect(result).toBe('google');
    });
  });

  describe('testValue', () => {
    it('should match regex patterns', () => {
      expect(engine.matches('Hello World', 'World', 'regex', false)).toBe(true);
      expect(engine.matches('Hello World', 'world', 'regex', false)).toBe(true);
      expect(engine.matches('Hello World', 'world', 'regex', true)).toBe(false);
      expect(engine.matches('Hello World', '^Hello', 'regex', false)).toBe(true);
    });

    it('should return match info for regex patterns', () => {
      const result = engine.testValue('Hello World', 'World', 'regex', false);
      expect(result.match).not.toBeNull();
      expect(result.match[0]).toBe('World');
      expect(result.match.index).toBe(6);
    });

    it('should match exact strings (case-insensitive by default)', () => {
      expect(engine.matches('Hello', 'Hello', 'exact', false)).toBe(true);
      expect(engine.matches('Hello', 'hello', 'exact', false)).toBe(true);
      expect(engine.matches('Hello', 'hello', 'exact', true)).toBe(false);
    });

    it('should handle LIKE patterns', () => {
      expect(engine.matches('Hello World', 'Hello', 'sql_like', false)).toBe(true);
      expect(engine.matches('Hello World', '%World', 'sql_like', false)).toBe(true);
    });

    it('should correctly match escaped regex characters like \\.', () => {
      // Escaped dot should match literal dot
      expect(engine.matches('file.txt', '\\.', 'regex', false)).toBe(true);
      expect(engine.matches('file.txt', '\\.', 'regex', true)).toBe(true);
      expect(engine.matches('fileXtxt', '\\.', 'regex', false)).toBe(false);

      // Match info should have correct index and length
      const result = engine.testValue('file.txt', '\\.', 'regex', false);
      expect(result.match).not.toBeNull();
      expect(result.match[0]).toBe('.');
      expect(result.match.index).toBe(4);
      expect(result.match.length).toBe(1);
    });

    it('should match other escaped regex special characters', () => {
      // Escaped parenthesis
      expect(engine.matches('test(value)', '\\(', 'regex', false)).toBe(true);
      expect(engine.matches('test[value]', '\\[', 'regex', false)).toBe(true);
      expect(engine.matches('test|value', '\\|', 'regex', false)).toBe(true);
      expect(engine.matches('test+value', '\\+', 'regex', false)).toBe(true);
      expect(engine.matches('test*value', '\\*', 'regex', false)).toBe(true);
      expect(engine.matches('test?value', '\\?', 'regex', false)).toBe(true);
      expect(engine.matches('test^value', '\\^', 'regex', false)).toBe(true);
      expect(engine.matches('test$value', '\\$', 'regex', false)).toBe(true);
      expect(engine.matches('test{value}', '\\{', 'regex', false)).toBe(true);
      expect(engine.matches('test\\value', '\\\\', 'regex', false)).toBe(true);
    });
  });
});

describe('PATTERN_TYPES', () => {
  it('should have all expected pattern types', () => {
    expect(PATTERN_TYPES.REGEX).toBe('regex');
    expect(PATTERN_TYPES.SQL_LIKE).toBe('sql_like');
    expect(PATTERN_TYPES.SQL_GLOB).toBe('sql_glob');
    expect(PATTERN_TYPES.EXACT).toBe('exact');
  });
});
