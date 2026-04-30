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

// Keep this aligned with the dialog field picker so "All Fields" searches every field
// the user can target from the dialog, not just a text-only subset.
const ALL_DIALOG_FIELDS = [
  'title', 'abstractNote', 'date', 'dateModified',
  'creator.lastName', 'creator.firstName', 'creator.fullName',
  'publicationTitle', 'publisher', 'volume', 'issue', 'pages',
  'DOI', 'ISBN', 'ISSN', 'url', 'callNumber', 'extra',
  'itemType', 'tags', 'note', 'place', 'archiveLocation', 'libraryCatalog'
];

const ANY_FIELD_ALIASES = new Set(['all', SEARCH_FIELDS.ANY_FIELD]);
const DATE_FIELDS = new Set(['date', 'dateAdded', 'dateModified']);
const NOTE_FIELDS = new Set(['note', 'childNote']);
const ITEM_TYPE_SPECIFIC_FIELDS = new Set([
  'thesisType', 'reportType', 'videoRecordingFormat',
  'audioFileType', 'audioRecordingFormat', 'letterType',
  'interviewMedium', 'manuscriptType', 'presentationType',
  'mapType', 'artworkMedium', 'programmingLanguage'
]);
const PHASE1_IS_FIELDS = new Set(['itemType', 'collection', 'savedSearch', 'volume', 'issue', 'pages', 'attachmentFileType']);

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

  // Build a simpler search term for Phase 1 (Zotero "contains" search).
  // Returns null when we can't derive a safe literal prefilter.
  buildSearchTerm(pattern, patternType = PATTERN_TYPES.REGEX) {
    if (!pattern || typeof pattern !== 'string') {
      return pattern;
    }

    if (patternType === PATTERN_TYPES.EXACT || patternType === PATTERN_TYPES.CONTAINS) {
      return pattern;
    }

    let searchTerm = pattern;

    if (this.isEmptyFieldPattern(pattern, patternType)) {
      // This is an empty-field pattern - we can't search for this in Phase 1
      return null;
    }

    if (patternType === PATTERN_TYPES.REGEX) {
      // Handle anchors - Zotero's search doesn't understand ^ or $ as regex anchors
      if (searchTerm.startsWith('^')) {
        searchTerm = searchTerm.slice(1);
      }
      if (searchTerm.endsWith('$')) {
        searchTerm = searchTerm.slice(0, -1);
      }

      // For optional characters (x?), remove the entire x? sequence.
      searchTerm = searchTerm.replace(/\?\*/g, '*');
      searchTerm = searchTerm.replace(/\?\+/g, '+');
      searchTerm = searchTerm.replace(/\?\?/g, '?');
      searchTerm = searchTerm.replaceAll(/.\?/g, '');
      searchTerm = searchTerm.replaceAll(/\*\?/g, '');
      searchTerm = searchTerm.replaceAll(/\+\?/g, '');
    }

    // Extract literal alphanumeric sequences from the cleaned pattern
    const literals = searchTerm.match(/[a-zA-Z0-9]{2,}/g) || [];

    if (literals.length > 0) {
      // Return the longest literal - gives best filtering (longer = fewer false positives)
      return literals.reduce((a, b) => a.length >= b.length ? a : b);
    }

    return null;
  }

  isEmptyFieldPattern(pattern, patternType) {
    return patternType === PATTERN_TYPES.REGEX && typeof pattern === 'string'
      && /^\^(?:\\s\*)?\$$/.test(pattern);
  }

  getMatchLength(match, patternType) {
    if (patternType === PATTERN_TYPES.EXACT || patternType === PATTERN_TYPES.CONTAINS) {
      return String(match).length;
    }
    return match?.[0] ? match[0].length : 0;
  }

  getMatchIndex(value, match, pattern, patternType, caseSensitive) {
    if (patternType === PATTERN_TYPES.EXACT) {
      return 0;
    }

    if (patternType === PATTERN_TYPES.REGEX || patternType === PATTERN_TYPES.SQL_LIKE || patternType === PATTERN_TYPES.SQL_GLOB) {
      return typeof match.index === 'number' ? match.index : 0;
    }

    const haystack = caseSensitive ? value : value.toLowerCase();
    const needle = caseSensitive ? pattern : pattern.toLowerCase();
    return haystack.indexOf(needle);
  }

  getCreatorFullName(creator) {
    if (!creator) {
      return '';
    }

    const singleFieldName = creator.name == null ? '' : String(creator.name).trim();
    if (singleFieldName) {
      return singleFieldName;
    }

    return [creator.firstName, creator.lastName]
      .filter((part) => part != null && String(part).trim() !== '')
      .map((part) => String(part).trim())
      .join(' ');
  }

  getPhase1Term(pattern, patternType = PATTERN_TYPES.REGEX) {
    return this.buildSearchTerm(pattern, patternType);
  }

  getPhase1Candidate(conditions) {
    const candidates = conditions
      .filter((condition) => condition.operator !== 'AND_NOT' && condition.operator !== 'OR_NOT')
      .filter((condition) => condition.pattern)
      .filter((condition) => !(condition.patternType === PATTERN_TYPES.REGEX && condition.pattern.includes('|')))
      .map((condition) => ({
        condition,
        term: this.getPhase1Term(condition.pattern, condition.patternType || PATTERN_TYPES.REGEX)
      }))
      .filter(({ condition, term }) => term !== null && this._canAddCondition(condition.field, condition.pattern, condition.patternType));

    if (candidates.length === 0) {
      return null;
    }

    return candidates.reduce((best, candidate) => {
      if (!best || candidate.term.length > best.term.length) {
        return candidate;
      }
      return best;
    }, null);
  }

  // Add search condition for a field
  addSearchCondition(search, field, pattern, patternType = PATTERN_TYPES.REGEX) {
    if (pattern === null || ANY_FIELD_ALIASES.has(field) || DATE_FIELDS.has(field) || ITEM_TYPE_SPECIFIC_FIELDS.has(field)) {
      return;
    }

    const containsField = this.getPhase1ContainsField(field);
    if (containsField) {
      this.addPhase1ContainsCondition(search, containsField, pattern, patternType);
      return;
    }

    if (PHASE1_IS_FIELDS.has(field)) {
      search.addCondition(field, 'is', pattern);
      return;
    }

    console.log('SearchReplace: Skipping unknown field:', field);
  }

  getPhase1ContainsField(field) {
    if (field === 'tags') {
      return 'tag';
    }

    if (field.startsWith('creator.')) {
      return 'creator';
    }

    if (FIELDS_WITH_CONTAINS.includes(field)) {
      return field;
    }

    if (NOTE_FIELDS.has(field) || field === 'attachmentContent' || field === 'annotationText' || field === 'annotationComment') {
      return field === 'childNote' ? 'note' : field;
    }

    return null;
  }

  addPhase1ContainsCondition(search, field, pattern, patternType) {
    const term = this.getPhase1Term(pattern, patternType);
    if (term === null) {
      return;
    }

    search.addCondition(field, 'contains', term);
  }

  // Main search method - TWO PHASE
  // Supports either single pattern (backward compatible) or array of conditions
  async search(patternOrConditions, options = {}) {
    const conditions = this.normalizeSearchConditions(patternOrConditions, options);

    if (conditions.length === 0) {
      return [];
    }

    const {
      libraryID = Zotero.Libraries.userLibraryID,
      progressCallback = () => { }
    } = options;

    this.validateConditions(conditions);

    const fields = this.getConditionFields(conditions);
    let skipPhase1 = this.shouldSkipPhase1(fields, conditions);
    let phase1Candidate = null;

    if (!skipPhase1) {
      phase1Candidate = this.getPhase1Candidate(conditions);
      if (!phase1Candidate) {
        skipPhase1 = true;
      }
    }

    const itemIDs = skipPhase1
      ? await this.fetchAllItemIDs(libraryID, progressCallback)
      : await this.runPhase1Search(libraryID, phase1Candidate, progressCallback);

    if (itemIDs.length === 0) {
      return [];
    }

    return this.buildSearchResults(itemIDs, conditions, progressCallback);
  }

  normalizeSearchConditions(patternOrConditions, options = {}) {
    if (Array.isArray(patternOrConditions)) {
      return patternOrConditions;
    }

    if (typeof patternOrConditions !== 'string') {
      return [];
    }

    return this.createLegacyConditions(patternOrConditions, options);
  }

  createLegacyConditions(pattern, options = {}) {
    const {
      fields = ['title', 'abstractNote', 'creator.lastName', 'creator.firstName', 'tags', 'url'],
      patternType = PATTERN_TYPES.REGEX,
      caseSensitive = false
    } = options;
    const legacyFields = fields.length > 0 ? fields : ['title'];

    return legacyFields.map((field, index) => ({
      pattern,
      field,
      fields: legacyFields,
      patternType,
      caseSensitive,
      operator: index === 0 ? 'AND' : 'OR'
    }));
  }

  validateConditions(conditions) {
    for (const condition of conditions) {
      this.validatePattern(condition.pattern, condition.patternType || PATTERN_TYPES.REGEX);
    }
  }

  getConditionFields(conditions) {
    const allFields = [...new Set(conditions.map((condition) => condition.field).filter(Boolean))];
    return allFields.length > 0 ? allFields : ['title'];
  }

  shouldSkipPhase1(fields, conditions) {
    const PHASE1_FIELD_THRESHOLD = 5;
    if (fields.length > PHASE1_FIELD_THRESHOLD) {
      return true;
    }

    return conditions.some((condition) => condition.operator === 'AND_NOT' || condition.operator === 'OR_NOT');
  }

  async runPhase1Search(libraryID, phase1Candidate, progressCallback) {
    const search = new Zotero.Search();
    search.libraryID = libraryID;

    this.addSearchCondition(
      search,
      phase1Candidate.condition.field,
      phase1Candidate.condition.pattern,
      phase1Candidate.condition.patternType
    );

    const itemIDs = await search.search();
    progressCallback({ phase: 'filter', count: itemIDs.length });
    return itemIDs;
  }

  async fetchAllItemIDs(libraryID, progressCallback) {
    progressCallback({ phase: 'filter', count: 'fetching all items...' });

    const search = new Zotero.Search();
    search.libraryID = libraryID;
    const itemIDs = await search.search();
    progressCallback({ phase: 'filter', count: itemIDs.length });
    return itemIDs;
  }

  async buildSearchResults(itemIDs, conditions, progressCallback) {
    const items = await Zotero.Items.getAsync(itemIDs);
    const results = [];

    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      progressCallback({ phase: 'refine', current: index + 1, total: items.length });

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
    }

    // Respect the operator attached to each subsequent condition.
    // The first condition establishes the initial truth value; later rows combine with it.
    let matched = results[0];
    for (let i = 1; i < conditions.length; i++) {
      const operator = conditions[i].operator || 'AND';
      const conditionMatched = results[i];

      if (operator === 'AND') {
        matched = matched && conditionMatched;
      } else if (operator === 'OR') {
        matched = matched || conditionMatched;
      } else if (operator === 'AND_NOT') {
        matched = matched && !conditionMatched;
      } else if (operator === 'OR_NOT') {
        matched = matched || !conditionMatched;
      }
    }

    return { matched, matchedFields, matchDetails };
  }

  // Check if a field can have a condition added (for Phase 1 filtering)
  _canAddCondition(field, pattern, patternType = PATTERN_TYPES.REGEX) {
    // Empty-field pattern (^$) - skip Phase 1, use Phase 2 only
    if (pattern === null) return false;

    if (ANY_FIELD_ALIASES.has(field)) return false;

    // Tags: supports 'contains'
    if (field === 'tags') return this.getPhase1Term(pattern, patternType) !== null;

    // Creator fields
    if (field.startsWith('creator.')) return this.getPhase1Term(pattern, patternType) !== null;

    // Date fields - cannot do substring search
    if (field === 'date' || field === 'dateAdded' || field === 'dateModified') return false;

    // Fields that support 'contains'
    if (FIELDS_WITH_CONTAINS.includes(field)) return this.getPhase1Term(pattern, patternType) !== null;

    // Item type
    if (field === 'itemType') return true;

    // Collection
    if (field === 'collection') return true;

    // Note fields
    if (field === 'note' || field === 'childNote') return this.getPhase1Term(pattern, patternType) !== null;

    // Volume/issue/pages
    if (field === 'volume' || field === 'issue' || field === 'pages') return true;

    return false;
  }

  // Match item against pattern
  matchItem(item, pattern, options = {}) {
    const { fields, patternType, caseSensitive = false } = options;
    const matchedFields = [];
    const matchDetails = [];
    const emptyFieldPattern = this.isEmptyFieldPattern(pattern, patternType);

    for (const field of fields) {
      const fieldResult = this.matchField(item, field, pattern, patternType, caseSensitive, emptyFieldPattern, options);
      matchedFields.push(...fieldResult.matchedFields);
      matchDetails.push(...fieldResult.matchDetails);
    }

    return { matchedFields, matchDetails };
  }

  matchField(item, field, pattern, patternType, caseSensitive, emptyFieldPattern, options) {
    if (ANY_FIELD_ALIASES.has(field)) {
      return this.matchItem(item, pattern, {
        ...options,
        fields: ALL_DIALOG_FIELDS
      });
    }

    if (field.startsWith('creator.')) {
      return this.matchCreatorField(item, field, pattern, patternType, caseSensitive, emptyFieldPattern);
    }

    if (field === 'tags') {
      return this.matchTagsField(item, field, pattern, patternType, caseSensitive);
    }

    if (field === 'itemType') {
      return this.matchItemTypeField(item, field, pattern, patternType, caseSensitive);
    }

    if (field === 'collection') {
      return this.matchCollectionField(item, field, pattern);
    }

    return this.matchStandardField(item, field, pattern, patternType, caseSensitive, emptyFieldPattern);
  }

  createFieldMatch(field, detail) {
    if (!detail) {
      return { matchedFields: [], matchDetails: [] };
    }

    return { matchedFields: [field], matchDetails: [detail] };
  }

  buildMatchDetail(field, value, matchIndex, matchLength) {
    return { field, value, matchIndex, matchLength };
  }

  getFieldMatchDetail(field, value, pattern, patternType, caseSensitive, emptyFieldPattern) {
    const normalizedValue = value == null ? '' : String(value);

    if (emptyFieldPattern) {
      if (/^\s*$/.test(normalizedValue)) {
        return this.buildMatchDetail(field, normalizedValue, 0, normalizedValue.length);
      }
      return null;
    }

    if (value === null || value === undefined) {
      return null;
    }

    const { match } = this.testValue(normalizedValue, pattern, patternType, caseSensitive);
    if (match === null) {
      return null;
    }

    return this.buildMatchDetail(
      field,
      normalizedValue,
      this.getMatchIndex(normalizedValue, match, pattern, patternType, caseSensitive),
      this.getMatchLength(match, patternType)
    );
  }

  matchCreatorField(item, field, pattern, patternType, caseSensitive, emptyFieldPattern) {
    const creators = item.getCreators();
    if (!creators || creators.length === 0) {
      return { matchedFields: [], matchDetails: [] };
    }

    const creatorField = field.split('.')[1];
    for (const creator of creators) {
      const value = creatorField === 'fullName'
        ? this.getCreatorFullName(creator)
        : creator[creatorField];
      const detail = this.getFieldMatchDetail(field, value, pattern, patternType, caseSensitive, emptyFieldPattern);
      if (detail) {
        return this.createFieldMatch(field, detail);
      }
    }

    return { matchedFields: [], matchDetails: [] };
  }

  matchTagsField(item, field, pattern, patternType, caseSensitive) {
    const tags = item.getTags();
    for (const tag of tags) {
      const { match } = this.testValue(tag.name, pattern, patternType, caseSensitive);
      if (match !== null) {
        return this.createFieldMatch(field, this.buildMatchDetail(field, tag.name, -1, -1));
      }
    }

    return { matchedFields: [], matchDetails: [] };
  }

  getItemTypeName(item) {
    const itemTypeID = item.itemTypeID;
    if (typeof Zotero !== 'undefined' && Zotero.ItemTypes) {
      const itemTypeName = Zotero.ItemTypes.getName(itemTypeID);
      if (itemTypeName) {
        return itemTypeName;
      }
    }

    return item.getField('itemType');
  }

  matchItemTypeField(item, field, pattern, patternType, caseSensitive) {
    const itemTypeName = this.getItemTypeName(item);
    const { match } = this.testValue(itemTypeName, pattern, patternType, caseSensitive);
    if (match === null) {
      return { matchedFields: [], matchDetails: [] };
    }

    return this.createFieldMatch(
      field,
      this.buildMatchDetail(field, itemTypeName, 0, itemTypeName.length)
    );
  }

  matchCollectionField(item, field, pattern) {
    const collectionID = Number.parseInt(pattern, 10);
    if (isNaN(collectionID)) {
      return { matchedFields: [], matchDetails: [] };
    }

    try {
      const collections = item.getCollections();
      if (!collections?.includes(collectionID)) {
        return { matchedFields: [], matchDetails: [] };
      }

      return this.createFieldMatch(
        field,
        this.buildMatchDetail(field, 'collection:' + collectionID, 0, String(collectionID).length)
      );
    } catch {
      return { matchedFields: [], matchDetails: [] };
    }
  }

  matchStandardField(item, field, pattern, patternType, caseSensitive, emptyFieldPattern) {
    try {
      const value = item.getField(field);
      return this.createFieldMatch(
        field,
        this.getFieldMatchDetail(field, value, pattern, patternType, caseSensitive, emptyFieldPattern)
      );
    } catch {
      return { matchedFields: [], matchDetails: [] };
    }
  }

  testRegexValue(str, pattern, caseSensitive) {
    try {
      const regex = new RegExp(pattern, caseSensitive ? '' : 'i');
      return { match: regex.exec(str), regex };
    } catch {
      return { match: null, regex: null };
    }
  }

  testLikeValue(str, pattern, caseSensitive) {
    const likePattern = this.regexToSqlLike(pattern);
    const regex = new RegExp(
      likePattern.replace(/%/g, '.*').replace(/_/g, '.'),
      caseSensitive ? '' : 'i'
    );
    return { match: regex.exec(str), regex };
  }

  testGlobValue(str, pattern, caseSensitive) {
    const globPattern = this.regexToSqlGlob(pattern);
    const regex = new RegExp(
      '^' + globPattern.replaceAll('*', '.*').replaceAll('?', '.') + '$',
      caseSensitive ? '' : 'i'
    );
    return { match: regex.exec(str), regex };
  }

  testExactValue(str, pattern, caseSensitive) {
    let match = null;
    if (caseSensitive) {
      match = str === pattern ? str : null;
    } else if (str.toLowerCase() === pattern.toLowerCase()) {
      match = str;
    }
    return { match, regex: null };
  }

  testContainsValue(str, pattern, caseSensitive) {
    let match = null;
    if (caseSensitive) {
      match = str.includes(pattern) ? pattern : null;
    } else if (str.toLowerCase().includes(pattern.toLowerCase())) {
      match = pattern;
    }
    return { match, regex: null };
  }

  // Test a value against pattern - returns match info for regex
  testValue(value, pattern, patternType, caseSensitive) {
    const str = value == null ? '' : String(value);

    if (patternType === PATTERN_TYPES.REGEX) {
      return this.testRegexValue(str, pattern, caseSensitive);
    }

    if (patternType === PATTERN_TYPES.LIKE || patternType === PATTERN_TYPES.SQL_LIKE) {
      return this.testLikeValue(str, pattern, caseSensitive);
    }

    if (patternType === PATTERN_TYPES.GLOB || patternType === PATTERN_TYPES.SQL_GLOB) {
      return this.testGlobValue(str, pattern, caseSensitive);
    }

    if (patternType === PATTERN_TYPES.EXACT) {
      return this.testExactValue(str, pattern, caseSensitive);
    }

    if (patternType === PATTERN_TYPES.CONTAINS) {
      return this.testContainsValue(str, pattern, caseSensitive);
    }

    return { match: null, regex: null };
  }

  // Check if value matches pattern (boolean)
  matches(value, pattern, patternType, caseSensitive) {
    const { match } = this.testValue(value, pattern, patternType, caseSensitive);
    return match !== null;
  }
}

export default SearchEngine;
