/**
 * Dialog Controller for Zotero Search & Replace Plugin
 * This script handles the HTML dialog UI interactions
 */

// Embedded patterns for standalone dialog access
var EMBEDDED_PATTERNS = [
  { id: 'fix-comma-space', name: 'Fix: Space Before Comma', description: 'Fixes "surname , name" -> "surname, name"', search: ' ,', replace: ',', category: 'Parsing Errors', fields: ['creator.lastName', 'creator.firstName'] },
  { id: 'fix-jr-suffix', name: 'Fix: Move Jr/Sr Suffix', description: 'Moves "Jr" from given name to surname', search: '(.+), (Jr|Sr|III|II|IV)$', replace: '$2, $1', category: 'Parsing Errors', fields: ['creator.lastName', 'creator.firstName'] },
  { id: 'fix-double-comma', name: 'Fix: Double Commas', description: 'Removes duplicate commas in author names', search: ',,', replace: ',', category: 'Parsing Errors', fields: ['creator.lastName', 'creator.firstName'] },
  { id: 'fix-trailing-comma', name: 'Fix: Trailing Comma', description: 'Removes trailing comma at end of name', search: ',$', replace: '', category: 'Parsing Errors', fields: ['creator.lastName'] },
  { id: 'remove-parens', name: 'Remove: Nicknames in Parens', description: 'Removes "(nickname)" from names', search: '\\s*\\([^)]+\\)\\s*', replace: '', category: 'Data Quality', fields: ['creator.firstName', 'creator.lastName'] },
  { id: 'lowercase-van-de', name: 'Normalize: Dutch Prefixes', description: 'Ensures van/de prefixes stay lowercase', search: '\\b(Van|De|Van Der|De La)\\b', replace: (m) => m.toLowerCase(), category: 'Capitalization', fields: ['creator.lastName'] },
  { id: 'lowercase-von', name: 'Normalize: German von', description: 'Ensures von prefix stays lowercase', search: '\\bVon\\b', replace: 'von', category: 'Capitalization', fields: ['creator.lastName'] },
  { id: 'normalize-mc-mac', name: 'Normalize: Mc/Mac Prefixes', description: 'Fixes MCCULLOCH -> McCulloch', search: '\\bMc([A-Z][a-z]+)', replace: 'Mc$1', category: 'Capitalization', fields: ['creator.lastName'] },
  { id: 'normalize-mac', name: 'Normalize: Mac Prefix', description: 'Fixes MAC->Mac when followed by lowercase', search: '\\bMac([a-z])', replace: (m) => 'Mac' + m[3].toUpperCase(), category: 'Capitalization', fields: ['creator.lastName'] },
  { id: 'fix-polish-diacritics', name: 'Restore: Polish Diacritics', description: 'Fixes common diacritics errors for Polish names', search: '[lns]slash', replace: (m) => ({ 'lslash': 'ł', 'nslash': 'ń', 'sslash': 'ś' }[m] || m), category: 'Diacritics', fields: ['creator.lastName', 'creator.firstName', 'title'] },
  { id: 'fix-german-diacritics', name: 'Restore: German Diacritics', description: 'Fixes German umlauts from stripped characters', search: 'a"', replace: 'ä', category: 'Diacritics', fields: ['creator.lastName', 'creator.firstName', 'title'] },
  { id: 'find-empty-titles', name: 'Find: Empty Titles', description: 'Find items with missing or empty titles', search: '^\\s*$', replace: '', category: 'Data Quality', fields: ['title'] },
  { id: 'fix-url-http', name: 'Normalize: HTTP to HTTPS', description: 'Updates URLs from http:// to https://', search: 'http://', replace: 'https://', category: 'Data Quality', fields: ['url'] },
  { id: 'find-corporate-authors', name: 'Find: Corporate Authors', description: 'Find likely corporate/group authors', search: '(Collaborators|Group|Association|Institute|Center|Society|Journal|Proceedings)$', replace: '', category: 'Classification', fields: ['creator.lastName'] },
  { id: 'find-journal-in-author', name: 'Find: Journal Name in Author', description: 'Find items where journal name appears as author', search: '(Journal|Review|Proceedings|Transactions)', replace: '', category: 'Classification', fields: ['creator.lastName'] }
];

var EMBEDDED_CATEGORIES = ['Parsing Errors', 'Capitalization', 'Diacritics', 'Data Quality', 'Classification'];

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
    replacedCount: 0
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
    this.loadPreloadedPatterns();
    this.updateUIState();
    SRdebug('Dialog init complete');
  },

  cacheElements: function() {
    this.elements = {
      searchInput: document.getElementById('search-input'),
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
      previewReplaceButton: document.getElementById('preview-replace')
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
  },

  performSearch: async function() {
    const pattern = this.elements.searchInput.value;
    if (!pattern) {
      this.showError('Please enter a search pattern');
      return;
    }

    const field = this.elements.searchField.value;
    const allFields = [
      'title', 'abstractNote', 'tags', 'date', 'dateModified', 'publicationTitle',
      'publisher', 'DOI', 'ISBN', 'ISSN', 'url', 'callNumber', 'extra',
      'creator.lastName', 'creator.firstName', 'creator.fullName',
      'note', 'itemType'
    ];
    const fields = field === 'all' ? allFields : [field];

    const patternType = this.elements.patternType.value;
    const caseSensitive = this.elements.caseSensitive.checked;

    this.showProgress('Searching...');

    try {
      const SearchEngineClass = getSearchEngine();
      if (!SearchEngineClass) {
        throw new Error('SearchEngine not loaded. Please reload Zotero and try again.');
      }

      const engine = new SearchEngineClass();
      const results = await engine.search(pattern, {
        fields,
        patternType,
        caseSensitive,
        progressCallback: (progress) => {
          if (progress.phase === 'filter') {
            this.showProgress(`Found ${progress.count} potential matches...`);
          } else if (progress.phase === 'refine') {
            this.showProgress(`Refining ${progress.current}/${progress.total}...`);
          }
        }
      });

      this.state.results = results;
      this.state.fields = fields;
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

    for (const result of this.state.results) {
      for (const detail of result.matchDetails) {
        const item = document.createElement('div');
        item.className = 'result-item';
        item.dataset.itemID = result.itemID;

        const title = document.createElement('span');
        title.textContent = result.item.getField('title');
        title.style.flex = '1';

        const field = document.createElement('span');
        field.textContent = detail.field;
        field.style.width = '120px';

        const match = document.createElement('span');
        const preview = this.getMatchPreview(detail.value, detail.matchIndex, detail.matchLength);
        match.textContent = preview;

        item.appendChild(title);
        item.appendChild(field);
        item.appendChild(match);

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

        list.appendChild(item);
      }
    }

    this.elements.resultsCount.textContent = `${this.state.results.length} items found`;
    this.updateUIState();
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

    const firstResult = this.state.results[0];
    const searchPattern = this.elements.searchInput.value;
    const replacePattern = this.elements.replaceInput.value;
    const patternType = this.elements.patternType.value;
    const caseSensitive = this.elements.caseSensitive.checked;

    try {
      const ReplaceEngineClass = getReplaceEngine();
      if (!ReplaceEngineClass) {
        throw new Error('ReplaceEngine not loaded. Please reload Zotero and try again.');
      }

      const engine = new ReplaceEngineClass();
      const changes = engine.previewReplace(firstResult.item, searchPattern, replacePattern, {
        fields: this.state.fields,
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

    const selectedItems = this.state.results
      .filter(r => this.state.selectedItemIDs.has(r.itemID))
      .map(r => r.item);

    const searchPattern = this.elements.searchInput.value;
    const replacePattern = this.elements.replaceInput.value;
    const patternType = this.elements.patternType.value;
    const caseSensitive = this.elements.caseSensitive.checked;

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
        fields: this.state.fields,
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
        this.elements.searchInput.value = pattern.search || '';
        this.elements.replaceInput.value = typeof pattern.replace === 'function' ? '' : (pattern.replace || '');
        if (pattern.fields && pattern.fields.length > 0) {
          this.elements.searchField.value = pattern.fields[0];
        }
        if (pattern.patternType) {
          this.elements.patternType.value = pattern.patternType;
        }
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
