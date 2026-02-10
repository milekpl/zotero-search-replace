/**
 * Entry point for bundling all Search & Replace functionality
 * This file exports all core modules for use in the bundled extension
 */

// Console polyfill for Zotero 8 compatibility
if (typeof console === 'undefined') {
  globalThis.console = {
    log: function(...args) {
      if (typeof Zotero !== 'undefined' && Zotero.debug) {
        Zotero.debug('SearchReplace: ' + args.join(' '));
      }
    },
    warn: function(...args) {
      if (typeof Zotero !== 'undefined' && Zotero.debug) {
        Zotero.debug('SearchReplace WARN: ' + args.join(' '));
      }
    },
    error: function(...args) {
      if (typeof Zotero !== 'undefined' && Zotero.debug) {
        Zotero.debug('SearchReplace ERROR: ' + args.join(' '));
      }
    },
    info: function(...args) {
      if (typeof Zotero !== 'undefined' && Zotero.debug) {
        Zotero.debug('SearchReplace INFO: ' + args.join(' '));
      }
    },
    debug: function(...args) {
      if (typeof Zotero !== 'undefined' && Zotero.debug) {
        Zotero.debug('SearchReplace DEBUG: ' + args.join(' '));
      }
    }
  };
}

// Core modules
import SearchEngine from './zotero/search-engine.js';
import ReplaceEngine from './zotero/replace-engine.js';
import ProgressManager from './zotero/progress-manager.js';

// Patterns module
import { DATA_QUALITY_PATTERNS, PATTERN_CATEGORIES } from './patterns/quality-patterns.js';

// UI modules (loaded separately in dialogs)
import SearchDialog from './ui/search-dialog.js';

// Create the ZoteroSearchReplace namespace
const ZoteroSearchReplace = {
  SearchEngine,
  ReplaceEngine,
  ProgressManager,
  DATA_QUALITY_PATTERNS,
  PATTERN_CATEGORIES,
  SearchDialog,
  hooks: {
    onStartup: () => {
      if (typeof Zotero !== 'undefined' && Zotero.NameNormalizer && Zotero.NameNormalizer.MenuIntegration) {
        // Reuse zotero-ner's menu integration hook if available
      }
      console.log('Search & Replace: Plugin started');
    },
    onShutdown: () => {
      console.log('Search & Replace: Plugin shutting down');
    }
  },
  initialized: true
};

// Export modules for use in other modules
export {
  SearchEngine,
  ReplaceEngine,
  ProgressManager,
  DATA_QUALITY_PATTERNS,
  PATTERN_CATEGORIES,
  SearchDialog
};

export default ZoteroSearchReplace;

// Also expose on window/global for non-module contexts
if (typeof window !== 'undefined') {
  window.ZoteroSearchReplace = ZoteroSearchReplace;
} else if (typeof globalThis !== 'undefined') {
  globalThis.ZoteroSearchReplace = ZoteroSearchReplace;
}
