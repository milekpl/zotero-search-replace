/**
 * Dialog Controller for Zotero Search & Replace Plugin
 * This script handles the HTML dialog UI interactions
 */

// Embedded patterns for standalone dialog access
var EMBEDDED_PATTERNS = [
  { id: 'fix-jr-suffix', name: 'Fix: Move Jr/Sr Suffix', description: 'Moves "Jr" from given name to surname', search: '(.+), (Jr|Sr|III|II|IV)$', replace: '$2, $1', category: 'Parsing Errors', fields: ['creator.lastName', 'creator.firstName'] },
  { id: 'fix-double-comma', name: 'Fix: Double Commas', description: 'Removes duplicate commas in author names', search: ',,', replace: ',', category: 'Parsing Errors', fields: ['creator.lastName', 'creator.firstName'] },
  { id: 'fix-trailing-comma', name: 'Fix: Trailing Comma', description: 'Removes trailing comma at end of name', search: ',$', replace: '', category: 'Parsing Errors', fields: ['creator.lastName'] },
  { id: 'remove-parens', name: 'Remove: Nicknames in Parens', description: 'Removes "(nickname)" from names', search: '\\s*\\([^)]+\\)\\s*', replace: '', category: 'Data Quality', fields: ['creator.firstName', 'creator.lastName'] },
  { id: 'fix-whitespace-colon', name: 'Fix: Whitespace Before Colon', description: 'Removes whitespace before colons', search: '\\s+:', replace: ':', category: 'Parsing Errors', fields: ['title', 'abstractNote', 'publicationTitle', 'publisher', 'note', 'extra', 'place', 'archiveLocation', 'libraryCatalog', 'annotationText', 'annotationComment'] },
  { id: 'fix-whitespace-semicolon', name: 'Fix: Whitespace Before Semicolon', description: 'Removes whitespace before semicolons', search: '\\s+;', replace: ';', category: 'Parsing Errors', fields: ['title', 'abstractNote', 'publicationTitle', 'publisher', 'note', 'extra', 'place', 'archiveLocation', 'libraryCatalog', 'annotationText', 'annotationComment'] },
  { id: 'fix-missing-space-paren', name: 'Fix: Missing Space Before (', description: 'Adds space before opening parenthesis', search: '([a-z])\\(', replace: '$1 (', category: 'Parsing Errors', fields: ['title', 'abstractNote', 'publicationTitle', 'publisher', 'note', 'extra', 'place', 'archiveLocation', 'libraryCatalog', 'annotationText', 'annotationComment'] },
  { id: 'lowercase-van-de', name: 'Normalize: Dutch Prefixes', description: 'Ensures van/de prefixes stay lowercase', search: '\\b(Van|De|Van Der|De La)\\b', replace: (m) => m.toLowerCase(), category: 'Capitalization', fields: ['creator.lastName'] },
  { id: 'lowercase-von', name: 'Normalize: German von', description: 'Ensures von prefix stays lowercase', search: '\\bVon\\b', replace: 'von', category: 'Capitalization', fields: ['creator.lastName'] },
  { id: 'normalize-mc', name: 'Normalize: Mc Prefix', description: 'Fixes MCCULLOCH -> McCulloch and McDonald -> McDonald', search: '\\b[Mm][Cc][A-Za-z]*', replace: (m) => m.charAt(0).toUpperCase() + m.charAt(1).toLowerCase() + m.slice(2).charAt(0).toUpperCase() + m.slice(3).toLowerCase(), category: 'Capitalization', fields: ['creator.lastName'] },
  { id: 'normalize-mac', name: 'Normalize: Mac Prefix', description: 'Fixes MACDONALD -> MacDonald and MAC->Mac', search: '\\b[Mm][Aa][Cc][A-Za-z]*', replace: (m) => m.charAt(0).toUpperCase() + m.slice(1, 3).toLowerCase() + m.slice(3).charAt(0).toUpperCase() + m.slice(4).toLowerCase(), category: 'Capitalization', fields: ['creator.lastName'] },
  { id: 'fix-polish-diacritics', name: 'Restore: Polish Diacritics', description: 'Fixes common diacritics errors for Polish names', search: '[lns]slash', replace: (m) => ({ 'lslash': 'ł', 'nslash': 'ń', 'sslash': 'ś' }[m] || m), category: 'Diacritics', fields: ['creator.lastName', 'creator.firstName', 'title'] },
  { id: 'fix-german-diacritics', name: 'Restore: German Diacritics', description: 'Fixes German umlauts from stripped characters', search: 'a"', replace: 'ä', category: 'Diacritics', fields: ['creator.lastName', 'creator.firstName', 'title'] },
  { id: 'find-empty-titles', name: 'Find: Empty Titles', description: 'Find items with missing or empty titles', search: '^\\s*$', replace: '', category: 'Data Quality', fields: ['title'] },
  { id: 'fix-url-http', name: 'Normalize: HTTP to HTTPS', description: 'Updates URLs from http:// to https://', search: 'http://', replace: 'https://', category: 'Data Quality', fields: ['url'] },
  { id: 'remove-all-urls', name: 'Remove: All URLs', description: 'Removes all URLs from the URL field', search: '.+', replace: '', category: 'Data Quality', fields: ['url'] },
  { id: 'remove-google-books-urls', name: 'Remove: Google Books URLs', description: 'Removes Google Books URLs (books.google.com)', search: 'https?://books\\.google\\.com/[^\\s]*', replace: '', category: 'Data Quality', fields: ['url'] },
  { id: 'remove-worldcat-urls', name: 'Remove: WorldCat URLs', description: 'Removes WorldCat URLs (www.worldcat.org)', search: 'https?://www\\.worldcat\\.org/[^\\s]*', replace: '', category: 'Data Quality', fields: ['url'] },
  { id: 'find-corporate-authors', name: 'Find: Corporate Authors', description: 'Find likely corporate/group authors', search: '\\s+(Collaborators|Group|Association|Institute|Center|Society|Journal|Proceedings)\\s*$', replace: '', category: 'Classification', fields: ['creator.lastName'] },
  { id: 'find-journal-in-author', name: 'Find: Journal Name in Author', description: 'Find items where journal name appears as author', search: '(Journal|Review|Proceedings|Transactions)', replace: '', category: 'Classification', fields: ['creator.lastName'] },
  { id: 'find-empty-fields', name: 'Find: Empty Fields', description: 'Find items with empty fields (title, abstract, publication, or missing creators)', search: '^$', replace: '', category: 'Data Quality', fields: ['title', 'abstractNote', 'publicationTitle', 'creator.lastName', 'creator.firstName'] }
];

var EMBEDDED_CATEGORIES = ['Parsing Errors', 'Capitalization', 'Diacritics', 'Data Quality', 'Classification'];

// Field type definitions - determines what input UI to show
var FIELD_TYPES = {
  // Fields with predefined dropdown values (XUL menulist)
  itemType: {
    type: 'dropdown',
    values: [
      'journalArticle',
      'book',
      'bookSection',
      'conferencePaper',
      'conferenceProceedings',
      'report',
      'thesis',
      'webpage',
      'blogPost',
      'forumPost',
      'letter',
      'manuscript',
      'interview',
      'radioBroadcast',
      'tvBroadcast',
      'podcast',
      'audioRecording',
      'videoRecording',
      'film',
      'artwork',
      'photograph',
      'map',
      'dataset',
      'software',
      'attachment',
      'note',
      'annotation'
    ]
  },
  // Date fields - could use date picker in the future
  date: {
    type: 'text',
    placeholder: 'e.g., 2024, 2024-01, 2024-01-15'
  },
  dateModified: {
    type: 'text',
    placeholder: 'e.g., 2024, 2024-01, 2024-01-15'
  },
  // Default to text input
  default: {
    type: 'text',
    placeholder: 'Pattern...'
  }
};

// Get SearchEngine and ReplaceEngine from the bundled script (loaded in dialog.html)
function getSearchEngine() {
  // Try from ZoteroSearchReplace namespace (primary path - bundled script exports here)
  if (typeof ZoteroSearchReplace !== 'undefined' && ZoteroSearchReplace && ZoteroSearchReplace.SearchEngine) {
    return ZoteroSearchReplace.SearchEngine;
  }
  // Try from window.opener.ZoteroSearchReplace
  if (typeof window.opener !== 'undefined' && window.opener &&
      window.opener.ZoteroSearchReplace && window.opener.ZoteroSearchReplace.SearchEngine) {
    return window.opener.ZoteroSearchReplace.SearchEngine;
  }
  // Try from global Zotero.SearchReplace
  var ZoteroGlobal = getZotero();
  if (ZoteroGlobal && ZoteroGlobal.SearchReplace && ZoteroGlobal.SearchReplace.SearchEngine) {
    return ZoteroGlobal.SearchReplace.SearchEngine;
  }
  return null;
}

function getReplaceEngine() {
  // Try from ZoteroSearchReplace namespace (primary path - bundled script exports here)
  if (typeof ZoteroSearchReplace !== 'undefined' && ZoteroSearchReplace && ZoteroSearchReplace.ReplaceEngine) {
    return ZoteroSearchReplace.ReplaceEngine;
  }
  // Try from window.opener.ZoteroSearchReplace
  if (typeof window.opener !== 'undefined' && window.opener &&
      window.opener.ZoteroSearchReplace && window.opener.ZoteroSearchReplace.ReplaceEngine) {
    return window.opener.ZoteroSearchReplace.ReplaceEngine;
  }
  // Try from global Zotero.SearchReplace
  var ZoteroGlobal = getZotero();
  if (ZoteroGlobal && ZoteroGlobal.SearchReplace && ZoteroGlobal.SearchReplace.ReplaceEngine) {
    return ZoteroGlobal.SearchReplace.ReplaceEngine;
  }
  return null;
}

// Debug logging function - uses Zotero.debug when available
function SRdebug(msg) {
  var ZoteroGlobal = getZotero();
  if (ZoteroGlobal && ZoteroGlobal.debug) {
    ZoteroGlobal.debug('SearchReplace: ' + msg);
  } else if (typeof window.dump === 'function') {
    window.dump('[SearchReplace] ' + msg + '\n');
  }
}

// Get Zotero from any available source
function getZotero() {
  // First try window.Zotero (from injected arguments)
  if (typeof window.Zotero !== 'undefined') {
    return window.Zotero;
  }
  // Then try window.opener (for chrome dialogs)
  if (typeof window.opener !== 'undefined' && window.opener) {
    try {
      if (window.opener.Zotero) {
        return window.opener.Zotero;
      }
    } catch (e) {
      // Cross-origin blocked
    }
  }
  // Fallback to global Zotero
  if (typeof Zotero !== 'undefined') {
    return Zotero;
  }
  return null;
}

var ZoteroSearchDialog = {
  state: {
    searchPattern: '',
    replacePattern: '',
    patternType: 'regex',
    caseSensitive: false,
    fields: [],
    results: [],
    selectedItemIDs: new Set(),
    replacedCount: 0,
    // Unified condition rows
    conditions: [] // Array of {operator, field, pattern, patternType, caseSensitive}
  },

  elements: {},

  init: function() {
    var ZoteroGlobal = getZotero();
    SRdebug('Dialog init starting');
    SRdebug('window.Zotero = ' + typeof window.Zotero);
    SRdebug('window.opener = ' + (window.opener ? 'exists' : 'null'));
    SRdebug('getZotero() = ' + (ZoteroGlobal ? 'found' : 'null'));
    SRdebug('window.ZoteroSearchReplace = ' + typeof window.ZoteroSearchReplace);
    this.cacheElements();
    this.setupEventListeners();
    // Always initialize with one condition row
    this.state.conditions.push({
      operator: 'AND',
      field: 'title',
      pattern: '',
      patternType: 'regex',
      caseSensitive: false
    });
    this.renderConditions();
    this.updateReplaceFieldOptions();
    this.loadPreloadedPatterns();
    this.updateUIState();
    SRdebug('Dialog init complete');
  },

  cacheElements: function() {
    this.elements = {
      // Keep these for pattern selector presets
      searchField: document.getElementById('search-field'),
      patternType: document.getElementById('pattern-type'),
      caseSensitive: document.getElementById('case-sensitive'),
      searchButton: document.getElementById('search-button'),
      resultsCount: document.getElementById('results-count'),
      resultsList: document.getElementById('results-list'),
      replaceInput: document.getElementById('replace-input'),
      previewOutput: document.getElementById('preview-output'),
      applyReplaceButton: document.getElementById('apply-replace'),
      createCollection: document.getElementById('create-collection'),
      patternsList: document.getElementById('patterns-list'),
      searchError: document.getElementById('search-error'),
      selectAll: document.getElementById('select-all'),
      deselectAll: document.getElementById('deselect-all'),
      previewReplaceButton: document.getElementById('preview-replace'),
      // Unified condition UI elements
      conditionsList: document.getElementById('conditions-list'),
      addConditionBtn: document.getElementById('add-condition-btn'),
      replaceFieldSelect: document.getElementById('replace-field-select')
    };
  },

  setupEventListeners: function() {
    // Search button
    if (this.elements.searchButton) {
      this.elements.searchButton.addEventListener('click', () => this.performSearch());
    }

    // Search input - trigger search on Enter key
    if (this.elements.searchInput) {
      this.elements.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.performSearch();
        }
      });
    }

    // Preview button
    if (this.elements.previewReplaceButton) {
      this.elements.previewReplaceButton.addEventListener('click', () => this.previewReplace());
    }

    // Apply replace button - NOTE: using applyReplaceButton to avoid collision with method
    if (this.elements.applyReplaceButton) {
      this.elements.applyReplaceButton.addEventListener('click', () => this.applyReplace());
    }

    // Create collection button
    if (this.elements.createCollection) {
      this.elements.createCollection.addEventListener('click', () => this.createCollection());
    }

    // Select/Deselect all
    if (this.elements.selectAll) {
      this.elements.selectAll.addEventListener('click', () => this.selectAll());
    }
    if (this.elements.deselectAll) {
      this.elements.deselectAll.addEventListener('click', () => this.deselectAll());
    }

    // Add condition button
    if (this.elements.addConditionBtn) {
      this.elements.addConditionBtn.addEventListener('click', () => this.addCondition());
    }
  },

  // Add a new condition row
  addCondition: function() {
    this.state.conditions.push({
      operator: 'AND',
      field: 'title',
      pattern: '',
      patternType: 'regex',
      caseSensitive: false
    });
    this.renderConditions();
  },

  // Remove a condition by index
  removeCondition: function(index) {
    if (this.state.conditions.length > 1) {
      this.state.conditions.splice(index, 1);
      this.renderConditions();
    }
  },

  // Render all condition rows
  renderConditions: function() {
    const container = this.elements.conditionsList;
    container.innerHTML = '';

    const allFields = this.getAllFields();
    const operators = [
      { value: 'AND', label: 'AND' },
      { value: 'OR', label: 'OR' },
      { value: 'AND_NOT', label: 'AND NOT' },
      { value: 'OR_NOT', label: 'OR NOT' }
    ];
    const patternTypes = [
      { value: 'regex', label: 'Regex' },
      { value: 'exact', label: 'Exact' },
      { value: 'contains', label: 'Contains' },
      { value: 'sql_like', label: 'SQL LIKE' }
    ];

    this.state.conditions.forEach((condition, index) => {
      const row = document.createElement('div');
      row.className = 'condition-row';

      // Operator dropdown (AND/OR/AND NOT/OR NOT) - hidden for first condition
      const operatorSelect = document.createElement('select');
      operatorSelect.className = 'operator-select';
      operatorSelect.style.display = index === 0 ? 'none' : 'block';
      operators.forEach(op => {
        const option = document.createElement('option');
        option.value = op.value;
        option.textContent = op.label;
        if (condition.operator === op.value) option.selected = true;
        operatorSelect.appendChild(option);
      });
      operatorSelect.addEventListener('change', (e) => {
        this.state.conditions[index].operator = e.target.value;
      });

      // Field dropdown
      const fieldSelect = document.createElement('select');
      fieldSelect.className = 'condition-field';
      allFields.forEach(field => {
        const option = document.createElement('option');
        option.value = field.value;
        option.textContent = field.label;
        if (condition.field === field.value) option.selected = true;
        fieldSelect.appendChild(option);
      });
      fieldSelect.addEventListener('change', (e) => {
        this.state.conditions[index].field = e.target.value;
        // Update replace field options when field changes
        this.updateReplaceFieldOptions();
        // Re-render to show appropriate input type for the field
        this.renderConditions();
      });

      // Pattern Type dropdown
      const patternTypeSelect = document.createElement('select');
      patternTypeSelect.className = 'condition-pattern-type';
      patternTypes.forEach(pt => {
        const option = document.createElement('option');
        option.value = pt.value;
        option.textContent = pt.label;
        if ((condition.patternType || 'regex') === pt.value) option.selected = true;
        patternTypeSelect.appendChild(option);
      });
      patternTypeSelect.addEventListener('change', (e) => {
        this.state.conditions[index].patternType = e.target.value;
      });

      // Pattern input container - will hold different input types based on field
      const patternContainer = document.createElement('div');
      patternContainer.className = 'condition-pattern-container';

      // Get the field type info
      const fieldTypeInfo = this.getFieldTypeInfo(condition.field);
      const isDropdown = fieldTypeInfo.type === 'dropdown';

      // Create text input (default)
      const patternInput = document.createElement('input');
      patternInput.type = 'text';
      patternInput.className = 'condition-pattern';
      patternInput.placeholder = fieldTypeInfo.placeholder || 'Pattern...';
      patternInput.value = condition.pattern || '';
      patternInput.style.display = isDropdown ? 'none' : 'block';
      patternInput.addEventListener('input', (e) => {
        this.state.conditions[index].pattern = e.target.value;
      });

      // Create XUL menulist for dropdown fields (like itemType)
      const xulWrapper = document.createElement('div');
      xulWrapper.className = 'xul-menulist-wrapper';
      xulWrapper.style.display = isDropdown ? 'block' : 'none';

      // Try to create XUL menulist
      let xulMenulist = null;
      try {
        if (document.createXULElement) {
          xulMenulist = document.createXULElement('menulist');
          xulMenulist.setAttribute('flex', '1');
          xulMenulist.setAttribute('minwidth', '150px');

          // Create menupopup and menuitems
          const menupopup = document.createXULElement('menupopup');

          // Add "Any" option for searching
          const anyOption = document.createXULElement('menuitem');
          anyOption.setAttribute('label', '-- Any --');
          anyOption.setAttribute('value', '');
          menupopup.appendChild(anyOption);

          // Add item type options
          if (fieldTypeInfo.values) {
            fieldTypeInfo.values.forEach(val => {
              const menuitem = document.createXULElement('menuitem');
              menuitem.setAttribute('label', val);
              menuitem.setAttribute('value', val);
              menupopup.appendChild(menuitem);
            });
          }

          xulMenulist.appendChild(menupopup);

          // Set selected value
          if (condition.pattern) {
            xulMenulist.value = condition.pattern;
          }

          xulMenulist.addEventListener('change', (e) => {
            this.state.conditions[index].pattern = e.target.value;
          });

          xulWrapper.appendChild(xulMenulist);
        }
      } catch (e) {
        SRdebug('Could not create XUL menulist: ' + e.message);
      }

      // Fallback to HTML select if XUL fails
      if (!xulMenulist) {
        const htmlSelect = document.createElement('select');
        htmlSelect.className = 'condition-pattern';
        htmlSelect.style.width = '100%';
        htmlSelect.style.display = isDropdown ? 'block' : 'none';

        // Add "Any" option
        const anyOption = document.createElement('option');
        anyOption.value = '';
        anyOption.textContent = '-- Any --';
        htmlSelect.appendChild(anyOption);

        // Add options
        if (fieldTypeInfo.values) {
          fieldTypeInfo.values.forEach(val => {
            const option = document.createElement('option');
            option.value = val;
            option.textContent = val;
            htmlSelect.appendChild(option);
          });
        }

        if (condition.pattern) {
          htmlSelect.value = condition.pattern;
        }

        htmlSelect.addEventListener('change', (e) => {
          this.state.conditions[index].pattern = e.target.value;
        });

        // Replace XUL wrapper with HTML select
        xulWrapper.innerHTML = '';
        xulWrapper.appendChild(htmlSelect);
      }

      patternContainer.appendChild(patternInput);
      patternContainer.appendChild(xulWrapper);

      // Case sensitive checkbox
      const caseSensitiveLabel = document.createElement('label');
      caseSensitiveLabel.style.display = 'flex';
      caseSensitiveLabel.style.alignItems = 'center';
      caseSensitiveLabel.style.whiteSpace = 'nowrap';
      caseSensitiveLabel.style.fontSize = '11px';
      const caseSensitiveCheckbox = document.createElement('input');
      caseSensitiveCheckbox.type = 'checkbox';
      caseSensitiveCheckbox.title = 'Case sensitive';
      caseSensitiveCheckbox.checked = condition.caseSensitive || false;
      caseSensitiveCheckbox.addEventListener('change', (e) => {
        this.state.conditions[index].caseSensitive = e.target.checked;
      });
      caseSensitiveLabel.appendChild(caseSensitiveCheckbox);
      caseSensitiveLabel.appendChild(document.createTextNode('CS'));

      // Remove button
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-condition';
      removeBtn.textContent = '\u00D7';
      removeBtn.title = 'Remove condition';
      removeBtn.addEventListener('click', () => this.removeCondition(index));

      row.appendChild(operatorSelect);
      row.appendChild(fieldSelect);
      row.appendChild(patternTypeSelect);
      row.appendChild(patternContainer);
      row.appendChild(caseSensitiveLabel);
      row.appendChild(removeBtn);
      container.appendChild(row);
    });
  },

  // Get all available fields for dropdown
  // Get field label for a field value (for display)
  getFieldLabel: function(fieldValue) {
    const fields = this.getAllFields();
    const found = fields.find(f => f.value === fieldValue);
    return found ? found.label : fieldValue;
  },

  getAllFields: function() {
    return [
      // Core fields
      { value: 'title', label: 'Title', fieldType: 'text' },
      { value: 'abstractNote', label: 'Abstract', fieldType: 'text' },
      { value: 'date', label: 'Date', fieldType: 'date' },
      { value: 'dateModified', label: 'Date Modified', fieldType: 'date' },
      // Creators
      { value: 'creator.lastName', label: 'Creator (Last)', fieldType: 'text' },
      { value: 'creator.firstName', label: 'Creator (First)', fieldType: 'text' },
      { value: 'creator.fullName', label: 'Creator (Full)', fieldType: 'text' },
      // Publication
      { value: 'publicationTitle', label: 'Publication', fieldType: 'text' },
      { value: 'publisher', label: 'Publisher', fieldType: 'text' },
      { value: 'volume', label: 'Volume', fieldType: 'text' },
      { value: 'issue', label: 'Issue', fieldType: 'text' },
      { value: 'pages', label: 'Pages', fieldType: 'text' },
      // Identifiers
      { value: 'DOI', label: 'DOI', fieldType: 'text' },
      { value: 'ISBN', label: 'ISBN', fieldType: 'text' },
      { value: 'ISSN', label: 'ISSN', fieldType: 'text' },
      { value: 'url', label: 'URL', fieldType: 'text' },
      { value: 'callNumber', label: 'Call Number', fieldType: 'text' },
      // Other
      { value: 'extra', label: 'Extra', fieldType: 'text' },
      { value: 'itemType', label: 'Item Type', fieldType: 'dropdown' },
      { value: 'tags', label: 'Tags', fieldType: 'text' },
      { value: 'note', label: 'Note', fieldType: 'text' },
      // Location (Books)
      { value: 'place', label: 'Place', fieldType: 'text' },
      { value: 'archiveLocation', label: 'Archive Location', fieldType: 'text' },
      { value: 'libraryCatalog', label: 'Library Catalog', fieldType: 'text' }
    ];
  },

  // Get field type info for a given field
  getFieldTypeInfo: function(fieldValue) {
    const fieldDef = FIELD_TYPES[fieldValue];
    if (fieldDef) {
      return fieldDef;
    }
    return FIELD_TYPES.default;
  },

  // Update the Replace In dropdown based on current conditions
  updateReplaceFieldOptions: function() {
    const replaceFieldSelect = this.elements.replaceFieldSelect;
    if (!replaceFieldSelect) return;

    // Get unique fields from conditions (excluding 'all')
    const fields = [...new Set(this.state.conditions.map(c => c.field))].filter(f => f !== 'all');

    // Get field labels
    const allFieldsMap = {};
    this.getAllFields().forEach(f => allFieldsMap[f.value] = f.label);

    replaceFieldSelect.innerHTML = '';
    fields.forEach(field => {
      const option = document.createElement('option');
      option.value = field;
      option.textContent = allFieldsMap[field] || field;
      replaceFieldSelect.appendChild(option);
    });

    // If current value is not in list, reset to first
    if (replaceFieldSelect.value && !fields.includes(replaceFieldSelect.value)) {
      replaceFieldSelect.value = fields[0] || '';
    }
  },

  // Perform search with multiple conditions
  performSearch: async function() {
    // Get valid conditions (with patterns)
    const validConditions = this.state.conditions.filter(c => c.pattern && c.pattern.trim());
    if (validConditions.length === 0) {
      this.showError('Please enter a search pattern');
      return;
    }

    // Add operators to conditions (first one is implicit AND)
    const conditions = validConditions.map((c, i) => ({
      ...c,
      operator: i === 0 ? 'AND' : (c.operator || 'AND')
    }));

    this.showProgress('Searching...');

    try {
      const SearchEngineClass = getSearchEngine();
      if (!SearchEngineClass) {
        throw new Error('SearchEngine not loaded. Please reload Zotero and try again.');
      }

      const engine = new SearchEngineClass();
      const results = await engine.search(conditions, {
        progressCallback: (progress) => {
          if (progress.phase === 'filter') {
            this.showProgress(`Found ${progress.count} potential matches...`);
          } else if (progress.phase === 'refine') {
            this.showProgress(`Refining ${progress.current}/${progress.total}...`);
          }
        }
      });

      this.state.results = results;
      this.state.fields = conditions.map(c => c.field);
      this.renderResults();

    } catch (e) {
      SRdebug('Error: ' + e.message + (e.stack ? '\n' + e.stack : ''));
      if (e.name === 'SearchError') {
        this.showError(`Search error: ${e.message}`);
      } else {
        this.showError(`Unexpected error: ${e.message}`);
      }
    }
  },

  renderResults: function() {
    const list = this.elements.resultsList;
    while (list.firstChild) {
      list.removeChild(list.firstChild);
    }

    // Group results by itemID to show single line per item
    const itemsByID = new Map();
    for (const result of this.state.results) {
      if (!itemsByID.has(result.itemID)) {
        itemsByID.set(result.itemID, {
          item: result.item,
          matchDetails: []
        });
      }
      itemsByID.get(result.itemID).matchDetails.push(...result.matchDetails);
    }

    for (const [itemID, data] of itemsByID) {
      const item = document.createElement('div');
      item.className = 'result-item';
      item.dataset.itemID = itemID;

      // Get title for display
      const title = data.item.getField('title') || '(Untitled)';
      const itemKey = data.item.key;

      // Create field:value pairs from unique match details
      const fieldChips = [];
      const seenFields = new Set();
      for (const detail of data.matchDetails) {
        if (!seenFields.has(detail.field) && detail.field !== 'title') {
          seenFields.add(detail.field);
          const preview = this.getMatchPreview(detail.value, detail.matchIndex, detail.matchLength);
          // Truncate long values
          const truncated = preview.length > 50 ? preview.substring(0, 47) + '...' : preview;
          const label = this.getFieldLabel(detail.field);
          fieldChips.push(`${label}: "${truncated}"`);
        }
      }

      // Build the display: [Title] | field1: "..." | field2: "..."
      // Title is clickable to open in Zotero
      const titleLink = document.createElement('a');
      titleLink.className = 'result-title result-link';
      titleLink.dataset.itemKey = itemKey;
      titleLink.textContent = title;
      titleLink.href = '#';
      titleLink.style.fontWeight = 'bold';
      titleLink.style.color = '#0066cc';
      titleLink.style.textDecoration = 'none';
      titleLink.style.cursor = 'pointer';
      titleLink.title = 'Open in Zotero';
      titleLink.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openInZotero(itemID);
      });

      const fieldsSpan = document.createElement('span');
      fieldsSpan.className = 'result-fields';
      fieldsSpan.textContent = ' | ' + fieldChips.join(' | ');
      fieldsSpan.style.color = '#666';
      fieldsSpan.style.fontSize = '11px';

      item.appendChild(titleLink);
      item.appendChild(fieldsSpan);

      // Click to select/deselect
      item.addEventListener('click', () => {
        item.classList.toggle('selected');
        const id = parseInt(item.dataset.itemID);
        if (this.state.selectedItemIDs.has(id)) {
          this.state.selectedItemIDs.delete(id);
        } else {
          this.state.selectedItemIDs.add(id);
        }
        this.updateUIState();
      });

      // Double-click to open in Zotero
      item.addEventListener('dblclick', () => {
        this.openInZotero(itemID);
      });

      list.appendChild(item);
    }

    this.elements.resultsCount.textContent = `${this.state.results.length} items found`;
    this.updateUIState();
  },

  // Open item in Zotero - based on zotero-ner implementation
  openInZotero: async function(itemID) {
    try {
      const item = this.state.results.find(r => r.itemID === itemID)?.item;
      if (!item) {
        return;
      }

      const itemKey = item.key;
      const itemLibraryID = item.libraryID;

      // Get Zotero from opener
      const opener = window.opener;

      // Method 1: Use opener.ZoteroPane (like zotero-ner does)
      if (opener && opener.ZoteroPane && opener.ZoteroPane.selectItem) {
        if (opener.Zotero && opener.Zotero.Items && opener.Zotero.Items.getByLibraryAndKeyAsync) {
          const libraryID = opener.Zotero.Libraries ? opener.Zotero.Libraries.userLibraryID : itemLibraryID;
          opener.Zotero.Items.getByLibraryAndKeyAsync(libraryID, itemKey).then(retrievedItem => {
            if (retrievedItem && retrievedItem.id) {
              opener.ZoteroPane.selectItem(retrievedItem.id);
            } else {
              opener.ZoteroPane.selectItem(itemKey);
            }
          }).catch(() => {
            opener.ZoteroPane.selectItem(itemKey);
          });
        } else {
          opener.ZoteroPane.selectItem(itemKey);
        }
        return;
      }

      // Method 2: Use zotero:// URI as last resort
      const zoteroForURL = (opener && opener.Zotero) ? opener.Zotero : getZotero();
      if (zoteroForURL && zoteroForURL.launchURL) {
        const url = 'zotero://select/library/items/' + itemKey;
        zoteroForURL.launchURL(url);
        return;
      }
    } catch (e) {
      // Silent fail - selection is a convenience feature
    }
  },

  getMatchPreview: function(value, matchIndex, matchLength) {
    if (matchIndex < 0) return value;

    const start = Math.max(0, matchIndex - 20);
    const end = Math.min(value.length, matchIndex + matchLength + 20);
    let preview = value.substring(start, end);

    if (start > 0) preview = '...' + preview;
    if (end < value.length) preview = preview + '...';

    return preview;
  },

  selectAll: function() {
    const items = this.elements.resultsList.querySelectorAll('.result-item');
    items.forEach(item => {
      item.classList.add('selected');
      this.state.selectedItemIDs.add(parseInt(item.dataset.itemID));
    });
    this.updateUIState();
  },

  deselectAll: function() {
    const items = this.elements.resultsList.querySelectorAll('.result-item');
    items.forEach(item => {
      item.classList.remove('selected');
    });
    this.state.selectedItemIDs.clear();
    this.updateUIState();
  },

  previewReplace: async function() {
    if (this.state.results.length === 0) {
      this.showError('No results to preview');
      return;
    }

    // Get first valid condition
    const validConditions = this.state.conditions.filter(c => c.pattern && c.pattern.trim());
    if (validConditions.length === 0) {
      this.showError('Please enter a search pattern');
      return;
    }
    const condition = validConditions[0];

    const firstResult = this.state.results[0];
    const searchPattern = condition.pattern;
    const replacePattern = this.elements.replaceInput ? this.elements.replaceInput.value : '';
    const patternType = condition.patternType || 'regex';
    const caseSensitive = condition.caseSensitive || false;

    // Determine which fields to preview
    let fieldsToPreview;
    if (this.elements.replaceFieldSelect && this.elements.replaceFieldSelect.value) {
      fieldsToPreview = [this.elements.replaceFieldSelect.value];
    } else {
      fieldsToPreview = this.state.fields;
    }

    try {
      const ReplaceEngineClass = getReplaceEngine();
      if (!ReplaceEngineClass) {
        throw new Error('ReplaceEngine not loaded. Please reload Zotero and try again.');
      }

      const engine = new ReplaceEngineClass();
      const changes = engine.previewReplace(firstResult.item, searchPattern, replacePattern, {
        fields: fieldsToPreview,
        patternType,
        caseSensitive
      });

      if (changes.length === 0) {
        this.elements.previewOutput.value = 'No changes would be made';
      } else {
        let preview = 'Preview for first item:\n\n';
        for (const change of changes) {
          preview += `${change.field}:\n`;
          preview += `  Original: "${change.original}"\n`;
          preview += `  Replaced: "${change.replaced}"\n\n`;
        }
        this.elements.previewOutput.value = preview;
      }
    } catch (e) {
      this.showError(`Preview error: ${e.message}`);
    }
  },

  applyReplace: async function() {
    const selectedIDs = Array.from(this.state.selectedItemIDs);
    if (selectedIDs.length === 0) {
      this.showError('No items selected');
      return;
    }

    // Get first valid condition
    const validConditions = this.state.conditions.filter(c => c.pattern && c.pattern.trim());
    if (validConditions.length === 0) {
      this.showError('Please enter a search pattern');
      return;
    }
    const condition = validConditions[0];

    const selectedItems = this.state.results
      .filter(r => this.state.selectedItemIDs.has(r.itemID))
      .map(r => r.item);

    const searchPattern = condition.pattern;
    const replacePattern = this.elements.replaceInput ? this.elements.replaceInput.value : '';
    const patternType = condition.patternType || 'regex';
    const caseSensitive = condition.caseSensitive || false;

    // Determine which fields to replace - must select a Replace In field
    if (!this.elements.replaceFieldSelect || !this.elements.replaceFieldSelect.value) {
      this.showError('Please select which field to replace in (use "Replace In" dropdown)');
      return;
    }
    const fieldsToReplace = [this.elements.replaceFieldSelect.value];

    if (!confirm(`Replace in ${selectedItems.length} items?`)) {
      return;
    }

    let progressWindow = null;

    try {
      // Try to open progress window (may fail in some contexts)
      try {
        progressWindow = window.open('progress.html', 'progress',
          'width=400,height=200,modal=yes,centerscreen');
      } catch (pwError) {
        SRdebug('Could not open progress window: ' + pwError.message);
      }

      const ReplaceEngineClass = getReplaceEngine();
      if (!ReplaceEngineClass) {
        throw new Error('ReplaceEngine not loaded. Please reload Zotero and try again.');
      }

      const engine = new ReplaceEngineClass();
      const result = await engine.processItems(selectedItems, searchPattern, replacePattern, {
        fields: fieldsToReplace,
        patternType,
        caseSensitive,
        progressCallback: (progress) => {
          this.updateProgress(progressWindow, progress);
        }
      });

      if (progressWindow && !progressWindow.closed) {
        progressWindow.close();
      }

      let message = `Modified: ${result.modified}\n`;
      message += `Skipped: ${result.skipped}\n`;
      if (result.errors.length > 0) {
        message += `Errors: ${result.errors.length}`;
      }
      alert(message);

      this.performSearch();

    } catch (e) {
      if (progressWindow && !progressWindow.closed) {
        progressWindow.close();
      }
      this.showError(`Replace failed: ${e.message}`);
    }
  },

  createCollection: async function() {
    const selectedIDs = Array.from(this.state.selectedItemIDs);
    if (selectedIDs.length === 0) {
      this.showError('No items selected');
      return;
    }

    const name = prompt('Enter collection name:');
    if (!name) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      this.showError('Collection name cannot be empty');
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

      alert(`Created collection "${trimmedName}" with ${selectedIDs.length} items`);

    } catch (e) {
      this.showError(`Failed to create collection: ${e.message}`);
    }
  },

  loadPreloadedPatterns: function() {
    // Try multiple ways to access patterns
    var patterns = null;

    // Try from window.arguments (passed from open())
    try {
      if (window.arguments && window.arguments[0]) {
        var args = window.arguments[0];
        patterns = args.patterns;
        if (patterns && patterns.length > 0) {
          SRdebug('Found patterns from window.arguments:', patterns.length);
        }
      }
    } catch (e) {
      SRdebug('window.arguments access error:', e);
    }

    // Try from opener window (for dialogs opened via openDialog)
    if (!patterns || patterns.length === 0) {
      try {
        if (window.opener && window.opener.ZoteroSearchReplace) {
          patterns = window.opener.ZoteroSearchReplace.DATA_QUALITY_PATTERNS;
          if (patterns) {
            SRdebug('Found patterns from opener:', patterns.length);
          }
        }
      } catch (e) {
        SRdebug('Cross-origin access error:', e);
      }
    }

    // Try from Zotero global
    if (!patterns || patterns.length === 0) {
      if (typeof Zotero !== 'undefined' && Zotero.SearchReplace) {
        patterns = Zotero.SearchReplace.DATA_QUALITY_PATTERNS;
        if (patterns) {
          SRdebug('Found patterns from Zotero.SearchReplace:', patterns.length);
        }
      }
    }

    // Fallback to embedded patterns
    if (!patterns || patterns.length === 0) {
      patterns = EMBEDDED_PATTERNS;
      SRdebug('Using embedded patterns:', patterns.length);
    }

    // Store patterns globally for other scripts
    window.DATA_QUALITY_PATTERNS = patterns;

    const container = this.elements.patternsList;
    if (!container) return;

    const categories = {};
    // Build category divs first
    for (const pattern of patterns) {
      if (!categories[pattern.category]) {
        const catDiv = document.createElement('div');
        catDiv.className = 'pattern-category';
        const catTitle = document.createElement('strong');
        catTitle.textContent = pattern.category;
        container.appendChild(catDiv);
        categories[pattern.category] = catDiv;
      }
    }

    // Now add patterns to their categories
    for (const pattern of patterns) {
      const catDiv = categories[pattern.category];
      const item = document.createElement('div');
      item.className = 'pattern-item';

      const name = document.createElement('span');
      name.className = 'pattern-name';
      name.textContent = pattern.name;

      const desc = document.createElement('span');
      desc.className = 'pattern-desc';
      desc.textContent = pattern.description;

      item.appendChild(name);
      item.appendChild(desc);

      item.addEventListener('click', () => {
        // Clear previous selection
        container.querySelectorAll('.pattern-item.selected').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');

        // Get the first condition (or create one if none exist)
        if (this.state.conditions.length === 0) {
          this.state.conditions.push({
            operator: 'AND',
            field: 'title',
            pattern: '',
            patternType: 'regex',
            caseSensitive: false
          });
        }
        const condition = this.state.conditions[0];

        // Set condition values from pattern
        condition.pattern = pattern.search || '';
        if (pattern.fields && pattern.fields.length > 0) {
          condition.field = pattern.fields[0];
        }
        if (pattern.patternType) {
          condition.patternType = pattern.patternType;
        }

        // Set replace input
        if (this.elements.replaceInput) {
          this.elements.replaceInput.value = typeof pattern.replace === 'function' ? '' : (pattern.replace || '');
        }

        // Set Replace In dropdown - use first field from pattern
        if (pattern.fields && pattern.fields.length > 0 && this.elements.replaceFieldSelect) {
          const replaceField = pattern.fields[0];
          // Populate and select the field
          this.updateReplaceFieldOptions();
          this.elements.replaceFieldSelect.value = replaceField;
        }

        // Re-render conditions to show the updated values
        this.renderConditions();
      });

      catDiv.appendChild(item);
    }
  },

  updateUIState: function() {
    const hasResults = this.state.results.length > 0;
    const hasSelection = this.state.selectedItemIDs.size > 0;
    const hasReplace = this.elements.replaceInput && this.elements.replaceInput.value.length > 0;

    if (this.elements.applyReplaceButton) {
      this.elements.applyReplaceButton.disabled = !hasSelection;
    }
  },

  showError: function(message) {
    this.elements.searchError.textContent = message;
    setTimeout(() => {
      this.elements.searchError.textContent = '';
    }, 5000);
  },

  showProgress: function(message) {
    this.elements.resultsCount.textContent = message;
  },

  updateProgress: function(progressWindow, progress) {
    if (progressWindow && !progressWindow.closed) {
      const percent = Math.round((progress.current / progress.total) * 100);
      try {
        progressWindow.postMessage({ type: 'progress', percent, status: progress.status }, '*');
      } catch (e) {
        // postMessage might not work for XUL dialogs
      }
    }
  }
};

document.addEventListener('DOMContentLoaded', function() {
  ZoteroSearchDialog.init();
});
