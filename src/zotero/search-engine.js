/**
 * Search Engine for Zotero Search & Replace Plugin
 * Provides two-phase search: Zotero.Search for initial filtering, then regex refinement
 */

// Pattern types
export const PATTERN_TYPES = {
  REGEX: 'regex',       // JavaScript regex: /pattern/flags
  SQL_LIKE: 'sql_like', // SQLite LIKE: %pattern%
  SQL_GLOB: 'sql_glob', // SQLite GLOB: *pattern*
  EXACT: 'exact'        // Exact string match
};

// All searchable fields matching Zotero's Advanced Search
export const SEARCH_FIELDS = {
  // Core fields
  TITLE: 'title',
  ABSTRACT: 'abstractNote',
  DATE: 'date',
  DATE_ADDED: 'dateAdded',
  DATE_MODIFIED: 'dateModified',

  // Creator fields
  CREATOR_FIRST: 'firstName',
  CREATOR_LAST: 'lastName',
  CREATOR_FULL: 'fullName',

  // Publication fields
  PUBLICATION: 'publicationTitle',
  PUBLISHER: 'publisher',
  VOLUME: 'volume',
  ISSUE: 'issue',
  PAGES: 'pages',

  // Identifier fields
  DOI: 'DOI',
  ISBN: 'ISBN',
  ISSN: 'ISSN',
  URL: 'url',

  // Other fields
  TAGS: 'tags',
  CALL_NUMBER: 'callNumber',
  EXTRA: 'extra',
  ITEM_TYPE: 'itemType',

  // Collection/Search
  COLLECTION: 'collection',
  SAVED_SEARCH: 'savedSearch',

  // Notes
  NOTE: 'note',
  CHILD_NOTE: 'childNote',

  // Attachments
  ATTACHMENT_CONTENT: 'attachmentContent',
  ATTACHMENT_FILE_TYPE: 'attachmentFileType',

  // Annotations
  ANNOTATION_TEXT: 'annotationText',
  ANNOTATION_COMMENT: 'annotationComment',

  // Item-type specific
  THESIS_TYPE: 'thesisType',
  REPORT_TYPE: 'reportType',
  VIDEO_FORMAT: 'videoRecordingFormat',
  AUDIO_FILE_TYPE: 'audioFileType',
  AUDIO_RECORDING_FORMAT: 'audioRecordingFormat',
  LETTER_TYPE: 'letterType',
  INTERVIEW_MEDIUM: 'interviewMedium',
  MANUSCRIPT_TYPE: 'manuscriptType',
  PRESENTATION_TYPE: 'presentationType',
  MAP_TYPE: 'mapType',
  ARTWORK_MEDIUM: 'artworkMedium',
  PROGRAMMING_LANGUAGE: 'programmingLanguage',

  // Special
  ANY_FIELD: 'anyField'
};

// Field display names (localized)
export const SEARCH_FIELD_NAMES = {
  'title': 'Title',
  'abstractNote': 'Abstract',
  'date': 'Date',
  'dateAdded': 'Date Added',
  'dateModified': 'Date Modified',
  'creator.firstName': 'Creator (First Name)',
  'creator.lastName': 'Creator (Last Name)',
  'creator.fullName': 'Creator (Full Name)',
  'publicationTitle': 'Publication',
  'publisher': 'Publisher',
  'volume': 'Volume',
  'issue': 'Issue',
  'pages': 'Pages',
  'DOI': 'DOI',
  'ISBN': 'ISBN',
  'ISSN': 'ISSN',
  'url': 'URL',
  'tags': 'Tags',
  'callNumber': 'Call Number',
  'extra': 'Extra',
  'itemType': 'Item Type',
  'collection': 'Collection',
  'savedSearch': 'Saved Search',
  'note': 'Note',
  'childNote': 'Child Note',
  'attachmentContent': 'Attachment Content',
  'attachmentFileType': 'Attachment File Type',
  'annotationText': 'Annotation Text',
  'annotationComment': 'Annotation Comment',
  'thesisType': 'Thesis Type',
  'reportType': 'Report Type',
  'videoRecordingFormat': 'Video Recording Format',
  'audioFileType': 'Audio File Type',
  'audioRecordingFormat': 'Audio Recording Format',
  'letterType': 'Letter Type',
  'interviewMedium': 'Interview Medium',
  'manuscriptType': 'Manuscript Type',
  'presentationType': 'Presentation Type',
  'mapType': 'Map Type',
  'artworkMedium': 'Artwork Medium',
  'programmingLanguage': 'Programming Language',
  'all': 'All Fields'
};

// Fields that support 'contains' operator in Zotero.Search
const FIELDS_WITH_CONTAINS = [
  'title', 'abstractNote', 'publicationTitle', 'publisher',
  'DOI', 'ISBN', 'ISSN', 'url', 'callNumber', 'extra'
];

// Search result structure
export class SearchResult {
  constructor(item, matchedFields = [], matchDetails = []) {
    this.item = item;           // Zotero.Item
    this.itemID = item.id;
    this.itemKey = item.key;
    this.libraryID = item.libraryID;
    this.matchedFields = matchedFields;  // ['title', 'lastName']
    this.matchDetails = matchDetails;    // [{field, value, matchIndex, matchLength}]
  }
}

// Error handling for invalid regex
export class SearchError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'SearchError';
    this.code = code; // 'INVALID_REGEX', 'FIELD_NOT_FOUND', etc.
  }
}

class SearchEngine {
  constructor() {
    this.patternType = PATTERN_TYPES.REGEX;
  }

  // Validate regex pattern before search
  validatePattern(pattern, patternType) {
    if (patternType === PATTERN_TYPES.REGEX) {
      try {
        new RegExp(pattern);
      } catch (e) {
        throw new SearchError(`Invalid regex: ${e.message}`, 'INVALID_REGEX');
      }
    }
  }

  // Convert regex to SQL LIKE pattern (basic escape)
  regexToSqlLike(pattern) {
    // Escape special SQL LIKE chars: %, _, \
    const escaped = pattern.replace(/([%_\\])/g, '\\$1');
    return `%${escaped}%`;
  }

  // Convert regex to SQL GLOB pattern
  regexToSqlGlob(pattern) {
    // Convert * to *, ? to ?, handle regex specials
    const escaped = pattern
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')  // Escape regex specials
      .replace(/\\\*/g, '*')
      .replace(/\\\?/g, '?');
    return `*${escaped}*`;
  }

  // Build a simpler search term for Phase 1 (Zotero "contains" search)
  // For regex patterns, we try to extract a simple literal substring for initial filtering
  buildSearchTerm(pattern) {
    if (!pattern || typeof pattern !== 'string') {
      return pattern;
    }

    let searchTerm = pattern;

    // Handle anchors - Zotero's search doesn't understand ^ or $ as regex anchors
    if (searchTerm.startsWith('^')) {
      searchTerm = searchTerm.slice(1);
    }
    if (searchTerm.endsWith('$')) {
      searchTerm = searchTerm.slice(0, -1);
    }

    // For optional characters (x?), remove the entire x? sequence
    // This handles cases like "https?" -> extract "http" (without the optional 's')
    // Also handle non-greedy patterns like ".*?" -> extract just the literal .
    searchTerm = searchTerm.replace(/\?\*/g, '*');  // ?* -> * (non-greedy quantifier edge case)
    searchTerm = searchTerm.replace(/\?\+/g, '+');  // ?+ -> + (non-greedy quantifier edge case)
    searchTerm = searchTerm.replace(/\?\?/g, '?');  // ?? -> ? (non-greedy optional)
    searchTerm = searchTerm.replace(/.\?/g, '');   // x? -> (remove both char and ?)
    searchTerm = searchTerm.replace(/\*\?/g, '');  // *? -> (remove, was non-greedy *)
    searchTerm = searchTerm.replace(/\+\?/g, '');  // +? -> (remove, was non-greedy +)

    // Extract literal alphanumeric sequences from the cleaned pattern
    const literals = searchTerm.match(/[a-zA-Z0-9]{2,}/g) || [];

    if (literals.length > 0) {
      // Return the longest literal - gives best filtering (longer = fewer false positives)
      return literals.reduce((a, b) => a.length >= b.length ? a : b);
    }

    // Fallback: return pattern without anchors if possible
    let cleanPattern = searchTerm;
    if (cleanPattern.startsWith('^')) cleanPattern = cleanPattern.slice(1);
    if (cleanPattern.endsWith('$')) cleanPattern = cleanPattern.slice(0, -1);
    return cleanPattern || pattern;
  }

  // Add search condition for a field
  addSearchCondition(search, field, pattern) {
    // Tags: use 'tag' condition
    if (field === 'tags') {
      search.addCondition('tag', 'contains', pattern);
      return;
    }

    // Creator fields
    if (field.startsWith('creator.')) {
      const term = this.buildSearchTerm(pattern);
      search.addCondition('creator', 'contains', term);
      return;
    }

    // Date fields - use 'is' since dates don't support 'contains'
    if (field === 'date' || field === 'dateAdded' || field === 'dateModified') {
      // For date fields, we can't do substring search effectively
      // Skip this field in Phase 1, rely on Phase 2
      return;
    }

    // Fields that support 'contains'
    if (FIELDS_WITH_CONTAINS.includes(field)) {
      const term = this.buildSearchTerm(pattern);
      search.addCondition(field, 'contains', term);
      return;
    }

    // Item type
    if (field === 'itemType') {
      search.addCondition('itemType', 'is', pattern);
      return;
    }

    // Collection
    if (field === 'collection') {
      search.addCondition('collection', 'is', pattern);
      return;
    }

    // Note fields
    if (field === 'note' || field === 'childNote') {
      search.addCondition('note', 'contains', pattern);
      return;
    }

    // Volume/issue/pages
    if (field === 'volume' || field === 'issue' || field === 'pages') {
      search.addCondition(field, 'is', pattern);
      return;
    }

    // Unknown field - skip
    console.log('SearchReplace: Skipping unknown field:', field);
  }

  // Main search method - TWO PHASE
  async search(pattern, options = {}) {
    const {
      fields = ['title', 'abstractNote', 'creator.lastName', 'creator.firstName', 'tags', 'url'],
      patternType = PATTERN_TYPES.REGEX,
      caseSensitive = false,
      libraryID = Zotero.Libraries.userLibraryID,
      progressCallback = () => { }
    } = options;

    // Validate
    this.validatePattern(pattern, patternType);

    // Phase 1: Use Zotero.Search for initial filter
    const search = new Zotero.Search();
    search.libraryID = libraryID;

    // Add search conditions for each field with OR logic
    // When searching multiple fields, use OR so items match in ANY field (not ALL)
    let hasConditions = false;
    if (fields.length === 1) {
      // Single field - use normal AND logic (with just one condition)
      this.addSearchCondition(search, fields[0], pattern);
      hasConditions = true;
    } else {
      // Multiple fields - use first valid field for Phase 1 filtering
      // This avoids ANDing multiple fields which would be too restrictive
      // Phase 2 will do the actual multi-field matching
      for (const field of fields) {
        // Try to add condition for this field, skip if not applicable
        if (this._canAddCondition(field, pattern)) {
          this.addSearchCondition(search, field, pattern);
          hasConditions = true;
          break; // Only use ONE field for Phase 1, Phase 2 handles the rest
        }
      }
    }

    // If no valid conditions, return empty
    if (!hasConditions) {
      console.log('SearchReplace: No searchable fields');
      return [];
    }

    const itemIDs = await search.search();
    progressCallback({ phase: 'filter', count: itemIDs.length });

    if (itemIDs.length === 0) {
      return [];
    }

    // Phase 2: Load items and apply regex refinement
    const items = await Zotero.Items.getAsync(itemIDs);
    const results = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      progressCallback({ phase: 'refine', current: i + 1, total: items.length });

      const { matchedFields, matchDetails } = this.matchItem(item, pattern, {
        fields,
        patternType,
        caseSensitive
      });

      if (matchedFields.length > 0) {
        results.push(new SearchResult(item, matchedFields, matchDetails));
      }
    }

    return results;
  }

  // Check if a field can have a condition added (for Phase 1 filtering)
  _canAddCondition(field, pattern) {
    // Tags: supports 'contains'
    if (field === 'tags') return true;

    // Creator fields
    if (field.startsWith('creator.')) return true;

    // Date fields - cannot do substring search
    if (field === 'date' || field === 'dateAdded' || field === 'dateModified') return false;

    // Fields that support 'contains'
    if (FIELDS_WITH_CONTAINS.includes(field)) return true;

    // Item type
    if (field === 'itemType') return true;

    // Collection
    if (field === 'collection') return true;

    // Note fields
    if (field === 'note' || field === 'childNote') return true;

    // Volume/issue/pages
    if (field === 'volume' || field === 'issue' || field === 'pages') return true;

    return false;
  }

  // Match item against pattern
  matchItem(item, pattern, options = {}) {
    const { fields, patternType, caseSensitive } = options;
    const matchedFields = [];
    const matchDetails = [];

    for (const field of fields) {
      let value;

      // Handle creator fields specially
      if (field.startsWith('creator.')) {
        const creators = item.getCreators();
        if (!creators || creators.length === 0) continue;

        const creatorField = field.split('.')[1]; // 'firstName', 'lastName', 'fullName'
        for (const creator of creators) {
          if (creatorField === 'fullName') {
            value = creator.name;
          } else {
            value = creator[creatorField];
          }

          const { match } = this.testValue(value, pattern, patternType, caseSensitive);
          if (value && match !== null) {
            matchedFields.push(field);
            // For exact match (string returned as match), use full length
            // For regex match (array returned), use match[0].length
            const matchLength = (patternType === PATTERN_TYPES.EXACT)
              ? String(value).length
              : (match.length || String(value).length);
            const matchIndex = (patternType === PATTERN_TYPES.EXACT || patternType === PATTERN_TYPES.REGEX)
              ? (patternType === PATTERN_TYPES.EXACT ? 0 : (match.index || 0))
              : 0;
            matchDetails.push({ field, value, matchIndex, matchLength });
            break; // Found match, move to next field
          }
        }
      } else if (field === 'tags') {
        const tags = item.getTags();
        for (const tag of tags) {
          const { match } = this.testValue(tag.name, pattern, patternType, caseSensitive);
          if (match !== null) {
            matchedFields.push(field);
            matchDetails.push({ field, value: tag.name, matchIndex: -1, matchLength: -1 });
            break;
          }
        }
      } else {
        // Standard field
        try {
          value = item.getField(field);
        } catch (e) {
          continue;
        }
        const { match } = this.testValue(value, pattern, patternType, caseSensitive);
        if (value && match !== null) {
          matchedFields.push(field);
          // For exact match (string returned as match), use full length
          // For regex match (array returned), use match[0].length
          const matchLength = (patternType === PATTERN_TYPES.EXACT)
            ? String(value).length
            : (match.length || String(value).length);
          const matchIndex = (patternType === PATTERN_TYPES.EXACT || patternType === PATTERN_TYPES.REGEX)
            ? (patternType === PATTERN_TYPES.EXACT ? 0 : (match.index || 0))
            : 0;
          matchDetails.push({ field, value, matchIndex, matchLength });
        }
      }
    }

    return { matchedFields, matchDetails };
  }

  // Test a value against pattern - returns match info for regex
  testValue(value, pattern, patternType, caseSensitive) {
    const str = String(value);

    switch (patternType) {
      case PATTERN_TYPES.REGEX:
        try {
          const regex = new RegExp(pattern, caseSensitive ? '' : 'i');
          return { match: regex.exec(str), regex };
        } catch (e) {
          return { match: null, regex: null };
        }

      case PATTERN_TYPES.LIKE:
      case PATTERN_TYPES.SQL_LIKE:
        const likePattern = this.regexToSqlLike(pattern);
        const regexFromLike = new RegExp(
          likePattern.replace(/%/g, '.*').replace(/_/g, '.'),
          caseSensitive ? '' : 'i'
        );
        return { match: regexFromLike.exec(str), regex: regexFromLike };

      case PATTERN_TYPES.GLOB:
      case PATTERN_TYPES.SQL_GLOB:
        const globPattern = this.regexToSqlGlob(pattern);
        const globRegex = new RegExp('^' + globPattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
          caseSensitive ? '' : 'i');
        return { match: globRegex.exec(str), regex: globRegex };

      case PATTERN_TYPES.EXACT:
        const exactMatch = caseSensitive
          ? (str === pattern ? str : null)
          : (str.toLowerCase() === pattern.toLowerCase() ? str : null);
        return { match: exactMatch, regex: null };

      default:
        return { match: null, regex: null };
    }
  }

  // Check if value matches pattern (boolean)
  matches(value, pattern, patternType, caseSensitive) {
    const { match } = this.testValue(value, pattern, patternType, caseSensitive);
    return match !== null;
  }
}

export default SearchEngine;
