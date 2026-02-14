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
      // Full string match
      expect(engine.matches('Hello', 'Hello', 'exact', false)).toBe(true);
      expect(engine.matches('Hello', 'hello', 'exact', false)).toBe(true);
      expect(engine.matches('Hello', 'hello', 'exact', true)).toBe(false);
    });

    it('should find substring in contains mode', () => {
      // Partial match - ' :' should be found in longer string using CONTAINS
      expect(engine.matches('Book Title : Subtitle', ' :', 'contains', false)).toBe(true);
      expect(engine.matches('Hello World', 'World', 'contains', false)).toBe(true);
      expect(engine.matches('Hello World', 'world', 'contains', false)).toBe(true);
      // Not found
      expect(engine.matches('Hello World', 'xyz', 'contains', false)).toBe(false);
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

    it('should correctly handle exact match with case insensitive', () => {
      // Test exact match returns full string on equality
      const result = engine.testValue('Warszawa', 'warszawa', 'exact', false);
      expect(result.match).not.toBeNull();
      expect(result.match).toBe('Warszawa'); // Returns the full string on exact match
      expect(result.regex).toBeNull();
    });

    it('should correctly handle contains match with case insensitive', () => {
      // Test contains match returns the pattern when found
      const result = engine.testValue('Warszawa', 'warszawa', 'contains', false);
      expect(result.match).not.toBeNull();
      expect(result.match).toBe('warszawa'); // Returns the pattern for contains
      expect(result.regex).toBeNull();
    });
  });

  describe('evaluateConditions', () => {
    // Create a mock item with title and url fields
    const createMockItem = (title, url) => ({
      id: 1,
      key: 'ABC123',
      libraryID: 1,
      getField: jest.fn((field) => {
        if (field === 'title') return title;
        if (field === 'url') return url;
        return null;
      }),
      getCreators: jest.fn().mockReturnValue([]),
      getTags: jest.fn().mockReturnValue([])
    });

    it('should match single condition', () => {
      const item = createMockItem('Hello World', 'https://example.com');
      const conditions = [{
        pattern: 'World',
        field: 'title',
        patternType: 'regex',
        caseSensitive: false,
        operator: 'AND'
      }];
      const result = engine.evaluateConditions(item, conditions);
      expect(result.matched).toBe(true);
    });

    it('should match AND - both conditions must match', () => {
      const item = createMockItem('Hello World', 'https://example.com');
      const conditions = [
        { pattern: 'Hello', field: 'title', patternType: 'regex', caseSensitive: false, operator: 'AND' },
        { pattern: 'example', field: 'url', patternType: 'regex', caseSensitive: false, operator: 'AND' }
      ];
      const result = engine.evaluateConditions(item, conditions);
      expect(result.matched).toBe(true);
    });

    it('should NOT match AND - one condition fails', () => {
      const item = createMockItem('Hello World', 'https://example.com');
      const conditions = [
        { pattern: 'Hello', field: 'title', patternType: 'regex', caseSensitive: false, operator: 'AND' },
        { pattern: 'missing', field: 'url', patternType: 'regex', caseSensitive: false, operator: 'AND' }
      ];
      const result = engine.evaluateConditions(item, conditions);
      expect(result.matched).toBe(false);
    });

    it('should match OR - at least one condition must match', () => {
      const item = createMockItem('Hello World', 'https://example.com');
      const conditions = [
        { pattern: 'missing', field: 'title', patternType: 'regex', caseSensitive: false, operator: 'OR' },
        { pattern: 'example', field: 'url', patternType: 'regex', caseSensitive: false, operator: 'OR' }
      ];
      const result = engine.evaluateConditions(item, conditions);
      expect(result.matched).toBe(true);
    });

    it('should NOT match OR - no conditions match', () => {
      const item = createMockItem('Hello World', 'https://example.com');
      const conditions = [
        { pattern: 'notfound', field: 'title', patternType: 'regex', caseSensitive: false, operator: 'OR' },
        { pattern: 'notfound', field: 'url', patternType: 'regex', caseSensitive: false, operator: 'OR' }
      ];
      const result = engine.evaluateConditions(item, conditions);
      expect(result.matched).toBe(false);
    });

    it('should match AND NOT - positive matches, negative does not match', () => {
      const item = createMockItem('Hello World', 'https://example.com');
      const conditions = [
        { pattern: 'World', field: 'title', patternType: 'regex', caseSensitive: false, operator: 'AND' },
        { pattern: 'missing', field: 'url', patternType: 'regex', caseSensitive: false, operator: 'AND_NOT' }
      ];
      const result = engine.evaluateConditions(item, conditions);
      expect(result.matched).toBe(true);
    });

    it('should NOT match AND NOT - positive matches but negative also matches', () => {
      const item = createMockItem('Hello World', 'https://example.com');
      const conditions = [
        { pattern: 'World', field: 'title', patternType: 'regex', caseSensitive: false, operator: 'AND' },
        { pattern: 'example', field: 'url', patternType: 'regex', caseSensitive: false, operator: 'AND_NOT' }
      ];
      const result = engine.evaluateConditions(item, conditions);
      expect(result.matched).toBe(false);
    });

    it('should NOT match AND - first condition fails', () => {
      const item = createMockItem('Hello World', 'https://example.com');
      const conditions = [
        { pattern: 'NotThere', field: 'title', patternType: 'regex', caseSensitive: false, operator: 'AND' },
        { pattern: 'example', field: 'url', patternType: 'regex', caseSensitive: false, operator: 'AND' }
      ];
      const result = engine.evaluateConditions(item, conditions);
      expect(result.matched).toBe(false);
    });

    it('should handle implicit AND operator for first condition', () => {
      const item = createMockItem('Hello World', 'https://example.com');
      const conditions = [
        { pattern: 'Hello', field: 'title', patternType: 'regex', caseSensitive: false },
        { pattern: 'example', field: 'url', patternType: 'regex', caseSensitive: false }
      ];
      const result = engine.evaluateConditions(item, conditions);
      expect(result.matched).toBe(true);
    });
  });

  describe('search method with exact match', () => {
    it('should find items with exact match in title field', async () => {
      const mockItem = {
        id: 1,
        key: 'ABC123',
        libraryID: 1,
        getField: jest.fn().mockReturnValue('Hello : World'),
        getCreators: jest.fn().mockReturnValue([]),
        getTags: jest.fn().mockReturnValue([])
      };

      // Mock getAsync to return our test item
      mockZotero.Items.getAsync = jest.fn().mockResolvedValue([mockItem]);

      // Mock search to return all items (skipPhase1)
      mockZotero.Search = jest.fn().mockImplementation(() => ({
        libraryID: 1,
        addCondition: jest.fn(),
        search: jest.fn().mockResolvedValue([1])
      }));

      const engine = new SearchEngine();
      const results = await engine.search('Hello : World', {
        fields: ['title'],
        patternType: 'exact',
        caseSensitive: false
      });

      expect(results.length).toBe(1);
      expect(mockItem.getField).toHaveBeenCalledWith('title');
      expect(results[0].matchedFields).toContain('title');
    });

    it('should find items with exact match pattern in many fields', async () => {
      const mockItem = {
        id: 1,
        key: 'ABC123',
        libraryID: 1,
        getField: jest.fn().mockImplementation((field) => {
          if (field === 'title') return 'Test : Value';
          if (field === 'abstractNote') return '';
          return '';
        }),
        getCreators: jest.fn().mockReturnValue([]),
        getTags: jest.fn().mockReturnValue([])
      };

      mockZotero.Items.getAsync = jest.fn().mockResolvedValue([mockItem]);
      mockZotero.Search = jest.fn().mockImplementation(() => ({
        libraryID: 1,
        addCondition: jest.fn(),
        search: jest.fn().mockResolvedValue([1])
      }));

      const engine = new SearchEngine();
      const results = await engine.search('Test : Value', {
        fields: ['title', 'abstractNote', 'publicationTitle'],
        patternType: 'exact',
        caseSensitive: false
      });

      expect(results.length).toBe(1);
      expect(results[0].matchedFields).toContain('title');
    });

    it('should match contains pattern with space and special character', async () => {
      const mockItem = {
        id: 1,
        key: 'ABC123',
        libraryID: 1,
        getField: jest.fn().mockReturnValue('Book Title : Subtitle'),
        getCreators: jest.fn().mockReturnValue([]),
        getTags: jest.fn().mockReturnValue([])
      };

      mockZotero.Items.getAsync = jest.fn().mockResolvedValue([mockItem]);
      mockZotero.Search = jest.fn().mockImplementation(() => ({
        libraryID: 1,
        addCondition: jest.fn(),
        search: jest.fn().mockResolvedValue([1])
      }));

      const engine = new SearchEngine();
      const results = await engine.search(' :', {
        fields: ['title'],
        patternType: 'contains',
        caseSensitive: false
      });

      // This test verifies ' :' contains match works in title field
      expect(results.length).toBe(1);
      expect(mockItem.getField).toHaveBeenCalledWith('title');
      expect(results[0].matchedFields).toContain('title');
    });

    it('should NOT match regex metacharacters in exact match mode', async () => {
      const mockItem = {
        id: 1,
        key: 'ABC123',
        libraryID: 1,
        getField: jest.fn().mockReturnValue('Test Value'),
        getCreators: jest.fn().mockReturnValue([]),
        getTags: jest.fn().mockReturnValue([])
      };

      mockZotero.Items.getAsync = jest.fn().mockResolvedValue([mockItem]);
      mockZotero.Search = jest.fn().mockImplementation(() => ({
        libraryID: 1,
        addCondition: jest.fn(),
        search: jest.fn().mockResolvedValue([1])
      }));

      const engine = new SearchEngine();

      // '.*' in exact match should NOT match 'Test Value'
      // because exact match treats the pattern as literal text, not regex
      const results = await engine.search('.*', {
        fields: ['title'],
        patternType: 'exact',
        caseSensitive: false
      });

      expect(results.length).toBe(0);
    });

    it('should match empty fields with ^$ pattern', async () => {
      const mockItem = {
        id: 1,
        key: 'ABC123',
        libraryID: 1,
        getField: jest.fn().mockImplementation((field) => {
          if (field === 'title') return '';
          if (field === 'abstractNote') return 'Some abstract';
          return '';
        }),
        getCreators: jest.fn().mockReturnValue([]),
        getTags: jest.fn().mockReturnValue([])
      };

      mockZotero.Items.getAsync = jest.fn().mockResolvedValue([mockItem]);
      mockZotero.Search = jest.fn().mockImplementation(() => ({
        libraryID: 1,
        addCondition: jest.fn(),
        search: jest.fn().mockResolvedValue([1])
      }));

      const engine = new SearchEngine();

      // ^$ should match empty title field
      const results = await engine.search('^$', {
        fields: ['title', 'abstractNote'],
        patternType: 'regex',
        caseSensitive: false
      });

      expect(results.length).toBe(1);
      expect(results[0].matchedFields).toContain('title');
      expect(results[0].matchedFields).not.toContain('abstractNote');
      expect(results[0].matchDetails).toHaveLength(1);
      expect(results[0].matchDetails[0].field).toBe('title');
      expect(results[0].matchDetails[0].value).toBe('');
    });

    it('should NOT match non-empty fields with ^$ pattern', async () => {
      const mockItem = {
        id: 1,
        key: 'ABC123',
        libraryID: 1,
        getField: jest.fn().mockImplementation((field) => {
          if (field === 'title') return 'Not Empty';
          return '';
        }),
        getCreators: jest.fn().mockReturnValue([]),
        getTags: jest.fn().mockReturnValue([])
      };

      mockZotero.Items.getAsync = jest.fn().mockResolvedValue([mockItem]);
      mockZotero.Search = jest.fn().mockImplementation(() => ({
        libraryID: 1,
        addCondition: jest.fn(),
        search: jest.fn().mockResolvedValue([1])
      }));

      const engine = new SearchEngine();

      // ^$ should NOT match non-empty title field
      const results = await engine.search('^$', {
        fields: ['title'],
        patternType: 'regex',
        caseSensitive: false
      });

      expect(results.length).toBe(0);
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

describe('SearchEngine field matching', () => {
  let engine;
  let mockZotero;

  beforeEach(() => {
    // Create fresh mock for each test
    mockZotero = {
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
    global.Zotero = mockZotero;
    engine = new SearchEngine();
  });

  describe('matches method - field value retrieval', () => {
    it('should match itemType field with string value', () => {
      // itemType returns string like "journalArticle", "book", etc.
      expect(engine.matches('journalArticle', 'journalArticle', 'exact', false)).toBe(true);
      expect(engine.matches('journalArticle', 'book', 'exact', false)).toBe(false);
      expect(engine.matches('journalArticle', 'journal', 'contains', false)).toBe(true);
    });

    it('should match DOI field', () => {
      expect(engine.matches('10.1234/test', '10.1234', 'contains', false)).toBe(true);
      expect(engine.matches('10.1234/test', '10.5678', 'exact', false)).toBe(false);
    });

    it('should match ISBN field', () => {
      expect(engine.matches('978-0-123456-78-9', '978', 'contains', false)).toBe(true);
      expect(engine.matches('9780123456789', '0123456789', 'contains', false)).toBe(true);
    });

    it('should match URL field', () => {
      expect(engine.matches('https://example.com/article', 'example.com', 'contains', false)).toBe(true);
      expect(engine.matches('https://books.google.com/book', 'books.google.com', 'contains', false)).toBe(true);
      expect(engine.matches('http://test.org', 'https://', 'contains', false)).toBe(false);
    });

    it('should match date fields', () => {
      expect(engine.matches('2024-01-15', '2024', 'contains', false)).toBe(true);
      expect(engine.matches('January 15, 2024', '2024', 'contains', false)).toBe(true);
    });

    it('should match extra field', () => {
      expect(engine.matches('custom field: value', 'custom field', 'contains', false)).toBe(true);
      expect(engine.matches('custom:abc', 'abc', 'contains', false)).toBe(true);
    });

    it('should match publicationTitle field', () => {
      expect(engine.matches('Nature Journal', 'Nature', 'contains', false)).toBe(true);
      expect(engine.matches('Journal of Testing', 'journal', 'contains', false)).toBe(true);
    });

    it('should match publisher field', () => {
      expect(engine.matches('Springer Verlag', 'Springer', 'contains', false)).toBe(true);
      expect(engine.matches('Oxford University Press', 'Oxford', 'contains', false)).toBe(true);
    });

    it('should handle empty/null fields gracefully', () => {
      expect(engine.matches('', 'test', 'contains', false)).toBe(false);
      expect(engine.matches(null, 'test', 'contains', false)).toBe(false);
      expect(engine.matches(undefined, 'test', 'contains', false)).toBe(false);
    });
  });

  describe('testValue method - match info', () => {
    it('should return match info for itemType', () => {
      const result = engine.testValue('journalArticle', 'journal', 'contains', false);
      expect(result.match).toBe('journal');
      expect(result.regex).toBeNull();
    });

    it('should return match info for DOI', () => {
      const result = engine.testValue('10.1234/test', '10.1234', 'contains', false);
      expect(result.match).toBe('10.1234');
      expect(result.regex).toBeNull();
    });

    it('should return match info for URL', () => {
      const result = engine.testValue('https://example.com/path', 'example.com', 'contains', false);
      expect(result.match).toBe('example.com');
    });
  });

  describe('realistic item matching scenarios', () => {
    it('should match journal article by various fields', async () => {
      const mockItem = {
        id: 1,
        key: 'ABC123',
        libraryID: 1,
        getField: jest.fn().mockImplementation((field) => {
          const fields = {
            'title': 'Machine Learning Applications',
            'abstractNote': 'This paper discusses ML in detail.',
            'DOI': '10.1234/science.2024',
            'url': 'https://example.com/article',
            'publicationTitle': 'Science Journal',
            'itemType': 'journalArticle'
          };
          return fields[field] || null;
        }),
        getCreators: jest.fn().mockReturnValue([]),
        getTags: jest.fn().mockReturnValue([])
      };

      mockZotero.Items.getAsync = jest.fn().mockResolvedValue([mockItem]);
      mockZotero.Search = jest.fn().mockImplementation(() => ({
        libraryID: 1,
        addCondition: jest.fn(),
        search: jest.fn().mockResolvedValue([1])
      }));

      const engine = new SearchEngine();

      // Search in title
      let results = await engine.search('machine', {
        fields: ['title'],
        patternType: 'contains',
        caseSensitive: false
      });
      expect(results.length).toBe(1);
      expect(results[0].matchedFields).toContain('title');

      // Search in DOI
      results = await engine.search('10.1234', {
        fields: ['DOI'],
        patternType: 'contains',
        caseSensitive: false
      });
      expect(results.length).toBe(1);
      expect(results[0].matchedFields).toContain('DOI');

      // Search in itemType
      results = await engine.search('journal', {
        fields: ['itemType'],
        patternType: 'contains',
        caseSensitive: false
      });
      expect(results.length).toBe(1);
      expect(results[0].matchedFields).toContain('itemType');

      // Search in URL
      results = await engine.search('example', {
        fields: ['url'],
        patternType: 'contains',
        caseSensitive: false
      });
      expect(results.length).toBe(1);
      expect(results[0].matchedFields).toContain('url');
    });

    it('should match book by ISBN and publisher', async () => {
      const mockItem = {
        id: 2,
        key: 'DEF456',
        libraryID: 1,
        getField: jest.fn().mockImplementation((field) => {
          const fields = {
            'title': 'The Great Book',
            'ISBN': '978-0-123456-78-9',
            'publisher': 'Penguin Books',
            'itemType': 'book'
          };
          return fields[field] || null;
        }),
        getCreators: jest.fn().mockReturnValue([]),
        getTags: jest.fn().mockReturnValue([])
      };

      mockZotero.Items.getAsync = jest.fn().mockResolvedValue([mockItem]);
      mockZotero.Search = jest.fn().mockImplementation(() => ({
        libraryID: 1,
        addCondition: jest.fn(),
        search: jest.fn().mockResolvedValue([2])
      }));

      const engine = new SearchEngine();

      // Search by ISBN
      let results = await engine.search('978', {
        fields: ['ISBN'],
        patternType: 'contains',
        caseSensitive: false
      });
      expect(results.length).toBe(1);
      expect(results[0].matchedFields).toContain('ISBN');

      // Search by publisher
      results = await engine.search('Penguin', {
        fields: ['publisher'],
        patternType: 'contains',
        caseSensitive: false
      });
      expect(results.length).toBe(1);
      expect(results[0].matchedFields).toContain('publisher');

      // Search by itemType
      results = await engine.search('book', {
        fields: ['itemType'],
        patternType: 'exact',
        caseSensitive: false
      });
      expect(results.length).toBe(1);
      expect(results[0].matchedFields).toContain('itemType');
    });
  });
});
