/**
 * Replace Engine for Zotero Search & Replace Plugin
 * Handles pattern replacement with support for capture groups and creator field modifications
 */

// Placeholder patterns: $1, ${name}, $<name>, $&, $', $`, $$, $+
const PLACEHOLDER_PATTERN = /\$(\d+)|\$\{([^}]+)\}|\$<([^>]+)>|(\$\$|\$&|\$'|\$`|\$\+)/g;

export class ReplaceError extends Error {
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
    if (typeof pattern === 'function') {
      return pattern;
    }

    if (typeof pattern !== 'string' || !pattern.includes('$')) {
      return () => pattern;
    }

    return (match, ...args) => {
      let groups;
      if (args.length > 0) {
        const maybeGroups = args.at(-1);
        if (maybeGroups && typeof maybeGroups === 'object' && !Array.isArray(maybeGroups)) {
          groups = args.pop();
        }
      }

      const input = args.pop() || '';
      const offset = args.pop() || 0;
      const captures = args;
      const lastCapture = [...captures].reverse().find((capture) => capture !== undefined) || '';

      return pattern.replace(this.placeholderPattern, (token, numericGroup, braceName, angleName, specialToken) => {
        if (numericGroup) {
          return captures[Number.parseInt(numericGroup, 10) - 1] || '';
        }

        const groupName = braceName || angleName;
        if (groupName) {
          return groups && groupName in groups ? (groups[groupName] || '') : '';
        }

        switch (specialToken) {
          case '$$':
            return '$';
          case '$&':
            return match;
          case "$'":
            return input.slice(offset + match.length);
          case '$`':
            return input.slice(0, offset);
          case '$+':
            return lastCapture;
          default:
            return token;
        }
      });
    };
  }

  escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  }

  countMatches(regex, value) {
    const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`;
    const countingRegex = new RegExp(regex.source, flags);
    let count = 0;
    let match = countingRegex.exec(value);

    while (match) {
      count += 1;
      if (match[0] === '') {
        countingRegex.lastIndex += 1;
      }
      match = countingRegex.exec(value);
    }

    return count;
  }

  applyRegexPattern(value, regex, replacePattern) {
    const replacements = this.countMatches(regex, value);
    if (replacements === 0) {
      return { result: value, replacements: 0 };
    }

    return {
      result: value.replace(regex, this.compileReplacePattern(replacePattern)),
      replacements
    };
  }

  normalizeConditions(searchPatternOrConditions, options = {}) {
    if (Array.isArray(searchPatternOrConditions)) {
      return searchPatternOrConditions
        .filter((condition) => condition?.field && condition.pattern !== undefined)
        .map((condition) => ({
          field: condition.field,
          pattern: condition.pattern,
          patternType: condition.patternType || options.patternType || 'regex',
          caseSensitive: condition.caseSensitive || false
        }));
    }

    const { fields = [], patternType = 'regex', caseSensitive = false } = options;
    return fields
      .filter(Boolean)
      .map((field) => ({ field, pattern: searchPatternOrConditions, patternType, caseSensitive }));
  }

  joinCreatorNameParts(firstName, lastName) {
    return [firstName, lastName]
      .filter((part) => part != null && String(part).trim() !== '')
      .map((part) => String(part).trim())
      .join(' ');
  }

  getCreatorFullName(creator) {
    if (!creator) {
      return '';
    }

    const singleFieldName = creator.name == null ? '' : String(creator.name).trim();
    if (singleFieldName) {
      return singleFieldName;
    }

    return this.joinCreatorNameParts(creator.firstName, creator.lastName);
  }

  splitCreatorFullName(value, creator) {
    const trimmedValue = value == null ? '' : String(value).trim();
    if (!trimmedValue) {
      return { firstName: '', lastName: '' };
    }

    const commaIndex = trimmedValue.indexOf(',');
    if (commaIndex !== -1) {
      return {
        lastName: trimmedValue.slice(0, commaIndex).trim(),
        firstName: trimmedValue.slice(commaIndex + 1).trim()
      };
    }

    const originalFirst = creator.firstName == null ? '' : String(creator.firstName).trim();
    const originalLast = creator.lastName == null ? '' : String(creator.lastName).trim();

    if (originalLast && trimmedValue.endsWith(originalLast)) {
      return {
        firstName: trimmedValue.slice(0, trimmedValue.length - originalLast.length).trim(),
        lastName: originalLast
      };
    }

    if (originalFirst && trimmedValue.startsWith(originalFirst)) {
      return {
        firstName: originalFirst,
        lastName: trimmedValue.slice(originalFirst.length).trim()
      };
    }

    const words = trimmedValue.split(/\s+/);
    const lastNameWordCount = Math.max(1, originalLast ? originalLast.split(/\s+/).length : 1);
    if (words.length > lastNameWordCount) {
      return {
        firstName: words.slice(0, words.length - lastNameWordCount).join(' '),
        lastName: words.slice(words.length - lastNameWordCount).join(' ')
      };
    }

    return { firstName: '', lastName: trimmedValue };
  }

  applyReplaceToCreatorFullName(creator, fieldConditions, replacePattern) {
    const originalFullName = this.getCreatorFullName(creator);
    const { result, replacements } = this.applyConditionsToValue(originalFullName, fieldConditions, replacePattern);
    if (replacements === 0 || result === originalFullName) {
      return false;
    }

    const singleFieldName = creator.name == null ? '' : String(creator.name).trim();
    const originalFirst = creator.firstName == null ? '' : String(creator.firstName);
    const originalLast = creator.lastName == null ? '' : String(creator.lastName);

    if (singleFieldName && !originalFirst.trim() && !originalLast.trim()) {
      creator.name = result;
      return true;
    }

    const { result: replacedFirst } = this.applyConditionsToValue(originalFirst, fieldConditions, replacePattern);
    const { result: replacedLast } = this.applyConditionsToValue(originalLast, fieldConditions, replacePattern);
    if (this.joinCreatorNameParts(replacedFirst, replacedLast) === result) {
      creator.firstName = replacedFirst;
      creator.lastName = replacedLast;
      return true;
    }

    const splitName = this.splitCreatorFullName(result, creator);
    creator.firstName = splitName.firstName;
    creator.lastName = splitName.lastName;
    return true;
  }

  applyConditionsToValue(value, conditions, replacePattern) {
    let result = value == null ? '' : String(value);
    let replacements = 0;

    for (const condition of conditions) {
      const applyResult = this.applyReplace(result, condition.pattern, replacePattern, condition);
      result = applyResult.result;
      replacements += applyResult.replacements;
    }

    return { result, replacements };
  }

  previewCreatorField(item, field, fieldConditions, replacePattern) {
    const creators = item.getCreators();
    if (!creators) {
      return null;
    }

    const modifiedCreators = creators.map((creator) => ({ ...creator }));
    let changed = false;
    const creatorField = field.split('.')[1];

    for (const creator of modifiedCreators) {
      if (creatorField === 'fullName') {
        if (this.applyReplaceToCreatorFullName(creator, fieldConditions, replacePattern)) {
          changed = true;
        }
        continue;
      }

      const value = creator[creatorField];
      const originalValue = value == null ? '' : String(value);
      const { result, replacements } = this.applyConditionsToValue(originalValue, fieldConditions, replacePattern);

      if (replacements > 0 && result !== originalValue) {
        creator[creatorField] = result;
        changed = true;
      }
    }

    if (!changed) {
      return null;
    }

    return {
      field,
      original: JSON.stringify(creators),
      replaced: JSON.stringify(modifiedCreators)
    };
  }

  previewStandardField(item, field, fieldConditions, replacePattern) {
    const original = item.getField(field);
    const originalValue = original == null ? '' : String(original);
    const { result, replacements } = this.applyConditionsToValue(originalValue, fieldConditions, replacePattern);

    if (replacements === 0 || result === originalValue) {
      return null;
    }

    return { field, original: originalValue, replaced: result };
  }

  // Apply replace to a single value
  applyReplace(value, searchPattern, replacePattern, options = {}) {
    const { patternType = 'regex', caseSensitive = false } = options;
    const str = value == null ? '' : String(value);

    if (patternType === 'regex') {
      return this.applyRegexPattern(str, new RegExp(searchPattern, caseSensitive ? 'g' : 'gi'), replacePattern);
    }

    if (patternType === 'exact') {
      const exactRegex = new RegExp(`^${this.escapeRegExp(searchPattern)}$`, caseSensitive ? '' : 'i');
      return this.applyRegexPattern(str, exactRegex, replacePattern);
    }

    const literalRegex = new RegExp(this.escapeRegExp(searchPattern), caseSensitive ? 'g' : 'gi');
    return this.applyRegexPattern(str, literalRegex, replacePattern);
  }

  // Preview replace on an item (no save)
  previewReplace(item, searchPatternOrConditions, replacePattern, options = {}) {
    const conditions = this.normalizeConditions(searchPatternOrConditions, options);
    const changes = [];
    const conditionsByField = new Map();

    for (const condition of conditions) {
      if (!conditionsByField.has(condition.field)) {
        conditionsByField.set(condition.field, []);
      }
      conditionsByField.get(condition.field).push(condition);
    }

    for (const [field, fieldConditions] of conditionsByField.entries()) {
      const change = field.startsWith('creator.')
        ? this.previewCreatorField(item, field, fieldConditions, replacePattern)
        : this.previewStandardField(item, field, fieldConditions, replacePattern);

      if (change) {
        changes.push(change);
      }
    }

    return changes;
  }

  // Apply replace to item (with save)
  async applyReplaceToItem(item, searchPatternOrConditions, replacePattern, options = {}) {
    const { progressCallback = () => { } } = options;

    const changes = this.previewReplace(item, searchPatternOrConditions, replacePattern, options);
    if (changes.length === 0) {
      return { success: true, changes: [], message: 'No changes needed' };
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
  async processItems(items, searchPatternOrConditions, replacePattern, options = {}) {
    const { progressCallback = () => { } } = options;
    const results = {
      modified: 0,
      skipped: 0,
      errors: []
    };

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      progressCallback({ current: i + 1, total: items.length, itemID: item.id });

      try {
        const result = await this.applyReplaceToItem(item, searchPatternOrConditions, replacePattern, options);

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

export default ReplaceEngine;
