/**
 * Search Engine for Zotero Search & Replace Plugin
 * Provides two-phase search: Zotero.Search for initial filtering, then regex refinement
 */

// Pattern types
export const PATTERN_TYPES = {
  REGEX: 'regex',       // JavaScript regex: /pattern/flags
  SQL_LIKE: 'sql_like', // SQLite LIKE: %pattern%
  SQL_GLOB: 'sql_glob', // SQLite GLOB: *pattern*
  EXACT: 'exact',      // Exact string match (full equality)
  CONTAINS: 'contains'  // Substring match (contains anywhere)
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

  // Location fields (Books)
  PLACE: 'place',
  ARCHIVE_LOCATION: 'archiveLocation',
  LIBRARY_CATALOG: 'libraryCatalog',

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
  'place': 'Place (Books)',
  'archiveLocation': 'Archive/Location',
  'libraryCatalog': 'Library Catalog',
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
  'DOI', 'ISBN', 'ISSN', 'url', 'callNumber', 'extra',
  'place', 'archiveLocation', 'libraryCatalog',
  'attachmentContent', 'annotationText', 'annotationComment'
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
  // Returns null to signal that Phase 1 should be skipped (for empty-field patterns like ^$)
  buildSearchTerm(pattern) {
    if (!pattern || typeof pattern !== 'string') {
      return pattern;
    }

    let searchTerm = pattern;

    // Check for empty-field patterns - these need special handling
    // ^$ matches empty strings, ^\s*$ matches empty or whitespace-only strings
    if (/^\^?\$?\s*\$?$/.test(pattern) || /^\^\\s*\$/.test(pattern)) {
      // This is an empty-field pattern - we can't search for this in Phase 1
      return null;
    }

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
    // Empty-field pattern (^$) - skip Phase 1, use Phase 2 only
    if (pattern === null) {
      return;
    }

    // Tags: use 'tag' condition
    if (field === 'tags') {
      search.addCondition('tag', 'contains', pattern);
      return;
    }

    // Creator fields
    if (field.startsWith('creator.')) {
      const term = this.buildSearchTerm(pattern);
      // If term is null, skip this field in Phase 1
      if (term === null) return;
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
      // If term is null, skip this field in Phase 1
      if (term === null) return;
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

    // Saved Search
    if (field === 'savedSearch') {
      search.addCondition('savedSearch', 'is', pattern);
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

    // Attachment fields
    if (field === 'attachmentContent') {
      search.addCondition('attachmentContent', 'contains', pattern);
      return;
    }
    if (field === 'attachmentFileType') {
      search.addCondition('attachmentFileType', 'is', pattern);
      return;
    }

    // Annotation fields
    if (field === 'annotationText' || field === 'annotationComment') {
      search.addCondition(field, 'contains', pattern);
      return;
    }

    // Item-type specific fields - skip Phase 1, rely on Phase 2
    const itemTypeFields = [
      'thesisType', 'reportType', 'videoRecordingFormat',
      'audioFileType', 'audioRecordingFormat', 'letterType',
      'interviewMedium', 'manuscriptType', 'presentationType',
      'mapType', 'artworkMedium', 'programmingLanguage'
    ];
    if (itemTypeFields.includes(field)) {
      // Skip in Phase 1 - these fields need Phase 2 regex matching
      return;
    }

    // Unknown field - skip
    console.log('SearchReplace: Skipping unknown field:', field);
  }

  // Main search method - TWO PHASE
  // Supports either single pattern (backward compatible) or array of conditions
  async search(patternOrConditions, options = {}) {
    // Handle both old API (pattern as first arg) and new API (conditions array)
    let conditions = [];
    if (Array.isArray(patternOrConditions)) {
      // New API: conditions array
      conditions = patternOrConditions;
    } else if (typeof patternOrConditions === 'string') {
      // Old API: single pattern, convert to conditions format
      const {
        fields = ['title', 'abstractNote', 'creator.lastName', 'creator.firstName', 'tags', 'url'],
        patternType = PATTERN_TYPES.REGEX,
        caseSensitive = false
      } = options;
      conditions = [{
        pattern: patternOrConditions,
        field: fields[0] || 'title',
        fields,
        patternType,
        caseSensitive,
        operator: 'AND' // First condition, implicit AND
      }];
    }

    if (conditions.length === 0) {
      return [];
    }

    const {
      libraryID = Zotero.Libraries.userLibraryID,
      progressCallback = () => { }
    } = options;

    // Validate all conditions
    for (const condition of conditions) {
      this.validatePattern(condition.pattern, condition.patternType || PATTERN_TYPES.REGEX);
    }

    // Get all unique fields from conditions (for backward compat)
    const allFields = [...new Set(conditions.map(c => c.field).filter(f => f))];
    const fields = allFields.length > 0 ? allFields : ['title'];

    // FIX: Always skip Phase 1 for regex patterns
    // The Phase 1 SQL filtering was broken for regex - it passed literal regex strings
    // to SQLite LIKE queries (e.g., '\s+:' instead of actual whitespace), causing
    // false negatives. Since pure JS regex is fast enough (<10ms for typical libraries),
    // we skip Phase 1 entirely for regex patterns.
    const hasRegexCondition = conditions.some(c => c.patternType === PATTERN_TYPES.REGEX);

    // When searching many fields (All Fields), skip Phase 1 and get all items
    const PHASE1_FIELD_THRESHOLD = 5;
    let skipPhase1 = fields.length > PHASE1_FIELD_THRESHOLD;

    // For regex patterns, always skip Phase 1 (fixes false negatives from broken literal extraction)
    if (hasRegexCondition) {
      skipPhase1 = true;
    }

    // Skip Phase 1 if we have NOT conditions (they need full evaluation)
    const hasNotConditions = conditions.some(c => c.operator === 'AND_NOT' || c.operator === 'OR_NOT');
    if (hasNotConditions) {
      skipPhase1 = true;
    }

    let itemIDs = [];
    if (!skipPhase1) {
      // Phase 1: Use Zotero.Search for initial filter
      const search = new Zotero.Search();
      search.libraryID = libraryID;

      // Single field or few fields - use Phase 1 filtering
      // Use only the first positive condition (no NOT) for Phase 1
      const phase1Condition = conditions.find(c =>
        c.operator !== 'AND_NOT' &&
        c.operator !== 'OR_NOT' &&
        c.pattern &&
        !c.pattern.includes('|')
      );

      if (phase1Condition && this._canAddCondition(phase1Condition.field, phase1Condition.pattern)) {
        this.addSearchCondition(search, phase1Condition.field, phase1Condition.pattern);
        itemIDs = await search.search();
        progressCallback({ phase: 'filter', count: itemIDs.length });

        if (itemIDs.length === 0) {
          return [];
        }
      } else {
        // Fallback: get all items
        skipPhase1 = true;
      }
    }

    if (skipPhase1) {
      // Phase 1 skipped - get all items from library for Phase 2 filtering
      // This is slower but necessary for correct multi-field OR matching
      progressCallback({ phase: 'filter', count: 'fetching all items...' });
      const search = new Zotero.Search();
      search.libraryID = libraryID;
      // Get all items (no conditions)
      itemIDs = await search.search();
      progressCallback({ phase: 'filter', count: itemIDs.length });

      if (itemIDs.length === 0) {
        return [];
      }
    }

    // Phase 2: Load items and apply regex refinement with AND/OR/NOT evaluation
    const items = await Zotero.Items.getAsync(itemIDs);
    const results = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      progressCallback({ phase: 'refine', current: i + 1, total: items.length });

      const { matched, matchedFields, matchDetails } = this.evaluateConditions(item, conditions);

      if (matched) {
        results.push(new SearchResult(item, matchedFields, matchDetails));
      }
    }

    return results;
  }

  // Evaluate multiple conditions with AND/OR/NOT logic
  evaluateConditions(item, conditions) {
    if (conditions.length === 0) {
      return { matched: false, matchedFields: [], matchDetails: [] };
    }

    // For single condition, just use matchItem
    if (conditions.length === 1) {
      const c = conditions[0];
      const { matchedFields, matchDetails } = this.matchItem(item, c.pattern, {
        fields: [c.field],
        patternType: c.patternType || PATTERN_TYPES.REGEX,
        caseSensitive: c.caseSensitive || false
      });
      return { matched: matchedFields.length > 0, matchedFields, matchDetails };
    }

    // Multiple conditions - evaluate with AND/OR/NOT
    const results = [];
    let allMatched = true; // For AND logic
    let anyMatched = false; // For OR logic
    let matchedFields = [];
    let matchDetails = [];

    for (let i = 0; i < conditions.length; i++) {
      const c = conditions[i];
      const { matchedFields: mf, matchDetails: md } = this.matchItem(item, c.pattern, {
        fields: [c.field],
        patternType: c.patternType || PATTERN_TYPES.REGEX,
        caseSensitive: c.caseSensitive || false
      });

      const conditionMatched = mf.length > 0;
      results.push(conditionMatched);

      if (conditionMatched) {
        matchedFields = matchedFields.concat(mf);
        matchDetails = matchDetails.concat(md);
      }

      // Update AND/OR trackers
      if (!conditionMatched) {
        allMatched = false;
      }
      if (conditionMatched) {
        anyMatched = true;
      }
    }

    // Apply operator logic
    let matched = false;
    const positiveConditions = conditions.filter(c => c.operator !== 'AND_NOT' && c.operator !== 'OR_NOT');
    const notConditions = conditions.filter(c => c.operator === 'AND_NOT' || c.operator === 'OR_NOT');

    // First, check if positive conditions match
    const positiveResults = results.slice(0, positiveConditions.length);
    const anyPositiveMatched = positiveResults.some(r => r);

    // Now handle NOT conditions
    let notMatched = false;
    for (let i = 0; i < notConditions.length; i++) {
      const notIdx = positiveConditions.length + i;
      if (results[notIdx]) {
        notMatched = true;
        break;
      }
    }

    // Determine final match based on the first condition's operator
    // This preserves the user's intent (AND or OR) from the first condition
    const firstOp = conditions[0].operator || 'AND';
    const allPositiveMatched = positiveResults.every(r => r);

    if (firstOp === 'AND') {
      // ALL positive must match, and none of the NOT conditions should match
      matched = allPositiveMatched && !notMatched;
    } else if (firstOp === 'OR') {
      // At least one positive must match, and none of the NOT conditions should match
      matched = anyPositiveMatched && !notMatched;
    } else if (firstOp === 'AND_NOT') {
      // All positive must match, this specific one must NOT match
      matched = allMatched && !results[0];
    } else if (firstOp === 'OR_NOT') {
      // At least one positive must match (including this), but NOT this one
      matched = (anyMatched || allMatched) && !results[0];
    }

    return { matched, matchedFields, matchDetails };
  }

  // Check if a field can have a condition added (for Phase 1 filtering)
  _canAddCondition(field, pattern) {
    // Empty-field pattern (^$) - skip Phase 1, use Phase 2 only
    if (pattern === null) return false;

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
    const { fields, patternType, caseSensitive = false } = options;
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

          // For regex mode with ^$ pattern, match against empty string
          if (patternType === PATTERN_TYPES.REGEX && pattern === '^$') {
            if (!value || value === '') {
              matchedFields.push(field);
              matchDetails.push({ field, value: '', matchIndex: 0, matchLength: 0 });
              break; // Found match, move to next field
            }
            continue; // Skip to next creator if value is not empty
          }

          const { match } = this.testValue(value, pattern, patternType, caseSensitive);
          if (value && match !== null) {
            matchedFields.push(field);
            // For exact match (string returned as match), use full length
            // For regex match (array returned), use match[0].length
            const matchLength = (patternType === PATTERN_TYPES.EXACT || patternType === PATTERN_TYPES.CONTAINS)
              ? (match ? pattern.length : 0)
              : (match.length || String(value).length);
            const matchIndex = (patternType === PATTERN_TYPES.EXACT || patternType === PATTERN_TYPES.REGEX || patternType === PATTERN_TYPES.CONTAINS)
              ? (patternType === PATTERN_TYPES.EXACT ? 0 : (match ? value.indexOf(pattern) : 0))
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
      } else if (field === 'itemType') {
        // Item type - use itemTypeID to get the raw type name
        // Zotero stores itemType as integer ID, getField returns localized string
        // We need to use Zotero.ItemTypes to get the type name
        const itemTypeID = item.itemTypeID;
        let itemTypeName = null;
        if (typeof Zotero !== 'undefined' && Zotero.ItemTypes) {
          itemTypeName = Zotero.ItemTypes.getName(itemTypeID);
        }
        // If we can't get the type name, fall back to getField (localized)
        if (!itemTypeName) {
          itemTypeName = item.getField('itemType');
        }

        // Match against the type name (e.g., 'book', 'journalArticle')
        const { match } = this.testValue(itemTypeName, pattern, patternType, caseSensitive);
        if (match !== null) {
          matchedFields.push(field);
          matchDetails.push({ field, value: itemTypeName, matchIndex: 0, matchLength: itemTypeName.length });
        }
      } else if (field === 'collection') {
        // Collection - check if item is in the specified collection
        // pattern should be collection ID as string
        const collectionID = parseInt(pattern, 10);
        if (!isNaN(collectionID)) {
          try {
            const collections = item.getCollections();
            if (collections && collections.includes(collectionID)) {
              matchedFields.push(field);
              matchDetails.push({ field, value: 'collection:' + collectionID, matchIndex: 0, matchLength: String(collectionID).length });
            }
          } catch (e) {
            // getCollections might not exist or fail
          }
        }
      } else {
        // Standard field
        try {
          value = item.getField(field);
        } catch (e) {
          continue;
        }

        // For regex mode with ^$ pattern, match against empty string
        if (patternType === PATTERN_TYPES.REGEX && pattern === '^$') {
          if (!value || value === '') {
            matchedFields.push(field);
            matchDetails.push({ field, value: '', matchIndex: 0, matchLength: 0 });
            continue;
          }
        }

        const { match } = this.testValue(value, pattern, patternType, caseSensitive);
        if (value && match !== null) {
          matchedFields.push(field);
          // For exact/contains match (string returned as match), use pattern length
          // For regex match (array returned), use match[0].length
          const matchLength = (patternType === PATTERN_TYPES.EXACT || patternType === PATTERN_TYPES.CONTAINS)
            ? (match ? pattern.length : 0)
            : (match.length || String(value).length);
          const matchIndex = (patternType === PATTERN_TYPES.EXACT || patternType === PATTERN_TYPES.REGEX || patternType === PATTERN_TYPES.CONTAINS)
            ? (patternType === PATTERN_TYPES.EXACT ? 0 : (match ? value.indexOf(pattern) : 0))
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
        // Exact match = full string equality
        const exactMatch = caseSensitive
          ? (str === pattern ? str : null)
          : (str.toLowerCase() === pattern.toLowerCase() ? str : null);
        return { match: exactMatch, regex: null };

      case PATTERN_TYPES.CONTAINS:
        // Contains = substring match anywhere in the string
        const containsMatch = caseSensitive
          ? (str.includes(pattern) ? pattern : null)
          : (str.toLowerCase().includes(pattern.toLowerCase()) ? pattern : null);
        return { match: containsMatch, regex: null };

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
