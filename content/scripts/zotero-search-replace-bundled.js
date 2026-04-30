// Console polyfill for Zotero 8
if (typeof console === 'undefined') {
  globalThis.console = {
    log: function() { if (typeof Zotero !== 'undefined' && Zotero.debug) Zotero.debug('SearchReplace: ' + Array.prototype.join.call(arguments, ' ')); },
    warn: function() { if (typeof Zotero !== 'undefined' && Zotero.debug) Zotero.debug('SearchReplace WARN: ' + Array.prototype.join.call(arguments, ' ')); },
    error: function() { if (typeof Zotero !== 'undefined' && Zotero.debug) Zotero.debug('SearchReplace ERROR: ' + Array.prototype.join.call(arguments, ' ')); },
    info: function() { if (typeof Zotero !== 'undefined' && Zotero.debug) Zotero.debug('SearchReplace INFO: ' + Array.prototype.join.call(arguments, ' ')); },
    debug: function() { if (typeof Zotero !== 'undefined' && Zotero.debug) Zotero.debug('SearchReplace DEBUG: ' + Array.prototype.join.call(arguments, ' ')); }
  };
}

(() => {
  // src/zotero/search-engine.js
  var PATTERN_TYPES = {
    REGEX: "regex",
    // JavaScript regex: /pattern/flags
    SQL_LIKE: "sql_like",
    // SQLite LIKE: %pattern%
    SQL_GLOB: "sql_glob",
    // SQLite GLOB: *pattern*
    EXACT: "exact",
    // Exact string match (full equality)
    CONTAINS: "contains"
    // Substring match (contains anywhere)
  };
  var SEARCH_FIELDS = {
    // Core fields
    TITLE: "title",
    ABSTRACT: "abstractNote",
    DATE: "date",
    DATE_ADDED: "dateAdded",
    DATE_MODIFIED: "dateModified",
    // Creator fields
    CREATOR_FIRST: "firstName",
    CREATOR_LAST: "lastName",
    CREATOR_FULL: "fullName",
    // Publication fields
    PUBLICATION: "publicationTitle",
    PUBLISHER: "publisher",
    VOLUME: "volume",
    ISSUE: "issue",
    PAGES: "pages",
    // Identifier fields
    DOI: "DOI",
    ISBN: "ISBN",
    ISSN: "ISSN",
    URL: "url",
    // Other fields
    TAGS: "tags",
    CALL_NUMBER: "callNumber",
    EXTRA: "extra",
    ITEM_TYPE: "itemType",
    // Collection/Search
    COLLECTION: "collection",
    SAVED_SEARCH: "savedSearch",
    // Notes
    NOTE: "note",
    CHILD_NOTE: "childNote",
    // Attachments
    ATTACHMENT_CONTENT: "attachmentContent",
    ATTACHMENT_FILE_TYPE: "attachmentFileType",
    // Annotations
    ANNOTATION_TEXT: "annotationText",
    ANNOTATION_COMMENT: "annotationComment",
    // Location fields (Books)
    PLACE: "place",
    ARCHIVE_LOCATION: "archiveLocation",
    LIBRARY_CATALOG: "libraryCatalog",
    // Item-type specific
    THESIS_TYPE: "thesisType",
    REPORT_TYPE: "reportType",
    VIDEO_FORMAT: "videoRecordingFormat",
    AUDIO_FILE_TYPE: "audioFileType",
    AUDIO_RECORDING_FORMAT: "audioRecordingFormat",
    LETTER_TYPE: "letterType",
    INTERVIEW_MEDIUM: "interviewMedium",
    MANUSCRIPT_TYPE: "manuscriptType",
    PRESENTATION_TYPE: "presentationType",
    MAP_TYPE: "mapType",
    ARTWORK_MEDIUM: "artworkMedium",
    PROGRAMMING_LANGUAGE: "programmingLanguage",
    // Special
    ANY_FIELD: "anyField"
  };
  var FIELDS_WITH_CONTAINS = [
    "title",
    "abstractNote",
    "publicationTitle",
    "publisher",
    "DOI",
    "ISBN",
    "ISSN",
    "url",
    "callNumber",
    "extra",
    "place",
    "archiveLocation",
    "libraryCatalog",
    "attachmentContent",
    "annotationText",
    "annotationComment"
  ];
  var ALL_DIALOG_FIELDS = [
    "title",
    "abstractNote",
    "date",
    "dateModified",
    "creator.lastName",
    "creator.firstName",
    "creator.fullName",
    "publicationTitle",
    "publisher",
    "volume",
    "issue",
    "pages",
    "DOI",
    "ISBN",
    "ISSN",
    "url",
    "callNumber",
    "extra",
    "itemType",
    "tags",
    "note",
    "place",
    "archiveLocation",
    "libraryCatalog"
  ];
  var ANY_FIELD_ALIASES = /* @__PURE__ */ new Set(["all", SEARCH_FIELDS.ANY_FIELD]);
  var DATE_FIELDS = /* @__PURE__ */ new Set(["date", "dateAdded", "dateModified"]);
  var NOTE_FIELDS = /* @__PURE__ */ new Set(["note", "childNote"]);
  var ITEM_TYPE_SPECIFIC_FIELDS = /* @__PURE__ */ new Set([
    "thesisType",
    "reportType",
    "videoRecordingFormat",
    "audioFileType",
    "audioRecordingFormat",
    "letterType",
    "interviewMedium",
    "manuscriptType",
    "presentationType",
    "mapType",
    "artworkMedium",
    "programmingLanguage"
  ]);
  var PHASE1_IS_FIELDS = /* @__PURE__ */ new Set(["itemType", "collection", "savedSearch", "volume", "issue", "pages", "attachmentFileType"]);
  var SearchResult = class {
    constructor(item, matchedFields = [], matchDetails = []) {
      this.item = item;
      this.itemID = item.id;
      this.itemKey = item.key;
      this.libraryID = item.libraryID;
      this.matchedFields = matchedFields;
      this.matchDetails = matchDetails;
    }
  };
  var SearchError = class extends Error {
    constructor(message, code) {
      super(message);
      this.name = "SearchError";
      this.code = code;
    }
  };
  var SearchEngine = class {
    constructor() {
      this.patternType = PATTERN_TYPES.REGEX;
    }
    // Validate regex pattern before search
    validatePattern(pattern, patternType) {
      if (patternType === PATTERN_TYPES.REGEX) {
        try {
          new RegExp(pattern);
        } catch (e) {
          throw new SearchError(`Invalid regex: ${e.message}`, "INVALID_REGEX");
        }
      }
    }
    // Convert regex to SQL LIKE pattern (basic escape)
    regexToSqlLike(pattern) {
      const escaped = pattern.replace(/([%_\\])/g, "\\$1");
      return `%${escaped}%`;
    }
    // Convert regex to SQL GLOB pattern
    regexToSqlGlob(pattern) {
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, "*").replace(/\\\?/g, "?");
      return `*${escaped}*`;
    }
    // Build a simpler search term for Phase 1 (Zotero "contains" search).
    // Returns null when we can't derive a safe literal prefilter.
    buildSearchTerm(pattern, patternType = PATTERN_TYPES.REGEX) {
      if (!pattern || typeof pattern !== "string") {
        return pattern;
      }
      if (patternType === PATTERN_TYPES.EXACT || patternType === PATTERN_TYPES.CONTAINS) {
        return pattern;
      }
      let searchTerm = pattern;
      if (this.isEmptyFieldPattern(pattern, patternType)) {
        return null;
      }
      if (patternType === PATTERN_TYPES.REGEX) {
        if (searchTerm.startsWith("^")) {
          searchTerm = searchTerm.slice(1);
        }
        if (searchTerm.endsWith("$")) {
          searchTerm = searchTerm.slice(0, -1);
        }
        searchTerm = searchTerm.replace(/\?\*/g, "*");
        searchTerm = searchTerm.replace(/\?\+/g, "+");
        searchTerm = searchTerm.replace(/\?\?/g, "?");
        searchTerm = searchTerm.replaceAll(/.\?/g, "");
        searchTerm = searchTerm.replaceAll(/\*\?/g, "");
        searchTerm = searchTerm.replaceAll(/\+\?/g, "");
      }
      const literals = searchTerm.match(/[a-zA-Z0-9]{2,}/g) || [];
      if (literals.length > 0) {
        return literals.reduce((a, b) => a.length >= b.length ? a : b);
      }
      return null;
    }
    isEmptyFieldPattern(pattern, patternType) {
      return patternType === PATTERN_TYPES.REGEX && typeof pattern === "string" && /^\^(?:\\s\*)?\$$/.test(pattern);
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
        return typeof match.index === "number" ? match.index : 0;
      }
      const haystack = caseSensitive ? value : value.toLowerCase();
      const needle = caseSensitive ? pattern : pattern.toLowerCase();
      return haystack.indexOf(needle);
    }
    getCreatorFullName(creator) {
      if (!creator) {
        return "";
      }
      const singleFieldName = creator.name == null ? "" : String(creator.name).trim();
      if (singleFieldName) {
        return singleFieldName;
      }
      return [creator.firstName, creator.lastName].filter((part) => part != null && String(part).trim() !== "").map((part) => String(part).trim()).join(" ");
    }
    getPhase1Term(pattern, patternType = PATTERN_TYPES.REGEX) {
      return this.buildSearchTerm(pattern, patternType);
    }
    getPhase1Candidate(conditions) {
      const candidates = conditions.filter((condition) => condition.operator !== "AND_NOT" && condition.operator !== "OR_NOT").filter((condition) => condition.pattern).filter((condition) => !(condition.patternType === PATTERN_TYPES.REGEX && condition.pattern.includes("|"))).map((condition) => ({
        condition,
        term: this.getPhase1Term(condition.pattern, condition.patternType || PATTERN_TYPES.REGEX)
      })).filter(({ condition, term }) => term !== null && this._canAddCondition(condition.field, condition.pattern, condition.patternType));
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
        search.addCondition(field, "is", pattern);
        return;
      }
      console.log("SearchReplace: Skipping unknown field:", field);
    }
    getPhase1ContainsField(field) {
      if (field === "tags") {
        return "tag";
      }
      if (field.startsWith("creator.")) {
        return "creator";
      }
      if (FIELDS_WITH_CONTAINS.includes(field)) {
        return field;
      }
      if (NOTE_FIELDS.has(field) || field === "attachmentContent" || field === "annotationText" || field === "annotationComment") {
        return field === "childNote" ? "note" : field;
      }
      return null;
    }
    addPhase1ContainsCondition(search, field, pattern, patternType) {
      const term = this.getPhase1Term(pattern, patternType);
      if (term === null) {
        return;
      }
      search.addCondition(field, "contains", term);
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
        progressCallback = () => {
        }
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
      const itemIDs = skipPhase1 ? await this.fetchAllItemIDs(libraryID, progressCallback) : await this.runPhase1Search(libraryID, phase1Candidate, progressCallback);
      if (itemIDs.length === 0) {
        return [];
      }
      return this.buildSearchResults(itemIDs, conditions, progressCallback);
    }
    normalizeSearchConditions(patternOrConditions, options = {}) {
      if (Array.isArray(patternOrConditions)) {
        return patternOrConditions;
      }
      if (typeof patternOrConditions !== "string") {
        return [];
      }
      return this.createLegacyConditions(patternOrConditions, options);
    }
    createLegacyConditions(pattern, options = {}) {
      const {
        fields = ["title", "abstractNote", "creator.lastName", "creator.firstName", "tags", "url"],
        patternType = PATTERN_TYPES.REGEX,
        caseSensitive = false
      } = options;
      const legacyFields = fields.length > 0 ? fields : ["title"];
      return legacyFields.map((field, index) => ({
        pattern,
        field,
        fields: legacyFields,
        patternType,
        caseSensitive,
        operator: index === 0 ? "AND" : "OR"
      }));
    }
    validateConditions(conditions) {
      for (const condition of conditions) {
        this.validatePattern(condition.pattern, condition.patternType || PATTERN_TYPES.REGEX);
      }
    }
    getConditionFields(conditions) {
      const allFields = [...new Set(conditions.map((condition) => condition.field).filter(Boolean))];
      return allFields.length > 0 ? allFields : ["title"];
    }
    shouldSkipPhase1(fields, conditions) {
      const PHASE1_FIELD_THRESHOLD = 5;
      if (fields.length > PHASE1_FIELD_THRESHOLD) {
        return true;
      }
      return conditions.some((condition) => condition.operator === "AND_NOT" || condition.operator === "OR_NOT");
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
      progressCallback({ phase: "filter", count: itemIDs.length });
      return itemIDs;
    }
    async fetchAllItemIDs(libraryID, progressCallback) {
      progressCallback({ phase: "filter", count: "fetching all items..." });
      const search = new Zotero.Search();
      search.libraryID = libraryID;
      const itemIDs = await search.search();
      progressCallback({ phase: "filter", count: itemIDs.length });
      return itemIDs;
    }
    async buildSearchResults(itemIDs, conditions, progressCallback) {
      const items = await Zotero.Items.getAsync(itemIDs);
      const results = [];
      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        progressCallback({ phase: "refine", current: index + 1, total: items.length });
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
      if (conditions.length === 1) {
        const c = conditions[0];
        const { matchedFields: matchedFields2, matchDetails: matchDetails2 } = this.matchItem(item, c.pattern, {
          fields: [c.field],
          patternType: c.patternType || PATTERN_TYPES.REGEX,
          caseSensitive: c.caseSensitive || false
        });
        return { matched: matchedFields2.length > 0, matchedFields: matchedFields2, matchDetails: matchDetails2 };
      }
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
      let matched = results[0];
      for (let i = 1; i < conditions.length; i++) {
        const operator = conditions[i].operator || "AND";
        const conditionMatched = results[i];
        if (operator === "AND") {
          matched = matched && conditionMatched;
        } else if (operator === "OR") {
          matched = matched || conditionMatched;
        } else if (operator === "AND_NOT") {
          matched = matched && !conditionMatched;
        } else if (operator === "OR_NOT") {
          matched = matched || !conditionMatched;
        }
      }
      return { matched, matchedFields, matchDetails };
    }
    // Check if a field can have a condition added (for Phase 1 filtering)
    _canAddCondition(field, pattern, patternType = PATTERN_TYPES.REGEX) {
      if (pattern === null) return false;
      if (ANY_FIELD_ALIASES.has(field)) return false;
      if (field === "tags") return this.getPhase1Term(pattern, patternType) !== null;
      if (field.startsWith("creator.")) return this.getPhase1Term(pattern, patternType) !== null;
      if (field === "date" || field === "dateAdded" || field === "dateModified") return false;
      if (FIELDS_WITH_CONTAINS.includes(field)) return this.getPhase1Term(pattern, patternType) !== null;
      if (field === "itemType") return true;
      if (field === "collection") return true;
      if (field === "note" || field === "childNote") return this.getPhase1Term(pattern, patternType) !== null;
      if (field === "volume" || field === "issue" || field === "pages") return true;
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
      if (field.startsWith("creator.")) {
        return this.matchCreatorField(item, field, pattern, patternType, caseSensitive, emptyFieldPattern);
      }
      if (field === "tags") {
        return this.matchTagsField(item, field, pattern, patternType, caseSensitive);
      }
      if (field === "itemType") {
        return this.matchItemTypeField(item, field, pattern, patternType, caseSensitive);
      }
      if (field === "collection") {
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
      const normalizedValue = value == null ? "" : String(value);
      if (emptyFieldPattern) {
        if (/^\s*$/.test(normalizedValue)) {
          return this.buildMatchDetail(field, normalizedValue, 0, normalizedValue.length);
        }
        return null;
      }
      if (value === null || value === void 0) {
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
      const creatorField = field.split(".")[1];
      for (const creator of creators) {
        const value = creatorField === "fullName" ? this.getCreatorFullName(creator) : creator[creatorField];
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
      if (typeof Zotero !== "undefined" && Zotero.ItemTypes) {
        const itemTypeName = Zotero.ItemTypes.getName(itemTypeID);
        if (itemTypeName) {
          return itemTypeName;
        }
      }
      return item.getField("itemType");
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
          this.buildMatchDetail(field, "collection:" + collectionID, 0, String(collectionID).length)
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
        const regex = new RegExp(pattern, caseSensitive ? "" : "i");
        return { match: regex.exec(str), regex };
      } catch {
        return { match: null, regex: null };
      }
    }
    testLikeValue(str, pattern, caseSensitive) {
      const likePattern = this.regexToSqlLike(pattern);
      const regex = new RegExp(
        likePattern.replace(/%/g, ".*").replace(/_/g, "."),
        caseSensitive ? "" : "i"
      );
      return { match: regex.exec(str), regex };
    }
    testGlobValue(str, pattern, caseSensitive) {
      const globPattern = this.regexToSqlGlob(pattern);
      const regex = new RegExp(
        "^" + globPattern.replaceAll("*", ".*").replaceAll("?", ".") + "$",
        caseSensitive ? "" : "i"
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
      const str = value == null ? "" : String(value);
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
  };
  var search_engine_default = SearchEngine;

  // src/zotero/replace-engine.js
  var PLACEHOLDER_PATTERN = /\$(\d+)|\$\{([^}]+)\}|\$<([^>]+)>|(\$\$|\$&|\$'|\$`|\$\+)/g;
  var ReplaceEngine = class {
    constructor() {
      this.placeholderPattern = PLACEHOLDER_PATTERN;
    }
    // Compile replacement pattern
    compileReplacePattern(pattern) {
      if (typeof pattern === "function") {
        return pattern;
      }
      if (typeof pattern !== "string" || !pattern.includes("$")) {
        return () => pattern;
      }
      return (match, ...args) => {
        let groups;
        if (args.length > 0) {
          const maybeGroups = args.at(-1);
          if (maybeGroups && typeof maybeGroups === "object" && !Array.isArray(maybeGroups)) {
            groups = args.pop();
          }
        }
        const input = args.pop() || "";
        const offset = args.pop() || 0;
        const captures = args;
        const lastCapture = [...captures].reverse().find((capture) => capture !== void 0) || "";
        return pattern.replace(this.placeholderPattern, (token, numericGroup, braceName, angleName, specialToken) => {
          if (numericGroup) {
            return captures[Number.parseInt(numericGroup, 10) - 1] || "";
          }
          const groupName = braceName || angleName;
          if (groupName) {
            return groups && groupName in groups ? groups[groupName] || "" : "";
          }
          switch (specialToken) {
            case "$$":
              return "$";
            case "$&":
              return match;
            case "$'":
              return input.slice(offset + match.length);
            case "$`":
              return input.slice(0, offset);
            case "$+":
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
      const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
      const countingRegex = new RegExp(regex.source, flags);
      let count = 0;
      let match = countingRegex.exec(value);
      while (match) {
        count += 1;
        if (match[0] === "") {
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
        return searchPatternOrConditions.filter((condition) => condition?.field && condition.pattern !== void 0).map((condition) => ({
          field: condition.field,
          pattern: condition.pattern,
          patternType: condition.patternType || options.patternType || "regex",
          caseSensitive: condition.caseSensitive || false
        }));
      }
      const { fields = [], patternType = "regex", caseSensitive = false } = options;
      return fields.filter(Boolean).map((field) => ({ field, pattern: searchPatternOrConditions, patternType, caseSensitive }));
    }
    joinCreatorNameParts(firstName, lastName) {
      return [firstName, lastName].filter((part) => part != null && String(part).trim() !== "").map((part) => String(part).trim()).join(" ");
    }
    getCreatorFullName(creator) {
      if (!creator) {
        return "";
      }
      const singleFieldName = creator.name == null ? "" : String(creator.name).trim();
      if (singleFieldName) {
        return singleFieldName;
      }
      return this.joinCreatorNameParts(creator.firstName, creator.lastName);
    }
    splitCreatorFullName(value, creator) {
      const trimmedValue = value == null ? "" : String(value).trim();
      if (!trimmedValue) {
        return { firstName: "", lastName: "" };
      }
      const commaIndex = trimmedValue.indexOf(",");
      if (commaIndex !== -1) {
        return {
          lastName: trimmedValue.slice(0, commaIndex).trim(),
          firstName: trimmedValue.slice(commaIndex + 1).trim()
        };
      }
      const originalFirst = creator.firstName == null ? "" : String(creator.firstName).trim();
      const originalLast = creator.lastName == null ? "" : String(creator.lastName).trim();
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
          firstName: words.slice(0, words.length - lastNameWordCount).join(" "),
          lastName: words.slice(words.length - lastNameWordCount).join(" ")
        };
      }
      return { firstName: "", lastName: trimmedValue };
    }
    applyReplaceToCreatorFullName(creator, fieldConditions, replacePattern) {
      const originalFullName = this.getCreatorFullName(creator);
      const { result, replacements } = this.applyConditionsToValue(originalFullName, fieldConditions, replacePattern);
      if (replacements === 0 || result === originalFullName) {
        return false;
      }
      const singleFieldName = creator.name == null ? "" : String(creator.name).trim();
      const originalFirst = creator.firstName == null ? "" : String(creator.firstName);
      const originalLast = creator.lastName == null ? "" : String(creator.lastName);
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
      let result = value == null ? "" : String(value);
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
      const creatorField = field.split(".")[1];
      for (const creator of modifiedCreators) {
        if (creatorField === "fullName") {
          if (this.applyReplaceToCreatorFullName(creator, fieldConditions, replacePattern)) {
            changed = true;
          }
          continue;
        }
        const value = creator[creatorField];
        const originalValue = value == null ? "" : String(value);
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
      const originalValue = original == null ? "" : String(original);
      const { result, replacements } = this.applyConditionsToValue(originalValue, fieldConditions, replacePattern);
      if (replacements === 0 || result === originalValue) {
        return null;
      }
      return { field, original: originalValue, replaced: result };
    }
    // Apply replace to a single value
    applyReplace(value, searchPattern, replacePattern, options = {}) {
      const { patternType = "regex", caseSensitive = false } = options;
      const str = value == null ? "" : String(value);
      if (patternType === "regex") {
        return this.applyRegexPattern(str, new RegExp(searchPattern, caseSensitive ? "g" : "gi"), replacePattern);
      }
      if (patternType === "exact") {
        const exactRegex = new RegExp(`^${this.escapeRegExp(searchPattern)}$`, caseSensitive ? "" : "i");
        return this.applyRegexPattern(str, exactRegex, replacePattern);
      }
      const literalRegex = new RegExp(this.escapeRegExp(searchPattern), caseSensitive ? "g" : "gi");
      return this.applyRegexPattern(str, literalRegex, replacePattern);
    }
    // Preview replace on an item (no save)
    previewReplace(item, searchPatternOrConditions, replacePattern, options = {}) {
      const conditions = this.normalizeConditions(searchPatternOrConditions, options);
      const changes = [];
      const conditionsByField = /* @__PURE__ */ new Map();
      for (const condition of conditions) {
        if (!conditionsByField.has(condition.field)) {
          conditionsByField.set(condition.field, []);
        }
        conditionsByField.get(condition.field).push(condition);
      }
      for (const [field, fieldConditions] of conditionsByField.entries()) {
        const change = field.startsWith("creator.") ? this.previewCreatorField(item, field, fieldConditions, replacePattern) : this.previewStandardField(item, field, fieldConditions, replacePattern);
        if (change) {
          changes.push(change);
        }
      }
      return changes;
    }
    // Apply replace to item (with save)
    async applyReplaceToItem(item, searchPatternOrConditions, replacePattern, options = {}) {
      const { progressCallback = () => {
      } } = options;
      const changes = this.previewReplace(item, searchPatternOrConditions, replacePattern, options);
      if (changes.length === 0) {
        return { success: true, changes: [], message: "No changes needed" };
      }
      for (const change of changes) {
        progressCallback({ itemID: item.id, field: change.field });
        if (change.field.startsWith("creator.")) {
          const creators = item.getCreators();
          const newCreators = JSON.parse(change.replaced);
          item.setCreators(newCreators);
        } else {
          item.setField(change.field, change.replaced);
        }
      }
      try {
        await item.saveTx();
        return { success: true, changes, message: "Saved successfully" };
      } catch (e) {
        return { success: false, changes, message: e.message };
      }
    }
    // Batch process items
    async processItems(items, searchPatternOrConditions, replacePattern, options = {}) {
      const { progressCallback = () => {
      } } = options;
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
  };
  var replace_engine_default = ReplaceEngine;

  // src/zotero/progress-manager.js
  var ProgressManager = class {
    constructor(window2) {
      this.window = window2;
      this.dialog = null;
      this.progressMeter = null;
      this.statusLabel = null;
      this.canceled = false;
    }
    // Open progress dialog
    open(title, totalItems) {
      this.canceled = false;
      this.dialog = this.window.openDialog(
        "chrome://zotero-search-replace/content/progress.xul",
        "progress",
        "modal,titlebar,centerscreen",
        { title, total: totalItems }
      );
      return this.dialog;
    }
    // Open HTML progress dialog (for Zotero 7+)
    openHTML(title, totalItems) {
      this.canceled = false;
      this.dialog = this.window.openDialog(
        "chrome://zotero-search-replace/content/progress.html",
        "progress",
        "modal,titlebar,centerscreen,width=400,height=200",
        { title, total: totalItems }
      );
      return this.dialog;
    }
    // Update progress
    update(current, status) {
      if (!this.dialog || this.canceled) return false;
      try {
        if (this.progressMeter) {
          const percent = Math.round(current / this.dialog.arguments.total * 100);
          this.progressMeter.value = percent;
        }
        if (this.statusLabel && status) {
          this.statusLabel.value = status;
        }
        if (this.window.setTimeout) {
          this.window.setTimeout(() => {
          }, 0);
        }
      } catch (e) {
        return false;
      }
      return !this.canceled;
    }
    // Update from HTML dialog via postMessage
    updateFromMessage(data) {
      if (!this.dialog || this.canceled) return false;
      try {
        if (data.type === "progress" && this.progressMeter) {
          this.progressMeter.value = data.percent;
        }
        if (data.type === "progress" && this.statusLabel && data.status) {
          this.statusLabel.value = data.status;
        }
        if (data.type === "complete") {
          this.canceled = true;
        }
      } catch (e) {
        return false;
      }
      return !this.canceled;
    }
    // Close dialog
    close() {
      if (this.dialog) {
        try {
          this.dialog.close();
        } catch (e) {
        }
        this.dialog = null;
      }
    }
    // Cancel operation
    cancel() {
      this.canceled = true;
    }
  };
  var progress_manager_default = ProgressManager;

  // src/patterns/quality-patterns.js
  var PATTERN_CATEGORIES = [
    "Parsing Errors",
    "Capitalization",
    "Diacritics",
    "Data Quality",
    "Classification"
  ];
  var DATA_QUALITY_PATTERNS = [
    // === Parsing Errors ===
    {
      id: "fix-jr-suffix",
      name: "Fix: Move Jr/Sr Suffix",
      description: 'Moves "Jr" from given name to surname',
      conditions: [
        { operator: "OR", field: "creator.lastName", pattern: "(.+), (Jr|Sr|III|II|IV)$", patternType: "regex" },
        { operator: "OR", field: "creator.firstName", pattern: "(.+), (Jr|Sr|III|II|IV)$", patternType: "regex" }
      ],
      replace: "$2, $1",
      category: "Parsing Errors"
    },
    {
      id: "fix-double-comma",
      name: "Fix: Double Commas",
      description: "Removes duplicate commas in author names",
      conditions: [
        { operator: "OR", field: "creator.lastName", pattern: ",,", patternType: "regex" },
        { operator: "OR", field: "creator.firstName", pattern: ",,", patternType: "regex" }
      ],
      replace: ",",
      category: "Parsing Errors"
    },
    {
      id: "fix-trailing-comma",
      name: "Fix: Trailing Comma",
      description: "Removes trailing comma at end of name",
      conditions: [
        { field: "creator.lastName", pattern: ",$", patternType: "regex" }
      ],
      replace: "",
      category: "Parsing Errors"
    },
    {
      id: "find-spurious-dot",
      name: "Find: Spurious Dot in Given Name",
      description: 'Finds spurious dots after given names (e.g., "John." instead of "John")',
      conditions: [
        { field: "creator.firstName", pattern: "([a-z]{2,})\\.$", patternType: "regex" }
      ],
      replace: "$1",
      category: "Parsing Errors"
    },
    {
      id: "remove-parens",
      name: "Remove: Nicknames in Parens",
      description: 'Removes "(nickname)" from names',
      conditions: [
        { operator: "OR", field: "creator.firstName", pattern: "\\s*\\([^)]+\\)\\s*", patternType: "regex" },
        { operator: "OR", field: "creator.lastName", pattern: "\\s*\\([^)]+\\)\\s*", patternType: "regex" }
      ],
      replace: "",
      category: "Data Quality"
    },
    {
      id: "fix-whitespace-colon",
      name: "Fix: Whitespace Before Colon",
      description: "Removes whitespace before colons (all fields)",
      conditions: [
        { field: "all", pattern: "\\s+:", patternType: "regex" }
      ],
      replace: ":",
      category: "Parsing Errors"
    },
    {
      id: "fix-whitespace-semicolon",
      name: "Fix: Whitespace Before Semicolon",
      description: "Removes whitespace before semicolons (all fields)",
      conditions: [
        { field: "all", pattern: "\\s+;", patternType: "regex" }
      ],
      replace: ";",
      category: "Parsing Errors"
    },
    {
      id: "fix-missing-space-paren",
      name: "Fix: Missing Space Before (",
      description: "Adds space before opening parenthesis (all fields)",
      conditions: [
        { field: "all", pattern: "([a-z])\\(", patternType: "regex" }
      ],
      replace: "$1 (",
      category: "Parsing Errors"
    },
    // === Capitalization ===
    {
      id: "lowercase-van-de",
      name: "Normalize: Dutch Prefixes",
      description: "Ensures van/de prefixes stay lowercase",
      conditions: [
        { field: "creator.lastName", pattern: "\\b(Van|De|Van Der|De La)\\b", patternType: "regex" }
      ],
      replace: (match) => match.toLowerCase(),
      category: "Capitalization"
    },
    {
      id: "lowercase-von",
      name: "Normalize: German von",
      description: "Ensures von prefix stays lowercase",
      conditions: [
        { field: "creator.lastName", pattern: "\\bVon\\b", patternType: "regex" }
      ],
      replace: "von",
      category: "Capitalization"
    },
    {
      id: "normalize-mc",
      name: "Normalize: Mc Prefix",
      description: "Fixes MCCULLOCH -> McCulloch and McDonald -> McDonald",
      conditions: [
        { field: "creator.lastName", pattern: "\\b[Mm][Cc][A-Za-z]*", patternType: "regex" }
      ],
      replace: (m) => m.charAt(0).toUpperCase() + m.charAt(1).toLowerCase() + m.slice(2).charAt(0).toUpperCase() + m.slice(3).toLowerCase(),
      category: "Capitalization"
    },
    {
      id: "normalize-mac",
      name: "Normalize: Mac Prefix",
      description: "Fixes MACDONALD -> MacDonald",
      conditions: [
        { field: "creator.lastName", pattern: "\\b[Mm][Aa][Cc][A-Za-z]*", patternType: "regex" }
      ],
      replace: (m) => m.charAt(0).toUpperCase() + m.slice(1, 3).toLowerCase() + m.slice(3, 4).toUpperCase() + m.slice(4).toLowerCase(),
      category: "Capitalization"
    },
    // === Diacritics ===
    {
      id: "fix-polish-diacritics",
      name: "Restore: Polish Diacritics",
      description: "Fixes BibTeX-encoded Polish diacritics (l/\u2192\u0142, n/\u2192\u0144, s/\u2192\u015B)",
      conditions: [
        { field: "all", pattern: "l/", patternType: "regex" }
      ],
      replace: "\u0142",
      category: "Diacritics"
    },
    {
      id: "fix-german-diacritics",
      name: "Restore: German Diacritics",
      description: 'Fixes German umlauts from stripped characters (a"\u2192\xE4, o"\u2192\xF6, u"\u2192\xFC, e"\u2192\xEB)',
      conditions: [
        { field: "all", pattern: 'a"', patternType: "regex" }
      ],
      replace: "\xE4",
      category: "Diacritics"
    },
    {
      id: "fix-german-eszett",
      name: "Restore: German Eszett",
      description: "Fixes \xDF from ss (BibTeX strips \xDF to ss)",
      conditions: [
        { operator: "OR", field: "creator.lastName", pattern: "ss(?=[a-zA-Z]|$)", patternType: "regex" },
        { operator: "OR", field: "creator.firstName", pattern: "ss(?=[a-zA-Z]|$)", patternType: "regex" },
        { operator: "OR", field: "title", pattern: "ss(?=[a-zA-Z]|$)", patternType: "regex" }
      ],
      replace: "\xDF",
      category: "Diacritics"
    },
    // === Data Quality ===
    {
      id: "find-empty-creators",
      name: "Find: Empty Creator Fields",
      description: "Find items with missing creator names (empty lastName OR empty firstName)",
      conditions: [
        { operator: "OR", field: "creator.lastName", pattern: "^$", patternType: "regex" },
        { operator: "OR", field: "creator.firstName", pattern: "^$", patternType: "regex" }
      ],
      replace: "",
      category: "Data Quality"
    },
    {
      id: "find-empty-titles",
      name: "Find: Empty Titles",
      description: "Find items with missing or empty titles",
      conditions: [
        { field: "title", pattern: "^\\s*$", patternType: "regex" }
      ],
      replace: "",
      category: "Data Quality"
    },
    {
      id: "fix-url-http",
      name: "Normalize: HTTP to HTTPS",
      description: "Updates URLs from http:// to https://",
      conditions: [
        { field: "url", pattern: "http://", patternType: "regex" }
      ],
      replace: "https://",
      category: "Data Quality"
    },
    {
      id: "remove-all-urls",
      name: "Remove: All URLs",
      description: "Removes all URLs from the URL field",
      conditions: [
        { field: "url", pattern: ".+", patternType: "regex" }
      ],
      replace: "",
      category: "Data Quality"
    },
    {
      id: "remove-google-books-urls",
      name: "Remove: Google Books URLs",
      description: "Removes Google Books URLs from books (books.google.com)",
      conditions: [
        { field: "url", pattern: "https?://books\\.google\\.com/[^\\s]*", patternType: "regex" }
      ],
      secondCondition: { field: "itemType", pattern: "book" },
      replace: "",
      category: "Data Quality"
    },
    {
      id: "remove-worldcat-urls",
      name: "Remove: WorldCat URLs",
      description: "Removes WorldCat URLs from books (www.worldcat.org)",
      conditions: [
        { field: "url", pattern: "https?://www\\.worldcat\\.org/[^\\s]*", patternType: "regex" }
      ],
      secondCondition: { field: "itemType", pattern: "book" },
      replace: "",
      category: "Data Quality"
    },
    // === Classification ===
    {
      id: "find-corporate-authors",
      name: "Find: Corporate Authors",
      description: "Find likely corporate/group authors in person fields",
      conditions: [
        { field: "creator.lastName", pattern: "\\s+(Collaborators|Group|Association|Institute|Center|Society|Journal|Proceedings)\\s*$", patternType: "regex" }
      ],
      replace: "",
      category: "Classification"
    },
    {
      id: "find-journal-in-author",
      name: "Find: Journal Name in Author",
      description: "Find items where journal name appears as author",
      conditions: [
        { field: "creator.lastName", pattern: "(Journal|Review|Proceedings|Transactions)", patternType: "regex" }
      ],
      replace: "",
      category: "Classification"
    }
  ];

  // src/ui/search-dialog.js
  var SearchDialog = class {
    static open() {
      const mainWindow = Services.wm.getMostRecentWindow("navigator:browser");
      const dialogArgs = {
        patterns: mainWindow.ZoteroSearchReplace?.DATA_QUALITY_PATTERNS || []
      };
      return mainWindow.openDialog(
        "chrome://zotero-search-replace/content/dialog.html",
        "zotero-search-replace-dialog",
        "chrome,centerscreen,resizable=yes,width=800,height=600",
        dialogArgs
      );
    }
  };
  var search_dialog_default = SearchDialog;

  // src/index.js
  if (typeof console === "undefined") {
    globalThis.console = {
      log: function(...args) {
        if (typeof Zotero !== "undefined" && Zotero.debug) {
          Zotero.debug("SearchReplace: " + args.join(" "));
        }
      },
      warn: function(...args) {
        if (typeof Zotero !== "undefined" && Zotero.debug) {
          Zotero.debug("SearchReplace WARN: " + args.join(" "));
        }
      },
      error: function(...args) {
        if (typeof Zotero !== "undefined" && Zotero.debug) {
          Zotero.debug("SearchReplace ERROR: " + args.join(" "));
        }
      },
      info: function(...args) {
        if (typeof Zotero !== "undefined" && Zotero.debug) {
          Zotero.debug("SearchReplace INFO: " + args.join(" "));
        }
      },
      debug: function(...args) {
        if (typeof Zotero !== "undefined" && Zotero.debug) {
          Zotero.debug("SearchReplace DEBUG: " + args.join(" "));
        }
      }
    };
  }
  var ZoteroSearchReplace = {
    SearchEngine: search_engine_default,
    ReplaceEngine: replace_engine_default,
    ProgressManager: progress_manager_default,
    DATA_QUALITY_PATTERNS,
    PATTERN_CATEGORIES,
    SearchDialog: search_dialog_default,
    hooks: {
      onStartup: () => {
        if (typeof Zotero !== "undefined" && Zotero.NameNormalizer && Zotero.NameNormalizer.MenuIntegration) {
        }
        console.log("Search & Replace: Plugin started");
      },
      onShutdown: () => {
        console.log("Search & Replace: Plugin shutting down");
      }
    },
    initialized: true
  };
  var index_default = ZoteroSearchReplace;
  if (typeof window !== "undefined") {
    window.ZoteroSearchReplace = ZoteroSearchReplace;
  } else if (typeof globalThis !== "undefined") {
    globalThis.ZoteroSearchReplace = ZoteroSearchReplace;
  }
})();

// Export ZoteroSearchReplace to scope for loadSubScript
var ZoteroSearchReplaceRef = typeof ZoteroSearchReplace !== 'undefined'
  ? ZoteroSearchReplace
  : (typeof window !== 'undefined' ? window.ZoteroSearchReplace : null) ||
    (typeof globalThis !== 'undefined' ? globalThis.ZoteroSearchReplace : null);

if (ZoteroSearchReplaceRef) {
  var targetScope = (typeof __zotero_scope__ !== 'undefined' && __zotero_scope__)
    ? __zotero_scope__
    : (typeof globalThis !== 'undefined' ? globalThis.__zotero_scope__ : null);
  if (targetScope) {
    targetScope.ZoteroSearchReplace = ZoteroSearchReplaceRef;
    // Also set Zotero.SearchReplace if Zotero exists in scope
    if (targetScope.Zotero) {
      targetScope.Zotero.SearchReplace = ZoteroSearchReplaceRef;
    }
  }
  if (typeof window !== 'undefined') window.ZoteroSearchReplace = ZoteroSearchReplaceRef;
  if (typeof globalThis !== 'undefined') globalThis.ZoteroSearchReplace = ZoteroSearchReplaceRef;
  // Also set Zotero.SearchReplace globally if Zotero exists
  if (typeof Zotero !== 'undefined' && Zotero) {
    Zotero.SearchReplace = ZoteroSearchReplaceRef;
  }
}

