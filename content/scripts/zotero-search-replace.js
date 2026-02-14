/**
 * Zotero Search & Replace Integration Script
 * Handles menu integration and UI for the Zotero interface
 */

if (typeof Zotero !== 'undefined') {
  // Ensure Zotero.SearchReplace exists
  if (!Zotero.SearchReplace) {
    Zotero.SearchReplace = {};
  }

  var ZSR = Zotero.SearchReplace;

  // Add menu integration properties
  ZSR.initialized = false;
  ZSR.rootURI = null;
  ZSR.windowStates = new Map();
  ZSR.menuItemId = 'zotero-search-replace-menu-item';

  // Reference to bundled modules (set during init)
  ZSR.searchEngine = null;
  ZSR.replaceEngine = null;
  ZSR.searchDialog = null;

  ZSR.hooks = {
    onStartup: function() {
      console.log('Search & Replace: Zotero.SearchReplace.hooks.onStartup called.');
    },
    onMainWindowLoad: function(window) {
      console.log('Search & Replace: Zotero.SearchReplace.hooks.onMainWindowLoad called.');
      ZSR.init({ rootURI: globalThis.registeredRootURI, window: window });
    },
    onMainWindowUnload: function(window) {
      console.log('Search & Replace: Zotero.SearchReplace.hooks.onMainWindowUnload called.');
      ZSR.teardown(window);
    }
  };

  ZSR.log = function(message) {
    var formatted = 'SearchReplace: ' + message;
    if (typeof Zotero !== 'undefined' && typeof Zotero.debug === 'function') {
      Zotero.debug(formatted);
    } else {
      console.log(formatted);
    }
  };

  ZSR.addUIElements = function(targetWindow) {
    var windowHref = targetWindow && targetWindow.location && targetWindow.location.href
      ? targetWindow.location.href
      : 'unknown';
    this.log('addUIElements called for window: ' + windowHref);
    var win = targetWindow;
    if (!win || !win.document) {
      this.log('No window available to add UI elements');
      return;
    }

    var doc = win.document;
    var state = this.windowStates.get(win) || {};
    var commandHandler = ((event) => {
      if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      this.showDialog();
    });
    state.commandHandler = commandHandler;

    var ensureMenuItem = () => {
      this.log('Attempting to add menu item');
      try {
        // Get the root URI for icon
        var rootURI = this.rootURI || '';

        // Find Edit menu popup (preferred) - looking for Find/Advanced Search vicinity
        var editPopupSelectors = [
          '#menu_EditPopup',
          '#menu-edit-popup',
          '#zotero-pane-edit-menupopup'
        ];
        var toolsPopupSelectors = [
          '#menu_ToolsPopup',
          '#menu-tools-popup',
          '#zotero-pane-tools-menupopup'
        ];

        var targetPopup = null;
        var popupType = '';

        // Try Edit menu first
        for (var j = 0; j < editPopupSelectors.length; j++) {
          var editPopup = doc.querySelector(editPopupSelectors[j]);
          if (editPopup) {
            targetPopup = editPopup;
            popupType = 'Edit';
            this.log('Found Edit popup: ' + editPopupSelectors[j]);
            break;
          }
        }

        // Fall back to Tools menu
        if (!targetPopup) {
          for (var j = 0; j < toolsPopupSelectors.length; j++) {
            var toolsPopup = doc.querySelector(toolsPopupSelectors[j]);
            if (toolsPopup) {
              targetPopup = toolsPopup;
              popupType = 'Tools';
              this.log('Found Tools popup: ' + toolsPopupSelectors[j]);
              break;
            }
          }
        }

        if (!targetPopup) {
          this.log('Could not find menu popup');
          return;
        }

        this.log('Found ' + popupType + ' popup');

        var menuItem = doc.getElementById(this.menuItemId);
        if (!menuItem) {
          if (typeof doc.createXULElement === 'function') {
            menuItem = doc.createXULElement('menuitem');
          } else if (typeof doc.createElementNS === 'function') {
            menuItem = doc.createElementNS(
              'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul',
              'menuitem',
            );
          } else if (typeof doc.createElement === 'function') {
            menuItem = doc.createElement('menuitem');
          } else {
            this.log('Document does not support creating menu items');
            return;
          }
          menuItem.id = this.menuItemId;
          menuItem.setAttribute('label', 'Search & Replace...');
          menuItem.setAttribute('tooltiptext', 'Search and replace in your library');

          // Add icon using chrome URL
          if (rootURI) {
            var iconPath = rootURI + 'content/icons/icon.svg';
            menuItem.setAttribute('image', iconPath);
          }

          menuItem.addEventListener('command', commandHandler);

          // Insert near Find menu item in Edit menu, or append to Tools
          if (popupType === 'Edit') {
            // Try to find "Find" related items to insert near them
            var findRelatedItems = targetPopup.querySelectorAll('menuitem');
            var inserted = false;
            for (var k = 0; k < findRelatedItems.length; k++) {
              var label = findRelatedItems[k].getAttribute('label') || '';
              // Insert after items containing "Find" or before Advanced Search
              if (label.toLowerCase().indexOf('find') !== -1 ||
                  label.indexOf('Advanced Search') !== -1) {
                if (label.indexOf('Advanced Search') !== -1) {
                  // Insert before Advanced Search
                  targetPopup.insertBefore(menuItem, findRelatedItems[k]);
                  inserted = true;
                  this.log('Inserted before: ' + label);
                  break;
                }
                // For Find items, we'll insert after if we haven't already
              }
            }
            if (!inserted) {
              // Try to insert after Find menu if found
              var findItem = targetPopup.querySelector('menuitem[label*="Find"]');
              if (findItem && findItem.nextSibling) {
                targetPopup.insertBefore(menuItem, findItem.nextSibling);
                this.log('Inserted after Find menu');
              } else {
                // Insert before separator before Advanced Search if exists
                var advancedBefore = null;
                var children = targetPopup.children;
                for (var c = 0; c < children.length; c++) {
                  var nextSibling = children[c].nextSibling;
                  if (nextSibling && nextSibling.tagName === 'menuitem' &&
                      nextSibling.getAttribute('label') &&
                      nextSibling.getAttribute('label').indexOf('Advanced Search') !== -1) {
                    advancedBefore = children[c];
                    break;
                  }
                }
                if (advancedBefore) {
                  targetPopup.insertBefore(menuItem, advancedBefore.nextSibling);
                  this.log('Inserted before Advanced Search');
                } else {
                  targetPopup.appendChild(menuItem);
                  this.log('Appended to Edit menu');
                }
              }
            }
          } else {
            targetPopup.appendChild(menuItem);
            this.log('Appended to Tools menu');
          }

          state.menuElement = menuItem;
          this.log('Added Search & Replace menu item to ' + popupType + ' menu');
        } else if (!state.menuElement) {
          state.menuElement = menuItem;
          this.log('Found existing menu item');
        }
      } catch (err) {
        this.log('Error adding menu item: ' + err.message);
      }
    };

    var addElements = () => {
      ensureMenuItem();
      state.uiInitialized = true;
      this.windowStates.set(win, state);
    };

    // Add immediately
    addElements();

    // Retry after delays (in case menu isn't loaded yet)
    if (typeof win.setTimeout === 'function') {
      win.setTimeout(addElements, 1000);
      win.setTimeout(addElements, 3000);
      win.setTimeout(addElements, 5000);
    }

    // Retry on DOM ready
    if (doc && doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', addElements);
    } else {
      addElements();
    }
  };

  ZSR.removeUIElements = function(targetWindow) {
    var win = targetWindow;
    if (!win) return;

    var state = this.windowStates.get(win);
    if (!state) return;

    if (state.menuElement) {
      try {
        state.menuElement.removeEventListener('command', state.commandHandler);
        state.menuElement.removeEventListener('click', state.commandHandler);
        if (state.menuElement.parentNode) {
          state.menuElement.parentNode.removeChild(state.menuElement);
        }
      } catch (err) {
        this.log('Error removing menu item: ' + err.message);
      }
      state.menuElement = null;
    }

    state.uiInitialized = false;
    this.windowStates.set(win, state);
  };

  ZSR.teardown = function(targetWindow) {
    var win = targetWindow;
    if (win) {
      this.removeUIElements(win);
      this.windowStates.delete(win);
    }

    if (this.windowStates.size === 0) {
      this.initialized = false;
    }
  };

  ZSR.showDialog = function() {
    try {
      var mainWindow = Zotero.getMainWindow();

      this.log('Opening Search & Replace dialog');

      if (ZSR.searchDialog && typeof ZSR.searchDialog.open === 'function') {
        // Use the class-based dialog
        ZSR.searchDialog.open();
      } else {
        // Fallback to opening via chrome URI
        mainWindow.openDialog(
          'chrome://zotero-search-replace/content/dialog.html',
          'zotero-search-replace-dialog',
          'chrome,centerscreen,resizable=yes,width=900,height=700'
        );
      }

    } catch (error) {
      this.log('Error opening dialog: ' + error.message);
      if (typeof Zotero !== 'undefined' && typeof Zotero.logError === 'function') {
        Zotero.logError(error);
      }
    }
  };

  ZSR.init = function(options) {
    this.log('Extension init called');
    var opts = typeof options === 'string' ? { rootURI: options } : (options || {});
    if (opts.rootURI) {
      this.rootURI = opts.rootURI;
    }

    if (!this.windowStates) {
      this.windowStates = new Map();
    }

    var targetWindow = opts.window || (typeof window !== 'undefined' ? window : null);
    if (targetWindow && !this.windowStates.has(targetWindow)) {
      this.windowStates.set(targetWindow, { uiInitialized: false });
    }

    // Get modules from bundled scope
    var scope = globalThis.__zotero_scope__ || globalThis;
    if (scope.ZoteroSearchReplace) {
      this.searchEngine = scope.ZoteroSearchReplace.SearchEngine;
      this.replaceEngine = scope.ZoteroSearchReplace.ReplaceEngine;
      this.searchDialog = scope.ZoteroSearchReplace.SearchDialog;
    }

    this.initialized = true;
    this.log('Extension initialized');

    if (targetWindow) {
      this.addUIElements(targetWindow);
    }
  };
}
