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
    // Build a simpler search term for Phase 1 (Zotero "contains" search)
    // For regex patterns, we try to extract a simple literal substring for initial filtering
    // Returns null to signal that Phase 1 should be skipped (for empty-field patterns like ^$)
    buildSearchTerm(pattern) {
      if (!pattern || typeof pattern !== "string") {
        return pattern;
      }
      let searchTerm = pattern;
      if (/^\^?\$?\s*\$?$/.test(pattern) || /^\^\\s*\$/.test(pattern)) {
        return null;
      }
      if (searchTerm.startsWith("^")) {
        searchTerm = searchTerm.slice(1);
      }
      if (searchTerm.endsWith("$")) {
        searchTerm = searchTerm.slice(0, -1);
      }
      searchTerm = searchTerm.replace(/\?\*/g, "*");
      searchTerm = searchTerm.replace(/\?\+/g, "+");
      searchTerm = searchTerm.replace(/\?\?/g, "?");
      searchTerm = searchTerm.replace(/.\?/g, "");
      searchTerm = searchTerm.replace(/\*\?/g, "");
      searchTerm = searchTerm.replace(/\+\?/g, "");
      const literals = searchTerm.match(/[a-zA-Z0-9]{2,}/g) || [];
      if (literals.length > 0) {
        return literals.reduce((a, b) => a.length >= b.length ? a : b);
      }
      let cleanPattern = searchTerm;
      if (cleanPattern.startsWith("^")) cleanPattern = cleanPattern.slice(1);
      if (cleanPattern.endsWith("$")) cleanPattern = cleanPattern.slice(0, -1);
      return cleanPattern || pattern;
    }
    // Add search condition for a field
    addSearchCondition(search, field, pattern) {
      if (pattern === null) {
        return;
      }
      if (field === "tags") {
        search.addCondition("tag", "contains", pattern);
        return;
      }
      if (field.startsWith("creator.")) {
        const term = this.buildSearchTerm(pattern);
        if (term === null) return;
        search.addCondition("creator", "contains", term);
        return;
      }
      if (field === "date" || field === "dateAdded" || field === "dateModified") {
        return;
      }
      if (FIELDS_WITH_CONTAINS.includes(field)) {
        const term = this.buildSearchTerm(pattern);
        if (term === null) return;
        search.addCondition(field, "contains", term);
        return;
      }
      if (field === "itemType") {
        search.addCondition("itemType", "is", pattern);
        return;
      }
      if (field === "collection") {
        search.addCondition("collection", "is", pattern);
        return;
      }
      if (field === "savedSearch") {
        search.addCondition("savedSearch", "is", pattern);
        return;
      }
      if (field === "note" || field === "childNote") {
        search.addCondition("note", "contains", pattern);
        return;
      }
      if (field === "volume" || field === "issue" || field === "pages") {
        search.addCondition(field, "is", pattern);
        return;
      }
      if (field === "attachmentContent") {
        search.addCondition("attachmentContent", "contains", pattern);
        return;
      }
      if (field === "attachmentFileType") {
        search.addCondition("attachmentFileType", "is", pattern);
        return;
      }
      if (field === "annotationText" || field === "annotationComment") {
        search.addCondition(field, "contains", pattern);
        return;
      }
      const itemTypeFields = [
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
      ];
      if (itemTypeFields.includes(field)) {
        return;
      }
      console.log("SearchReplace: Skipping unknown field:", field);
    }
    // Main search method - TWO PHASE
    // Supports either single pattern (backward compatible) or array of conditions
    async search(patternOrConditions, options = {}) {
      let conditions = [];
      if (Array.isArray(patternOrConditions)) {
        conditions = patternOrConditions;
      } else if (typeof patternOrConditions === "string") {
        const {
          fields: fields2 = ["title", "abstractNote", "creator.lastName", "creator.firstName", "tags", "url"],
          patternType = PATTERN_TYPES.REGEX,
          caseSensitive = false
        } = options;
        conditions = [{
          pattern: patternOrConditions,
          field: fields2[0] || "title",
          fields: fields2,
          patternType,
          caseSensitive,
          operator: "AND"
          // First condition, implicit AND
        }];
      }
      if (conditions.length === 0) {
        return [];
      }
      const {
        libraryID = Zotero.Libraries.userLibraryID,
        progressCallback = () => {
        }
      } = options;
      for (const condition of conditions) {
        this.validatePattern(condition.pattern, condition.patternType || PATTERN_TYPES.REGEX);
      }
      const allFields = [...new Set(conditions.map((c) => c.field).filter((f) => f))];
      const fields = allFields.length > 0 ? allFields : ["title"];
      const PHASE1_FIELD_THRESHOLD = 5;
      let skipPhase1 = fields.length > PHASE1_FIELD_THRESHOLD;
      const hasNotConditions = conditions.some((c) => c.operator === "AND_NOT" || c.operator === "OR_NOT");
      if (hasNotConditions) {
        skipPhase1 = true;
      }
      let itemIDs = [];
      if (!skipPhase1) {
        const search = new Zotero.Search();
        search.libraryID = libraryID;
        const phase1Condition = conditions.find(
          (c) => c.operator !== "AND_NOT" && c.operator !== "OR_NOT" && c.pattern && !c.pattern.includes("|")
        );
        if (phase1Condition && this._canAddCondition(phase1Condition.field, phase1Condition.pattern)) {
          this.addSearchCondition(search, phase1Condition.field, phase1Condition.pattern);
          itemIDs = await search.search();
          progressCallback({ phase: "filter", count: itemIDs.length });
          if (itemIDs.length === 0) {
            return [];
          }
        } else {
          skipPhase1 = true;
        }
      }
      if (skipPhase1) {
        progressCallback({ phase: "filter", count: "fetching all items..." });
        const search = new Zotero.Search();
        search.libraryID = libraryID;
        itemIDs = await search.search();
        progressCallback({ phase: "filter", count: itemIDs.length });
        if (itemIDs.length === 0) {
          return [];
        }
      }
      const items = await Zotero.Items.getAsync(itemIDs);
      const results = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        progressCallback({ phase: "refine", current: i + 1, total: items.length });
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
      let allMatched = true;
      let anyMatched = false;
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
        if (!conditionMatched) {
          allMatched = false;
        }
        if (conditionMatched) {
          anyMatched = true;
        }
      }
      let matched = false;
      const positiveConditions = conditions.filter((c) => c.operator !== "AND_NOT" && c.operator !== "OR_NOT");
      const notConditions = conditions.filter((c) => c.operator === "AND_NOT" || c.operator === "OR_NOT");
      const positiveResults = results.slice(0, positiveConditions.length);
      const anyPositiveMatched = positiveResults.some((r) => r);
      let notMatched = false;
      for (let i = 0; i < notConditions.length; i++) {
        const notIdx = positiveConditions.length + i;
        if (results[notIdx]) {
          notMatched = true;
          break;
        }
      }
      const firstOp = conditions[0].operator || "AND";
      const allPositiveMatched = positiveResults.every((r) => r);
      if (firstOp === "AND") {
        matched = allPositiveMatched && !notMatched;
      } else if (firstOp === "OR") {
        matched = anyPositiveMatched && !notMatched;
      } else if (firstOp === "AND_NOT") {
        matched = allMatched && !results[0];
      } else if (firstOp === "OR_NOT") {
        matched = (anyMatched || allMatched) && !results[0];
      }
      return { matched, matchedFields, matchDetails };
    }
    // Check if a field can have a condition added (for Phase 1 filtering)
    _canAddCondition(field, pattern) {
      if (pattern === null) return false;
      if (field === "tags") return true;
      if (field.startsWith("creator.")) return true;
      if (field === "date" || field === "dateAdded" || field === "dateModified") return false;
      if (FIELDS_WITH_CONTAINS.includes(field)) return true;
      if (field === "itemType") return true;
      if (field === "collection") return true;
      if (field === "note" || field === "childNote") return true;
      if (field === "volume" || field === "issue" || field === "pages") return true;
      return false;
    }
    // Match item against pattern
    matchItem(item, pattern, options = {}) {
      const { fields, patternType, caseSensitive = false } = options;
      const matchedFields = [];
      const matchDetails = [];
      for (const field of fields) {
        let value;
        if (field.startsWith("creator.")) {
          const creators = item.getCreators();
          if (!creators || creators.length === 0) continue;
          const creatorField = field.split(".")[1];
          for (const creator of creators) {
            if (creatorField === "fullName") {
              value = creator.name;
            } else {
              value = creator[creatorField];
            }
            if (patternType === PATTERN_TYPES.REGEX && pattern === "^$") {
              if (!value || value === "") {
                matchedFields.push(field);
                matchDetails.push({ field, value: "", matchIndex: 0, matchLength: 0 });
                break;
              }
              continue;
            }
            const { match } = this.testValue(value, pattern, patternType, caseSensitive);
            if (value && match !== null) {
              matchedFields.push(field);
              const matchLength = patternType === PATTERN_TYPES.EXACT || patternType === PATTERN_TYPES.CONTAINS ? match ? pattern.length : 0 : match.length || String(value).length;
              const matchIndex = patternType === PATTERN_TYPES.EXACT || patternType === PATTERN_TYPES.REGEX || patternType === PATTERN_TYPES.CONTAINS ? patternType === PATTERN_TYPES.EXACT ? 0 : match ? value.indexOf(pattern) : 0 : 0;
              matchDetails.push({ field, value, matchIndex, matchLength });
              break;
            }
          }
        } else if (field === "tags") {
          const tags = item.getTags();
          for (const tag of tags) {
            const { match } = this.testValue(tag.name, pattern, patternType, caseSensitive);
            if (match !== null) {
              matchedFields.push(field);
              matchDetails.push({ field, value: tag.name, matchIndex: -1, matchLength: -1 });
              break;
            }
          }
        } else if (field === "itemType") {
          const itemTypeID = item.itemTypeID;
          let itemTypeName = null;
          if (typeof Zotero !== "undefined" && Zotero.ItemTypes) {
            itemTypeName = Zotero.ItemTypes.getName(itemTypeID);
          }
          if (!itemTypeName) {
            itemTypeName = item.getField("itemType");
          }
          const { match } = this.testValue(itemTypeName, pattern, patternType, caseSensitive);
          if (match !== null) {
            matchedFields.push(field);
            matchDetails.push({ field, value: itemTypeName, matchIndex: 0, matchLength: itemTypeName.length });
          }
        } else if (field === "collection") {
          const collectionID = parseInt(pattern, 10);
          if (!isNaN(collectionID)) {
            try {
              const collections = item.getCollections();
              if (collections && collections.includes(collectionID)) {
                matchedFields.push(field);
                matchDetails.push({ field, value: "collection:" + collectionID, matchIndex: 0, matchLength: String(collectionID).length });
              }
            } catch (e) {
            }
          }
        } else {
          try {
            value = item.getField(field);
          } catch (e) {
            continue;
          }
          if (patternType === PATTERN_TYPES.REGEX && pattern === "^$") {
            if (!value || value === "") {
              matchedFields.push(field);
              matchDetails.push({ field, value: "", matchIndex: 0, matchLength: 0 });
              continue;
            }
          }
          const { match } = this.testValue(value, pattern, patternType, caseSensitive);
          if (value && match !== null) {
            matchedFields.push(field);
            const matchLength = patternType === PATTERN_TYPES.EXACT || patternType === PATTERN_TYPES.CONTAINS ? match ? pattern.length : 0 : match.length || String(value).length;
            const matchIndex = patternType === PATTERN_TYPES.EXACT || patternType === PATTERN_TYPES.REGEX || patternType === PATTERN_TYPES.CONTAINS ? patternType === PATTERN_TYPES.EXACT ? 0 : match ? value.indexOf(pattern) : 0 : 0;
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
            const regex = new RegExp(pattern, caseSensitive ? "" : "i");
            return { match: regex.exec(str), regex };
          } catch (e) {
            return { match: null, regex: null };
          }
        case PATTERN_TYPES.LIKE:
        case PATTERN_TYPES.SQL_LIKE:
          const likePattern = this.regexToSqlLike(pattern);
          const regexFromLike = new RegExp(
            likePattern.replace(/%/g, ".*").replace(/_/g, "."),
            caseSensitive ? "" : "i"
          );
          return { match: regexFromLike.exec(str), regex: regexFromLike };
        case PATTERN_TYPES.GLOB:
        case PATTERN_TYPES.SQL_GLOB:
          const globPattern = this.regexToSqlGlob(pattern);
          const globRegex = new RegExp(
            "^" + globPattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
            caseSensitive ? "" : "i"
          );
          return { match: globRegex.exec(str), regex: globRegex };
        case PATTERN_TYPES.EXACT:
          const exactMatch = caseSensitive ? str === pattern ? str : null : str.toLowerCase() === pattern.toLowerCase() ? str : null;
          return { match: exactMatch, regex: null };
        case PATTERN_TYPES.CONTAINS:
          const containsMatch = caseSensitive ? str.includes(pattern) ? pattern : null : str.toLowerCase().includes(pattern.toLowerCase()) ? pattern : null;
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
  };
  var search_engine_default = SearchEngine;

  // src/zotero/replace-engine.js
  var PLACEHOLDER_PATTERN = /\$(\d+)|\$\{([^}]+)\}|(\$&|\$\'|\$\`|\$\+)/g;
  var ReplaceEngine = class {
    constructor() {
      this.placeholderPattern = PLACEHOLDER_PATTERN;
    }
    // Compile replacement pattern
    compileReplacePattern(pattern) {
      if (typeof pattern === "function") {
        return pattern;
      }
      const hasNumericPlaceholder = /\$(\d+)/.test(pattern);
      const hasNamedPlaceholder = pattern.includes("${");
      const hasSpecialPlaceholder = /\$&|\$\'|\$\+/.test(pattern);
      if (!hasNumericPlaceholder && !hasNamedPlaceholder && !hasSpecialPlaceholder) {
        return () => pattern;
      }
      const hasDollarAmpersand = pattern.includes("$&");
      const hasDollarQuote = pattern.includes("$'");
      const hasDollarPlus = pattern.includes("$+");
      return (match, p1, p2, p3, offset, input) => {
        if (hasDollarAmpersand) return match;
        if (hasDollarQuote) return input.substring(offset + match.length);
        if (hasDollarPlus) return p1 !== void 0 ? p1 : match;
        if (hasNumericPlaceholder) {
          const groups = [p1, p2, p3];
          return pattern.replace(/\$(\d+)/g, (match2, num) => {
            const index = parseInt(num, 10);
            return index > 0 && index <= groups.length && groups[index - 1] !== void 0 ? groups[index - 1] : match2;
          });
        }
        if (hasNamedPlaceholder && p2 !== void 0) {
          return p2;
        }
        return pattern;
      };
    }
    // Apply replace to a single value
    applyReplace(value, searchPattern, replacePattern, options = {}) {
      const { patternType = "regex", caseSensitive = false } = options;
      const str = String(value);
      if (patternType === "regex") {
        const regex = new RegExp(searchPattern, caseSensitive ? "g" : "gi");
        const matches = str.match(regex) || [];
        const replacements2 = matches.length;
        const result2 = str.replace(regex, this.compileReplacePattern(replacePattern));
        return { result: result2, replacements: replacements2 };
      }
      const result = str.split(searchPattern).join(replacePattern);
      const replacements = str.split(searchPattern).length - 1;
      return { result, replacements };
    }
    // Preview replace on an item (no save)
    previewReplace(item, searchPattern, replacePattern, options = {}) {
      const { fields = [] } = options;
      const changes = [];
      for (const field of fields) {
        if (field.startsWith("creator.")) {
          const creators = item.getCreators();
          if (!creators) continue;
          const modifiedCreators = [...creators];
          let changed = false;
          const creatorField = field.split(".")[1];
          for (let i = 0; i < modifiedCreators.length; i++) {
            const creator = modifiedCreators[i];
            const value = creatorField === "fullName" ? creator.name : creator[creatorField];
            if (value) {
              const { result } = this.applyReplace(value, searchPattern, replacePattern, options);
              if (result !== value) {
                if (creatorField === "fullName") {
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
      const { fields = [], progressCallback = () => {
      } } = options;
      const changes = this.previewReplace(item, searchPattern, replacePattern, options);
      if (changes.length === 0) {
        return { success: false, changes: [], message: "No changes needed" };
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
    async processItems(items, searchPattern, replacePattern, options = {}) {
      const { fields = [], progressCallback = () => {
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
      fields: ["creator.lastName", "creator.firstName"],
      patternType: "regex",
      search: "(.+), (Jr|Sr|III|II|IV)$",
      replace: "$2, $1",
      category: "Parsing Errors"
    },
    {
      id: "fix-double-comma",
      name: "Fix: Double Commas",
      description: "Removes duplicate commas in author names",
      fields: ["creator.lastName", "creator.firstName"],
      patternType: "regex",
      search: ",,",
      replace: ",",
      category: "Parsing Errors"
    },
    {
      id: "fix-trailing-comma",
      name: "Fix: Trailing Comma",
      description: "Removes trailing comma at end of name",
      fields: ["creator.lastName"],
      patternType: "regex",
      search: ",$",
      replace: "",
      category: "Parsing Errors"
    },
    {
      id: "remove-parens",
      name: "Remove: Nicknames in Parens",
      description: 'Removes "(nickname)" from names',
      fields: ["creator.firstName", "creator.lastName"],
      patternType: "regex",
      search: "\\s*\\([^)]+\\)\\s*",
      replace: "",
      category: "Data Quality"
    },
    {
      id: "fix-whitespace-colon",
      name: "Fix: Whitespace Before Colon",
      description: "Removes whitespace before colons",
      fields: ["title", "abstractNote", "publicationTitle", "publisher", "note", "extra", "place", "archiveLocation", "libraryCatalog", "annotationText", "annotationComment"],
      patternType: "regex",
      search: "\\s+:",
      replace: ":",
      category: "Parsing Errors"
    },
    {
      id: "fix-whitespace-semicolon",
      name: "Fix: Whitespace Before Semicolon",
      description: "Removes whitespace before semicolons",
      fields: ["title", "abstractNote", "publicationTitle", "publisher", "note", "extra", "place", "archiveLocation", "libraryCatalog", "annotationText", "annotationComment"],
      patternType: "regex",
      search: "\\s+;",
      replace: ";",
      category: "Parsing Errors"
    },
    {
      id: "fix-missing-space-paren",
      name: "Fix: Missing Space Before (",
      description: "Adds space before opening parenthesis",
      fields: ["title", "abstractNote", "publicationTitle", "publisher", "note", "extra", "place", "archiveLocation", "libraryCatalog", "annotationText", "annotationComment"],
      patternType: "regex",
      search: "([a-z])\\(",
      replace: "$1 (",
      category: "Parsing Errors"
    },
    // === Capitalization ===
    {
      id: "lowercase-van-de",
      name: "Normalize: Dutch Prefixes",
      description: "Ensures van/de prefixes stay lowercase",
      fields: ["creator.lastName"],
      patternType: "regex",
      search: "\\b(Van|De|Van Der|De La)\\b",
      replace: (match) => match.toLowerCase(),
      category: "Capitalization"
    },
    {
      id: "lowercase-von",
      name: "Normalize: German von",
      description: "Ensures von prefix stays lowercase",
      fields: ["creator.lastName"],
      patternType: "regex",
      search: "\\bVon\\b",
      replace: "von",
      category: "Capitalization"
    },
    {
      id: "normalize-mc",
      name: "Normalize: Mc Prefix",
      description: "Fixes MCCULLOCH -> McCulloch and McDonald -> McDonald",
      fields: ["creator.lastName"],
      patternType: "regex",
      search: "\\b[Mm][Cc][A-Za-z]*",
      replace: (m) => m.charAt(0).toUpperCase() + m.charAt(1).toLowerCase() + m.slice(2).charAt(0).toUpperCase() + m.slice(3).toLowerCase(),
      category: "Capitalization"
    },
    {
      id: "normalize-mac",
      name: "Normalize: Mac Prefix",
      description: "Fixes MACDONALD -> MacDonald",
      fields: ["creator.lastName"],
      patternType: "regex",
      search: "\\b[Mm][Aa][Cc][A-Za-z]*",
      replace: (m) => m.charAt(0).toUpperCase() + m.slice(1, 3).toLowerCase() + m.slice(3).charAt(0).toUpperCase() + m.slice(4).toLowerCase(),
      category: "Capitalization"
    },
    // === Diacritics ===
    {
      id: "fix-polish-diacritics",
      name: "Restore: Polish Diacritics",
      description: "Fixes common diacritics errors for Polish names",
      fields: ["creator.lastName", "creator.firstName", "title"],
      patternType: "regex",
      search: "[lns]slash",
      replace: (match) => {
        const map = { "lslash": "\u0142", "nslash": "\u0144", "sslash": "\u015B" };
        return map[match] || match;
      },
      category: "Diacritics"
    },
    {
      id: "fix-german-diacritics",
      name: "Restore: German Diacritics",
      description: "Fixes German umlauts from stripped characters",
      fields: ["creator.lastName", "creator.firstName", "title"],
      patternType: "regex",
      search: 'a"',
      replace: "\xE4",
      category: "Diacritics"
    },
    // === Data Quality ===
    {
      id: "find-empty-creators",
      name: "Find: Empty Creator Fields",
      description: "Find items with missing creator names",
      fields: ["creators"],
      patternType: "custom",
      customCheck: (creators) => creators && creators.some((c) => !c.firstName && !c.lastName),
      category: "Data Quality"
    },
    {
      id: "find-empty-titles",
      name: "Find: Empty Titles",
      description: "Find items with missing or empty titles",
      fields: ["title"],
      patternType: "regex",
      search: "^\\s*$",
      replace: "",
      category: "Data Quality"
    },
    {
      id: "fix-url-http",
      name: "Normalize: HTTP to HTTPS",
      description: "Updates URLs from http:// to https://",
      fields: ["url"],
      patternType: "regex",
      search: "http://",
      replace: "https://",
      category: "Data Quality"
    },
    {
      id: "remove-all-urls",
      name: "Remove: All URLs",
      description: "Removes all URLs from the URL field",
      fields: ["url"],
      patternType: "regex",
      search: ".+",
      replace: "",
      category: "Data Quality"
    },
    {
      id: "remove-google-books-urls",
      name: "Remove: Google Books URLs",
      description: "Removes Google Books URLs from books (books.google.com)",
      fields: ["url"],
      patternType: "regex",
      search: "https?://books\\.google\\.com/[^\\s]*",
      replace: "",
      category: "Data Quality",
      secondCondition: { field: "itemType", pattern: "book" }
    },
    {
      id: "remove-worldcat-urls",
      name: "Remove: WorldCat URLs",
      description: "Removes WorldCat URLs from books (www.worldcat.org)",
      fields: ["url"],
      patternType: "regex",
      search: "https?://www\\.worldcat\\.org/[^\\s]*",
      replace: "",
      category: "Data Quality",
      secondCondition: { field: "itemType", pattern: "book" }
    },
    // === Classification ===
    {
      id: "find-corporate-authors",
      name: "Find: Corporate Authors",
      description: "Find likely corporate/group authors in person fields",
      fields: ["creator.lastName"],
      patternType: "regex",
      search: "\\s+(Collaborators|Group|Association|Institute|Center|Society|Journal|Proceedings)\\s*$",
      replace: "",
      category: "Classification"
    },
    {
      id: "find-journal-in-author",
      name: "Find: Journal Name in Author",
      description: "Find items where journal name appears as author",
      fields: ["creator.lastName"],
      patternType: "regex",
      search: "(Journal|Review|Proceedings|Transactions)",
      replace: "",
      category: "Classification"
    }
  ];

  // src/ui/search-dialog.js
  var SearchDialog = class {
    constructor(window2) {
      this.window = window2;
      this.state = {
        searchPattern: "",
        replacePattern: "",
        patternType: "regex",
        caseSensitive: false,
        fields: [],
        results: [],
        selectedItemIDs: /* @__PURE__ */ new Set(),
        replacedCount: 0
      };
      this.elements = {};
    }
    // Open the dialog
    static open() {
      const mainWindow = Services.wm.getMostRecentWindow("navigator:browser");
      const patterns = mainWindow.ZoteroSearchReplace?.DATA_QUALITY_PATTERNS || [];
      const categories = mainWindow.ZoteroSearchReplace?.PATTERN_CATEGORIES || [];
      const dialogArgs = {
        patterns,
        categories,
        ZoteroSearchReplace: mainWindow.ZoteroSearchReplace,
        Zotero: mainWindow.Zotero
      };
      const dialogWindow = mainWindow.openDialog(
        "chrome://zotero-search-replace/content/dialog.html",
        "zotero-search-replace-dialog",
        "chrome,centerscreen,resizable=yes,width=800,height=600",
        dialogArgs
      );
      return dialogWindow;
    }
    // Initialize the dialog
    init() {
      this.cacheElements();
      this.setupScope();
      this.setupEventListeners();
      this.loadPreloadedPatterns();
      this.updateUIState();
    }
    setupScope() {
      try {
        if (this.window.opener && this.window.opener.ZoteroSearchReplace) {
          this.window.__zotero_scope__ = this.window.opener;
          console.log("SearchReplace: Using scope from window.opener");
          return;
        }
      } catch (e) {
        console.log("SearchReplace: Could not access window.opener:", e.message);
      }
      try {
        if (this.window.arguments && this.window.arguments[0]) {
          const args = this.window.arguments[0];
          if (args.ZoteroSearchReplace) {
            this.window.__zotero_scope__ = { ZoteroSearchReplace: args.ZoteroSearchReplace };
            console.log("SearchReplace: Using scope from window.arguments");
            return;
          }
        }
      } catch (e) {
        console.log("SearchReplace: Could not access window.arguments:", e.message);
      }
      if (this.window.ZoteroSearchReplace) {
        this.window.__zotero_scope__ = this.window;
        console.log("SearchReplace: Using scope from window");
        return;
      }
      console.log("SearchReplace: No scope available, using fallback");
    }
    cacheElements() {
      this.elements = {
        searchInput: this.window.document.getElementById("search-input"),
        searchField: this.window.document.getElementById("search-field"),
        patternType: this.window.document.getElementById("pattern-type"),
        caseSensitive: this.window.document.getElementById("case-sensitive"),
        searchButton: this.window.document.getElementById("search-button"),
        resultsCount: this.window.document.getElementById("results-count"),
        resultsList: this.window.document.getElementById("results-list"),
        replaceInput: this.window.document.getElementById("replace-input"),
        previewOutput: this.window.document.getElementById("preview-output"),
        applyReplaceButton: this.window.document.getElementById("apply-replace"),
        createCollection: this.window.document.getElementById("create-collection"),
        patternsList: this.window.document.getElementById("patterns-list"),
        searchError: this.window.document.getElementById("search-error"),
        selectAll: this.window.document.getElementById("select-all"),
        deselectAll: this.window.document.getElementById("deselect-all"),
        previewReplaceButton: this.window.document.getElementById("preview-replace")
      };
    }
    setupEventListeners() {
      if (this.elements.searchButton) {
        this.elements.searchButton.addEventListener("click", () => this.performSearch());
      }
      if (this.elements.previewReplaceButton) {
        this.elements.previewReplaceButton.addEventListener("click", () => this.previewReplace());
      }
      if (this.elements.applyReplaceButton) {
        this.elements.applyReplaceButton.addEventListener("click", () => this.applyReplace());
      }
      if (this.elements.createCollection) {
        this.elements.createCollection.addEventListener("click", () => this.createCollection());
      }
      if (this.elements.selectAll) {
        this.elements.selectAll.addEventListener("click", () => this.selectAll());
      }
      if (this.elements.deselectAll) {
        this.elements.deselectAll.addEventListener("click", () => this.deselectAll());
      }
      this.window.document.addEventListener("keydown", (event) => {
        const target = event.target.tagName;
        if (target === "INPUT" || target === "TEXTAREA" || target === "SELECT") {
          return;
        }
        if (event.ctrlKey || event.metaKey) {
          if (event.key === "Enter") {
            event.preventDefault();
            this.performSearch();
          } else if (event.key === "r") {
            event.preventDefault();
            if (this.elements.replaceInput) {
              this.elements.replaceInput.focus();
            }
          }
        } else if (event.key === "Escape") {
          this.window.close();
        }
      });
    }
    async performSearch() {
      const pattern = this.elements.searchInput.value;
      if (!pattern) {
        this.showError("Please enter a search pattern");
        return;
      }
      const field = this.elements.searchField.value;
      const fields = field === "all" ? [
        "title",
        "abstractNote",
        "tags",
        "date",
        "publicationTitle",
        "DOI",
        "extra",
        "creator.lastName",
        "creator.firstName"
      ] : [field];
      const patternType = this.elements.patternType.value;
      const caseSensitive = this.elements.caseSensitive.checked;
      this.showProgress("Searching...");
      try {
        const scope = this.window.__zotero_scope__ || this.window;
        const SearchEngine2 = scope.ZoteroSearchReplace?.SearchEngine || scope.SearchEngine;
        if (!SearchEngine2) {
          throw new Error("SearchEngine not loaded");
        }
        const engine = new SearchEngine2();
        const results = await engine.search(pattern, {
          fields,
          patternType,
          caseSensitive,
          progressCallback: (progress) => {
            if (progress.phase === "filter") {
              this.showProgress(`Found ${progress.count} potential matches...`);
            } else if (progress.phase === "refine") {
              this.showProgress(`Refining ${progress.current}/${progress.total}...`);
            }
          }
        });
        this.state.results = results;
        this.state.fields = fields;
        this.renderResults();
      } catch (e) {
        if (e.name === "SearchError") {
          this.showError(`Search error: ${e.message}`);
        } else {
          this.showError(`Unexpected error: ${e.message}`);
        }
      }
    }
    renderResults() {
      const list = this.elements.resultsList;
      while (list.firstChild) {
        list.removeChild(list.firstChild);
      }
      for (const result of this.state.results) {
        for (const detail of result.matchDetails) {
          const item = this.window.document.createElement("div");
          item.className = "result-item";
          item.dataset.itemID = result.itemID;
          const title = this.window.document.createElement("span");
          title.textContent = result.item.getField("title");
          title.style.flex = "1";
          const field = this.window.document.createElement("span");
          field.textContent = detail.field;
          field.style.width = "120px";
          const match = this.window.document.createElement("span");
          const preview = this.getMatchPreview(detail.value, detail.matchIndex, detail.matchLength);
          match.textContent = preview;
          item.appendChild(title);
          item.appendChild(field);
          item.appendChild(match);
          item.addEventListener("click", () => {
            item.classList.toggle("selected");
            const id = parseInt(item.dataset.itemID);
            if (this.state.selectedItemIDs.has(id)) {
              this.state.selectedItemIDs.delete(id);
            } else {
              this.state.selectedItemIDs.add(id);
            }
            this.updateUIState();
          });
          list.appendChild(item);
        }
      }
      this.elements.resultsCount.textContent = `${this.state.results.length} items found`;
      this.updateUIState();
    }
    getMatchPreview(value, matchIndex, matchLength) {
      if (matchIndex < 0) return value;
      const start = Math.max(0, matchIndex - 20);
      const end = Math.min(value.length, matchIndex + matchLength + 20);
      let preview = value.substring(start, end);
      if (start > 0) preview = "..." + preview;
      if (end < value.length) preview = preview + "...";
      return preview;
    }
    selectAll() {
      const items = this.elements.resultsList.querySelectorAll(".result-item");
      items.forEach((item) => {
        item.classList.add("selected");
        this.state.selectedItemIDs.add(parseInt(item.dataset.itemID));
      });
      this.updateUIState();
    }
    deselectAll() {
      const items = this.elements.resultsList.querySelectorAll(".result-item");
      items.forEach((item) => {
        item.classList.remove("selected");
      });
      this.state.selectedItemIDs.clear();
      this.updateUIState();
    }
    async previewReplace() {
      if (this.state.results.length === 0) {
        this.showError("No results to preview");
        return;
      }
      const firstResult = this.state.results[0];
      const searchPattern = this.elements.searchInput.value;
      const replacePattern = this.elements.replaceInput.value;
      const patternType = this.elements.patternType.value;
      const caseSensitive = this.elements.caseSensitive.checked;
      try {
        const scope = this.window.__zotero_scope__ || this.window;
        const ReplaceEngine2 = scope.ZoteroSearchReplace?.ReplaceEngine || scope.ReplaceEngine;
        if (!ReplaceEngine2) {
          throw new Error("ReplaceEngine not loaded");
        }
        const engine = new ReplaceEngine2();
        const changes = engine.previewReplace(firstResult.item, searchPattern, replacePattern, {
          fields: this.state.fields,
          patternType,
          caseSensitive
        });
        if (changes.length === 0) {
          this.elements.previewOutput.value = "No changes would be made";
        } else {
          let preview = "Preview for first item:\n\n";
          for (const change of changes) {
            preview += `${change.field}:
`;
            preview += `  Original: "${change.original}"
`;
            preview += `  Replaced: "${change.replaced}"

`;
          }
          this.elements.previewOutput.value = preview;
        }
      } catch (e) {
        this.showError(`Preview error: ${e.message}`);
      }
    }
    async applyReplace() {
      const selectedIDs = Array.from(this.state.selectedItemIDs);
      if (selectedIDs.length === 0) {
        this.showError("No items selected");
        return;
      }
      const selectedItems = this.state.results.filter((r) => this.state.selectedItemIDs.has(r.itemID)).map((r) => r.item);
      const searchPattern = this.elements.searchInput.value;
      const replacePattern = this.elements.replaceInput.value;
      const patternType = this.elements.patternType.value;
      const caseSensitive = this.elements.caseSensitive.checked;
      if (!Services.prompt.confirmCount(
        null,
        "Search & Replace",
        `Replace in ${selectedItems.length} items?`
      )) {
        return;
      }
      const progressWindow = this.window.open(
        "progress.html",
        "progress",
        "width=400,height=200,modal=yes,centerscreen"
      );
      try {
        const scope = this.window.__zotero_scope__ || this.window;
        const ReplaceEngine2 = scope.ZoteroSearchReplace?.ReplaceEngine || scope.ReplaceEngine;
        if (!ReplaceEngine2) {
          throw new Error("ReplaceEngine not loaded");
        }
        const engine = new ReplaceEngine2();
        const result = await engine.processItems(selectedItems, searchPattern, replacePattern, {
          fields: this.state.fields,
          patternType,
          caseSensitive,
          progressCallback: (progress) => {
            this.updateProgress(progressWindow, progress);
          }
        });
        progressWindow.close();
        let message = `Modified: ${result.modified}
`;
        message += `Skipped: ${result.skipped}
`;
        if (result.errors.length > 0) {
          message += `Errors: ${result.errors.length}`;
        }
        Services.prompt.alert(null, "Search & Replace", message);
        this.performSearch();
      } catch (e) {
        if (progressWindow && !progressWindow.closed) {
          progressWindow.close();
        }
        this.showError(`Replace failed: ${e.message}`);
      }
    }
    async createCollection() {
      const selectedIDs = Array.from(this.state.selectedItemIDs);
      if (selectedIDs.length === 0) {
        this.showError("No items selected");
        return;
      }
      const name = Services.prompt.prompt(null, "Search & Replace", "Enter collection name:");
      if (!name) return;
      const trimmedName = name.trim();
      if (!trimmedName) {
        this.showError("Collection name cannot be empty");
        return;
      }
      try {
        const collection = new Zotero.Collection();
        collection.name = trimmedName;
        await collection.saveTx();
        const items = await Zotero.Items.getAsync(selectedIDs);
        for (const item of items) {
          item.addToCollection(collection.id);
          await item.saveTx();
        }
        Services.prompt.alert(
          null,
          "Search & Replace",
          `Created collection "${trimmedName}" with ${selectedIDs.length} items`
        );
      } catch (e) {
        this.showError(`Failed to create collection: ${e.message}`);
      }
    }
    loadPreloadedPatterns() {
      let patterns = null;
      try {
        if (this.window.arguments && this.window.arguments[0]) {
          const args = this.window.arguments[0];
          patterns = args.patterns;
          if (patterns && patterns.length > 0) {
            console.log("Found patterns from window.arguments");
          }
        }
      } catch (e) {
        console.log("window.arguments access error:", e.message);
      }
      if (!patterns || patterns.length === 0) {
        try {
          if (this.window.opener && this.window.opener.ZoteroSearchReplace) {
            patterns = this.window.opener.ZoteroSearchReplace.DATA_QUALITY_PATTERNS;
            if (patterns) {
              console.log("Found patterns from opener");
            }
          }
        } catch (e) {
          console.log("opener access error:", e.message);
        }
      }
      if (!patterns || patterns.length === 0) {
        const scope = this.window.__zotero_scope__ || this.window;
        patterns = scope.ZoteroSearchReplace?.DATA_QUALITY_PATTERNS;
        if (patterns) {
          console.log("Found patterns from __zotero_scope__");
        }
      }
      if (patterns && patterns.length > 0) {
        this.window.DATA_QUALITY_PATTERNS = patterns;
        console.log("Injected patterns into window.DATA_QUALITY_PATTERNS");
      }
      if (!patterns || patterns.length === 0) {
        console.log("No patterns found");
        return;
      }
      console.log("Loading", patterns.length, "patterns");
      const container = this.elements.patternsList;
      if (!container) return;
      const categories = {};
      for (const pattern of patterns) {
        if (!categories[pattern.category]) {
          const catDiv = this.window.document.createElement("div");
          catDiv.className = "pattern-category";
          const catTitle = this.window.document.createElement("strong");
          catTitle.textContent = pattern.category;
          catDiv.appendChild(catTitle);
          container.appendChild(catDiv);
          categories[pattern.category] = [];
        }
        categories[pattern.category].push(pattern);
      }
      for (const catName in categories) {
        const catDiv = container.lastChild;
        for (const pattern of categories[catName]) {
          const item = this.window.document.createElement("div");
          item.className = "pattern-item";
          const name = this.window.document.createElement("span");
          name.textContent = pattern.name;
          const desc = this.window.document.createElement("span");
          desc.style.color = "#666";
          desc.style.fontSize = "12px";
          desc.textContent = pattern.description;
          item.appendChild(name);
          item.appendChild(desc);
          item.addEventListener("click", () => {
            this.elements.searchInput.value = pattern.search || "";
            this.elements.replaceInput.value = pattern.replace || "";
            if (pattern.fields && pattern.fields.length > 0) {
              this.elements.searchField.value = pattern.fields[0];
            }
            if (pattern.patternType) {
              this.elements.patternType.value = pattern.patternType;
            }
          });
          catDiv.appendChild(item);
        }
      }
    }
    updateUIState() {
      const hasResults = this.state.results.length > 0;
      const hasSelection = this.state.selectedItemIDs.size > 0;
      const hasReplace = this.elements.replaceInput && this.elements.replaceInput.value.length > 0;
      if (this.elements.applyReplaceButton) {
        this.elements.applyReplaceButton.disabled = !hasSelection || !hasReplace;
      }
    }
    showError(message) {
      if (this.elements.searchError) {
        this.elements.searchError.textContent = message;
        this.window.setTimeout(() => {
          this.elements.searchError.textContent = "";
        }, 5e3);
      }
    }
    showProgress(message) {
      if (this.elements.resultsCount) {
        this.elements.resultsCount.textContent = message;
      }
    }
    updateProgress(progressWindow, progress) {
      if (progressWindow && !progressWindow.closed) {
        const percent = Math.round(progress.current / progress.total * 100);
        try {
          progressWindow.postMessage({ type: "progress", percent, status: progress.status }, "*");
        } catch (e) {
        }
      }
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

