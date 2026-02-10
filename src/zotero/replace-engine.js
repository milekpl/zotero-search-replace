/**
 * Replace Engine for Zotero Search & Replace Plugin
 * Handles pattern replacement with support for capture groups and creator field modifications
 */

// Placeholder patterns: $1, $2, ${name}, $&, $', $`, $+
const PLACEHOLDER_PATTERN = /\$(\d+)|\$\{([^}]+)\}|(\$&|\$\'|\$\`|\$\+)/g;

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
    // If pattern is already a function, use it directly
    if (typeof pattern === 'function') {
      return pattern;
    }

    // Check if pattern contains any placeholders: $1, ${name}, $&, $', $+
    // Use simple string includes instead of regex to avoid escape issues
    const hasNumericPlaceholder = /\$(\d+)/.test(pattern);
    const hasNamedPlaceholder = pattern.includes('${');
    const hasSpecialPlaceholder = /\$&|\$\'|\$\+/.test(pattern);

    if (!hasNumericPlaceholder && !hasNamedPlaceholder && !hasSpecialPlaceholder) {
      // No placeholders - just return the pattern as-is
      return () => pattern;
    }

    // Detect which special placeholder is in the pattern
    const hasDollarAmpersand = pattern.includes('$&');
    const hasDollarQuote = pattern.includes("$'");
    const hasDollarPlus = pattern.includes('$+');

    // Returns: (match, p1, p2, p3, offset, input) => replacement string
    // p1, p2, p3 are capture groups from the regex match
    return (match, p1, p2, p3, offset, input) => {
      if (hasDollarAmpersand) return match;
      if (hasDollarQuote) return input.substring(offset + match.length);
      if (hasDollarPlus) return p1 !== undefined ? p1 : match;

      // Handle numeric placeholders: $1, $2, etc.
      if (hasNumericPlaceholder) {
        const groups = [p1, p2, p3];
        return pattern.replace(/\$(\d+)/g, (match, num) => {
          const index = parseInt(num, 10);
          return (index > 0 && index <= groups.length && groups[index - 1] !== undefined)
            ? groups[index - 1]
            : match;
        });
      }

      // Handle named placeholders: ${name}
      if (hasNamedPlaceholder && p2 !== undefined) {
        return p2;
      }

      return pattern; // Fallback to original pattern
    };
  }

  // Apply replace to a single value
  applyReplace(value, searchPattern, replacePattern, options = {}) {
    const { patternType = 'regex', caseSensitive = false } = options;
    const str = String(value);

    if (patternType === 'regex') {
      const regex = new RegExp(searchPattern, caseSensitive ? 'g' : 'gi');
      // Count replacements BEFORE replacing (match() resets after replace)
      const matches = str.match(regex) || [];
      const replacements = matches.length;
      const result = str.replace(regex, this.compileReplacePattern(replacePattern));
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
        if (!creators) continue;

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
    const { fields = [], progressCallback = () => { } } = options;

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
    const { fields = [], progressCallback = () => { } } = options;
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

export default ReplaceEngine;
