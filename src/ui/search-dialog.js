/**
 * Search Dialog Controller for Zotero Search & Replace Plugin
 * Handles the main search and replace dialog UI
 */

class SearchDialog {
  constructor(window) {
    this.window = window;
    this.state = {
      searchPattern: '',
      replacePattern: '',
      patternType: 'regex',
      caseSensitive: false,
      fields: [],
      results: [],
      selectedItemIDs: new Set(),
      replacedCount: 0
    };
    this.elements = {};
  }

  // Open the dialog
  static open() {
    const mainWindow = Services.wm.getMostRecentWindow('navigator:browser');

    // Get patterns from the main window scope
    const patterns = mainWindow.ZoteroSearchReplace?.DATA_QUALITY_PATTERNS || [];
    const categories = mainWindow.ZoteroSearchReplace?.PATTERN_CATEGORIES || [];

    // Open dialog with patterns passed via window.arguments
    // Also pass Zotero so the HTML dialog can access Zotero APIs
    const dialogArgs = {
      patterns,
      categories,
      ZoteroSearchReplace: mainWindow.ZoteroSearchReplace,
      Zotero: mainWindow.Zotero
    };

    const dialogWindow = mainWindow.openDialog(
      'chrome://zotero-search-replace/content/dialog.html',
      'zotero-search-replace-dialog',
      'chrome,centerscreen,resizable=yes,width=800,height=600',
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
    // Try to get ZoteroSearchReplace from opener window
    try {
      if (this.window.opener && this.window.opener.ZoteroSearchReplace) {
        this.window.__zotero_scope__ = this.window.opener;
        console.log('SearchReplace: Using scope from window.opener');
        return;
      }
    } catch (e) {
      console.log('SearchReplace: Could not access window.opener:', e.message);
    }

    // Try from arguments (passed via openDialog)
    try {
      if (this.window.arguments && this.window.arguments[0]) {
        const args = this.window.arguments[0];
        if (args.ZoteroSearchReplace) {
          this.window.__zotero_scope__ = { ZoteroSearchReplace: args.ZoteroSearchReplace };
          console.log('SearchReplace: Using scope from window.arguments');
          return;
        }
      }
    } catch (e) {
      console.log('SearchReplace: Could not access window.arguments:', e.message);
    }

    // Try from window (if running in same process)
    if (this.window.ZoteroSearchReplace) {
      this.window.__zotero_scope__ = this.window;
      console.log('SearchReplace: Using scope from window');
      return;
    }

    console.log('SearchReplace: No scope available, using fallback');
  }

  cacheElements() {
    this.elements = {
      searchInput: this.window.document.getElementById('search-input'),
      searchField: this.window.document.getElementById('search-field'),
      patternType: this.window.document.getElementById('pattern-type'),
      caseSensitive: this.window.document.getElementById('case-sensitive'),
      searchButton: this.window.document.getElementById('search-button'),
      resultsCount: this.window.document.getElementById('results-count'),
      resultsList: this.window.document.getElementById('results-list'),
      replaceInput: this.window.document.getElementById('replace-input'),
      previewOutput: this.window.document.getElementById('preview-output'),
      applyReplaceButton: this.window.document.getElementById('apply-replace'),
      createCollection: this.window.document.getElementById('create-collection'),
      patternsList: this.window.document.getElementById('patterns-list'),
      searchError: this.window.document.getElementById('search-error'),
      selectAll: this.window.document.getElementById('select-all'),
      deselectAll: this.window.document.getElementById('deselect-all'),
      previewReplaceButton: this.window.document.getElementById('preview-replace')
    };
  }

  setupEventListeners() {
    // Search button
    if (this.elements.searchButton) {
      this.elements.searchButton.addEventListener('click', () => this.performSearch());
    }

    // Preview button
    if (this.elements.previewReplaceButton) {
      this.elements.previewReplaceButton.addEventListener('click', () => this.previewReplace());
    }

    // Apply replace button
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

    // Keyboard shortcuts
    this.window.document.addEventListener('keydown', (event) => {
      const target = event.target.tagName;
      if (target === 'INPUT' || target === 'TEXTAREA' || target === 'SELECT') {
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        if (event.key === 'Enter') {
          event.preventDefault();
          this.performSearch();
        } else if (event.key === 'r') {
          event.preventDefault();
          if (this.elements.replaceInput) {
            this.elements.replaceInput.focus();
          }
        }
      } else if (event.key === 'Escape') {
        this.window.close();
      }
    });
  }

  async performSearch() {
    const pattern = this.elements.searchInput.value;
    if (!pattern) {
      this.showError('Please enter a search pattern');
      return;
    }

    const field = this.elements.searchField.value;
    const fields = field === 'all'
      ? ['title', 'abstractNote', 'tags', 'date', 'publicationTitle', 'DOI', 'extra',
        'creator.lastName', 'creator.firstName']
      : [field];

    const patternType = this.elements.patternType.value;
    const caseSensitive = this.elements.caseSensitive.checked;

    this.showProgress('Searching...');

    try {
      // Access the bundled SearchEngine
      const scope = this.window.__zotero_scope__ || this.window;
      const SearchEngine = scope.ZoteroSearchReplace?.SearchEngine || scope.SearchEngine;

      if (!SearchEngine) {
        throw new Error('SearchEngine not loaded');
      }

      const engine = new SearchEngine();
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
      if (e.name === 'SearchError') {
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
        const item = this.window.document.createElement('div');
        item.className = 'result-item';
        item.dataset.itemID = result.itemID;

        const title = this.window.document.createElement('span');
        title.textContent = result.item.getField('title');
        title.style.flex = '1';

        const field = this.window.document.createElement('span');
        field.textContent = detail.field;
        field.style.width = '120px';

        const match = this.window.document.createElement('span');
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
  }

  getMatchPreview(value, matchIndex, matchLength) {
    if (matchIndex < 0) return value;

    const start = Math.max(0, matchIndex - 20);
    const end = Math.min(value.length, matchIndex + matchLength + 20);
    let preview = value.substring(start, end);

    if (start > 0) preview = '...' + preview;
    if (end < value.length) preview = preview + '...';

    return preview;
  }

  selectAll() {
    const items = this.elements.resultsList.querySelectorAll('.result-item');
    items.forEach(item => {
      item.classList.add('selected');
      this.state.selectedItemIDs.add(parseInt(item.dataset.itemID));
    });
    this.updateUIState();
  }

  deselectAll() {
    const items = this.elements.resultsList.querySelectorAll('.result-item');
    items.forEach(item => {
      item.classList.remove('selected');
    });
    this.state.selectedItemIDs.clear();
    this.updateUIState();
  }

  async previewReplace() {
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
      const scope = this.window.__zotero_scope__ || this.window;
      const ReplaceEngine = scope.ZoteroSearchReplace?.ReplaceEngine || scope.ReplaceEngine;

      if (!ReplaceEngine) {
        throw new Error('ReplaceEngine not loaded');
      }

      const engine = new ReplaceEngine();
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
  }

  async applyReplace() {
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

    if (!Services.prompt.confirmCount(null, 'Search & Replace',
      `Replace in ${selectedItems.length} items?`)) {
      return;
    }

    const progressWindow = this.window.open('progress.html', 'progress',
      'width=400,height=200,modal=yes,centerscreen');

    try {
      const scope = this.window.__zotero_scope__ || this.window;
      const ReplaceEngine = scope.ZoteroSearchReplace?.ReplaceEngine || scope.ReplaceEngine;

      if (!ReplaceEngine) {
        throw new Error('ReplaceEngine not loaded');
      }

      const engine = new ReplaceEngine();
      const result = await engine.processItems(selectedItems, searchPattern, replacePattern, {
        fields: this.state.fields,
        patternType,
        caseSensitive,
        progressCallback: (progress) => {
          this.updateProgress(progressWindow, progress);
        }
      });

      progressWindow.close();

      let message = `Modified: ${result.modified}\n`;
      message += `Skipped: ${result.skipped}\n`;
      if (result.errors.length > 0) {
        message += `Errors: ${result.errors.length}`;
      }
      Services.prompt.alert(null, 'Search & Replace', message);

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
      this.showError('No items selected');
      return;
    }

    const name = Services.prompt.prompt(null, 'Search & Replace', 'Enter collection name:');
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

      Services.prompt.alert(null, 'Search & Replace',
        `Created collection "${trimmedName}" with ${selectedIDs.length} items`);

    } catch (e) {
      this.showError(`Failed to create collection: ${e.message}`);
    }
  }

  loadPreloadedPatterns() {
    let patterns = null;

    // First try: from window.arguments (passed from open())
    try {
      if (this.window.arguments && this.window.arguments[0]) {
        const args = this.window.arguments[0];
        patterns = args.patterns;
        if (patterns && patterns.length > 0) {
          console.log('Found patterns from window.arguments');
        }
      }
    } catch (e) {
      console.log('window.arguments access error:', e.message);
    }

    // Second try: from opener window
    if (!patterns || patterns.length === 0) {
      try {
        if (this.window.opener && this.window.opener.ZoteroSearchReplace) {
          patterns = this.window.opener.ZoteroSearchReplace.DATA_QUALITY_PATTERNS;
          if (patterns) {
            console.log('Found patterns from opener');
          }
        }
      } catch (e) {
        console.log('opener access error:', e.message);
      }
    }

    // Third try: from __zotero_scope__
    if (!patterns || patterns.length === 0) {
      const scope = this.window.__zotero_scope__ || this.window;
      patterns = scope.ZoteroSearchReplace?.DATA_QUALITY_PATTERNS;
      if (patterns) {
        console.log('Found patterns from __zotero_scope__');
      }
    }

    // Fourth try: inject into dialog DOM for dialog-controller.js access
    if (patterns && patterns.length > 0) {
      this.window.DATA_QUALITY_PATTERNS = patterns;
      console.log('Injected patterns into window.DATA_QUALITY_PATTERNS');
    }

    if (!patterns || patterns.length === 0) {
      console.log('No patterns found');
      return;
    }

    console.log('Loading', patterns.length, 'patterns');

    const container = this.elements.patternsList;
    if (!container) return;

    const categories = {};
    for (const pattern of patterns) {
      if (!categories[pattern.category]) {
        const catDiv = this.window.document.createElement('div');
        catDiv.className = 'pattern-category';
        const catTitle = this.window.document.createElement('strong');
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
        const item = this.window.document.createElement('div');
        item.className = 'pattern-item';

        const name = this.window.document.createElement('span');
        name.textContent = pattern.name;

        const desc = this.window.document.createElement('span');
        desc.style.color = '#666';
        desc.style.fontSize = '12px';
        desc.textContent = pattern.description;

        item.appendChild(name);
        item.appendChild(desc);

        item.addEventListener('click', () => {
          this.elements.searchInput.value = pattern.search || '';
          this.elements.replaceInput.value = pattern.replace || '';
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
        this.elements.searchError.textContent = '';
      }, 5000);
    }
  }

  showProgress(message) {
    if (this.elements.resultsCount) {
      this.elements.resultsCount.textContent = message;
    }
  }

  updateProgress(progressWindow, progress) {
    if (progressWindow && !progressWindow.closed) {
      const percent = Math.round((progress.current / progress.total) * 100);
      try {
        progressWindow.postMessage({ type: 'progress', percent, status: progress.status }, '*');
      } catch (e) {
        // postMessage might not work for XUL dialogs
      }
    }
  }
}

export default SearchDialog;
