/**
 * Unit tests for dialog controller helpers.
 */

describe('dialog-controller helpers', () => {
  let helpers;

  beforeAll(() => {
    globalThis.document = {
      addEventListener: jest.fn()
    };

    helpers = require('../../content/scripts/dialog-controller.js');
  });

  afterAll(() => {
    delete globalThis.document;
  });

  it('builds replacement conditions only from positive matching fields', () => {
    const conditions = [
      { field: 'title', pattern: 'alpha', patternType: 'regex', caseSensitive: false, operator: 'AND' },
      { field: 'url', pattern: 'example', patternType: 'contains', caseSensitive: false, operator: 'OR' },
      { field: 'extra', pattern: 'skip', patternType: 'regex', caseSensitive: false, operator: 'AND_NOT' }
    ];

    const replaceConditions = helpers.buildReplaceConditions(conditions, ['title', 'url', 'extra']);

    expect(replaceConditions).toEqual([
      { field: 'title', pattern: 'alpha', patternType: 'regex', caseSensitive: false },
      { field: 'url', pattern: 'example', patternType: 'contains', caseSensitive: false }
    ]);
  });

  it('expands all-field conditions to the actual target fields', () => {
    const conditions = [
      { field: 'all', pattern: String.raw`\s+:`, patternType: 'regex', caseSensitive: false, operator: 'AND' }
    ];

    const replaceConditions = helpers.buildReplaceConditions(conditions, ['title', 'publisher']);

    expect(replaceConditions).toEqual([
      { field: 'title', pattern: String.raw`\s+:`, patternType: 'regex', caseSensitive: false },
      { field: 'publisher', pattern: String.raw`\s+:`, patternType: 'regex', caseSensitive: false }
    ]);
  });

  it('prefers the live replace input value over stale string state', () => {
    const replacePattern = helpers.getDialogReplacePattern(
      { replacePattern: '' },
      { value: 'Chyjewicz' }
    );

    expect(replacePattern).toBe('Chyjewicz');
  });

  it('preserves function-based preset replacements', () => {
    const replaceFn = () => 'computed';
    const replacePattern = helpers.getDialogReplacePattern(
      { replacePattern: replaceFn },
      { value: 'typed text' }
    );

    expect(replacePattern).toBe(replaceFn);
  });
});