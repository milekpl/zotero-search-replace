/**
 * Unit tests for Replace Engine
 */

// Mock Zotero for testing
const mockItem = {
  id: 1,
  key: 'ABC123',
  libraryID: 1,
  getField: jest.fn().mockReturnValue('Test Value'),
  getCreators: jest.fn().mockReturnValue([
    { firstName: 'John', lastName: 'Doe', creatorType: 1 },
    { firstName: 'Jane', lastName: 'Smith', creatorType: 1 }
  ]),
  setField: jest.fn(),
  setCreators: jest.fn(),
  saveTx: jest.fn().mockResolvedValue(true)
};

const mockZotero = {
  Items: {
    getAsync: jest.fn().mockResolvedValue([mockItem])
  },
  debug: jest.fn()
};

global.Zotero = mockZotero;

// Import the module
const replaceEngineModule = require('../../src/zotero/replace-engine.js');
const ReplaceEngine = replaceEngineModule.default || replaceEngineModule;
const ReplaceError = replaceEngineModule.ReplaceError;

describe('ReplaceEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new ReplaceEngine();
    jest.clearAllMocks();
  });

  describe('compileReplacePattern', () => {
    it('should compile replacement pattern with $1 groups', () => {
      const replacer = engine.compileReplacePattern('$1');
      // The function should return $1 when called with capture groups
      expect(replacer('abc', 'a', 'b', 0, 'abc')).toBe('a');
    });

    it('should compile replacement pattern with ${name} groups', () => {
      const replacer = engine.compileReplacePattern('${name}');
      expect(replacer('test', 0, 'test', { name: 'value' })).toBe('value');
    });

    it('should return full match with &', () => {
      const replacer = engine.compileReplacePattern('$&');
      expect(replacer('test')).toBe('test');
    });

    it('should handle simple replacement without placeholders', () => {
      const replacer = engine.compileReplacePattern('Universe');
      expect(replacer('World')).toBe('Universe');
    });
  });

  describe('applyReplace', () => {
    it('should replace text with regex', () => {
      const result = engine.applyReplace('Hello World', 'World', 'Universe', { patternType: 'regex' });
      expect(result.result).toBe('Hello Universe');
      expect(result.replacements).toBe(1);
    });

    it('should handle global replacement', () => {
      const result = engine.applyReplace('foo foo foo', 'foo', 'bar', { patternType: 'regex' });
      expect(result.result).toBe('bar bar bar');
      expect(result.replacements).toBe(3);
    });

    it('should handle case-insensitive replacement', () => {
      const result = engine.applyReplace('Hello HELLO hello', 'hello', 'Hi', { patternType: 'regex', caseSensitive: false });
      expect(result.result).toBe('Hi Hi Hi');
      expect(result.replacements).toBe(3);
    });

    it('should replace exact matches only when the whole value matches', () => {
      const exactMatch = engine.applyReplace('foo', 'foo', 'baz', { patternType: 'exact' });
      expect(exactMatch.result).toBe('baz');
      expect(exactMatch.replacements).toBe(1);

      const noMatch = engine.applyReplace('foo bar foo', 'foo', 'baz', { patternType: 'exact' });
      expect(noMatch.result).toBe('foo bar foo');
      expect(noMatch.replacements).toBe(0);
    });

    it('should treat regex metacharacters literally in exact mode', () => {
      const result = engine.applyReplace('a.c', 'a.c', 'literal', { patternType: 'exact' });
      expect(result.result).toBe('literal');
      expect(result.replacements).toBe(1);

      const noMatch = engine.applyReplace('abc', 'a.c', 'literal', { patternType: 'exact' });
      expect(noMatch.result).toBe('abc');
      expect(noMatch.replacements).toBe(0);
    });

    it('should replace literal substrings in contains mode', () => {
      const result = engine.applyReplace('Hello HELLO hello', 'hello', 'Hi', {
        patternType: 'contains',
        caseSensitive: false
      });
      expect(result.result).toBe('Hi Hi Hi');
      expect(result.replacements).toBe(3);
    });

    it('should treat regex metacharacters literally in contains mode', () => {
      const result = engine.applyReplace('a.c and a.c', 'a.c', 'literal', {
        patternType: 'contains',
        caseSensitive: false
      });
      expect(result.result).toBe('literal and literal');
      expect(result.replacements).toBe(2);
    });

    it('should support named groups and $+ in regex replacements', () => {
      const namedGroupResult = engine.applyReplace(
        'Doe, John',
        '^(?<last>[^,]+), (?<first>.+)$',
        '${first} ${last}',
        { patternType: 'regex' }
      );
      expect(namedGroupResult.result).toBe('John Doe');

      const lastCaptureResult = engine.applyReplace(
        'a-b-c-d',
        '^(a)-(b)-(c)-(d)$',
        '$4:$+',
        { patternType: 'regex' }
      );
      expect(lastCaptureResult.result).toBe('d:d');
    });

    it('should support angle-bracket named groups and special placeholders', () => {
      const namedGroupResult = engine.applyReplace(
        'Doe, John',
        '^(?<last>[^,]+), (?<first>.+)$',
        '$<first> $<last>',
        { patternType: 'regex' }
      );
      expect(namedGroupResult.result).toBe('John Doe');

      const specialPlaceholderResult = engine.applyReplace(
        'abc123def',
        '(123)',
        "[$`][$&][$'][$$]",
        { patternType: 'regex' }
      );
      expect(specialPlaceholderResult.result).toBe('abc[abc][123][def][$]def');
    });

    it('should correctly count replacements for escaped regex characters', () => {
      // Replace literal dots - should count correctly after replacement
      const result = engine.applyReplace('file.txt.file.txt', '\\.', '-', { patternType: 'regex' });
      expect(result.result).toBe('file-txt-file-txt');
      expect(result.replacements).toBe(3);
    });

    it('should count replacements correctly after replace operation', () => {
      // This tests that we count replacements BEFORE doing the replace
      const result = engine.applyReplace('aaa bbb aaa', 'aaa', 'ccc', { patternType: 'regex' });
      expect(result.result).toBe('ccc bbb ccc');
      expect(result.replacements).toBe(2);
    });
  });

  describe('previewReplace', () => {
    it('should return changes for matching fields', () => {
      mockItem.getField.mockReturnValue('Hello World');

      const changes = engine.previewReplace(mockItem, 'World', 'Universe', {
        fields: ['title'],
        patternType: 'regex'
      });

      expect(changes.length).toBe(1);
      expect(changes[0].field).toBe('title');
      expect(changes[0].original).toBe('Hello World');
      expect(changes[0].replaced).toBe('Hello Universe');
    });

    it('should not return changes for non-matching fields', () => {
      mockItem.getField.mockReturnValue('Hello World');

      const changes = engine.previewReplace(mockItem, 'NoMatch', 'Universe', {
        fields: ['title'],
        patternType: 'regex'
      });

      expect(changes.length).toBe(0);
    });

    it('should handle creator field modifications', () => {
      const changes = engine.previewReplace(mockItem, 'John', 'Johnny', {
        fields: ['creator.firstName'],
        patternType: 'regex'
      });

      expect(changes.length).toBe(1);
      expect(changes[0].field).toBe('creator.firstName');
    });

    it('should handle creator full-name modifications for two-field creators', () => {
      const changes = engine.previewReplace(mockItem, 'John Doe', 'Jane Doe', {
        fields: ['creator.fullName'],
        patternType: 'exact'
      });

      expect(changes.length).toBe(1);
      expect(changes[0].field).toBe('creator.fullName');

      const replacedCreators = JSON.parse(changes[0].replaced);
      expect(replacedCreators[0].firstName).toBe('Jane');
      expect(replacedCreators[0].lastName).toBe('Doe');
      expect(replacedCreators[1].firstName).toBe('Jane');
      expect(replacedCreators[1].lastName).toBe('Smith');
    });

    it('should preview multiple replacement conditions across fields', () => {
      mockItem.getField.mockImplementation((field) => {
        if (field === 'title') return 'Hello World';
        if (field === 'url') return 'https://example.com';
        return '';
      });

      const changes = engine.previewReplace(mockItem, [
        { field: 'title', pattern: 'World', patternType: 'regex', caseSensitive: false },
        { field: 'url', pattern: 'example', patternType: 'contains', caseSensitive: false }
      ], 'Replaced');

      expect(changes).toHaveLength(2);
      expect(changes.map((change) => change.field)).toEqual(['title', 'url']);
    });
  });

  describe('applyReplaceToItem', () => {
    it('should save changes to item', async () => {
      mockItem.getField.mockReturnValue('Hello World');

      const result = await engine.applyReplaceToItem(mockItem, 'World', 'Universe', {
        fields: ['title'],
        patternType: 'regex'
      });

      expect(result.success).toBe(true);
      expect(mockItem.setField).toHaveBeenCalledWith('title', 'Hello Universe');
      expect(mockItem.saveTx).toHaveBeenCalled();
    });

    it('should handle no changes needed', async () => {
      mockItem.getField.mockReturnValue('Hello World');

      const result = await engine.applyReplaceToItem(mockItem, 'NoMatch', 'Universe', {
        fields: ['title'],
        patternType: 'regex'
      });

      expect(result.success).toBe(true);
      expect(result.changes).toEqual([]);
      expect(result.message).toBe('No changes needed');
    });
  });

  describe('processItems', () => {
    it('should process multiple items', async () => {
      const items = [
        { ...mockItem, id: 1 },
        { ...mockItem, id: 2 }
      ];
      mockItem.getField.mockImplementation((field) => {
        if (field === 'title') return 'Hello World';
        return '';
      });

      const results = await engine.processItems(items, 'World', 'Universe', {
        fields: ['title'],
        patternType: 'regex'
      });

      expect(results.modified).toBe(2);
      expect(results.skipped).toBe(0);
      expect(results.errors.length).toBe(0);
    });

    it('should count non-matching items as skipped instead of errors', async () => {
      const items = [
        { ...mockItem, id: 1 },
        { ...mockItem, id: 2 }
      ];
      mockItem.getField.mockImplementation((field) => {
        if (field === 'title') return 'Hello World';
        return '';
      });

      const results = await engine.processItems(items, 'NoMatch', 'Universe', {
        fields: ['title'],
        patternType: 'regex'
      });

      expect(results.modified).toBe(0);
      expect(results.skipped).toBe(2);
      expect(results.errors).toEqual([]);
    });
  });
});

describe('ReplaceError', () => {
  it('should create error with code', () => {
    const error = new ReplaceError('Test error', 'INVALID_PATTERN');
    expect(error.name).toBe('ReplaceError');
    expect(error.code).toBe('INVALID_PATTERN');
    expect(error.message).toBe('Test error');
  });
});
