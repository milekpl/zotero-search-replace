/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */

/**
 * Bootstrap file for Zotero Search & Replace Extension
 * Based on Zotero 7/8 hybrid extension approach
 */

// Services is globally available in Zotero 7+, no need to import
// Use the global Services directly

var chromeHandle;
var windowListener;
var zoteroSearchReplaceScope;
var registeredRootURI;

function log(message) {
  if (typeof Zotero !== 'undefined' && Zotero.debug) {
    Zotero.debug('SearchReplace: ' + message);
  }
}

function install(_data, _reason) {}

async function startup({ resourceURI, rootURI }, reason) {
  log('startup called');
  await Zotero.initializationPromise;
  log('Zotero initializationPromise resolved.');

  if (!rootURI) {
    rootURI = resourceURI.spec;
  }

  if (!rootURI.endsWith('/')) {
    rootURI += '/';
  }

  registeredRootURI = rootURI;
  globalThis.registeredRootURI = registeredRootURI;

  var aomStartup = Components.classes[
    '@mozilla.org/addons/addon-manager-startup;1'
  ].getService(Components.interfaces.amIAddonManagerStartup);
  var manifestURI = Services.io.newURI(rootURI + 'manifest.json');
  chromeHandle = aomStartup.registerChrome(manifestURI, [
    ['content', 'zotero-search-replace', rootURI + 'content/'],
  ]);
  log('chromeHandle registered.');

  zoteroSearchReplaceScope = {
    Zotero,
    Components,
    Services,
    ChromeUtils,
  };

  if (typeof Cu !== 'undefined') zoteroSearchReplaceScope.Cu = Cu;
  if (typeof Ci !== 'undefined') zoteroSearchReplaceScope.Ci = Ci;
  if (typeof Cr !== 'undefined') zoteroSearchReplaceScope.Cr = Cr;
  if (typeof Cc !== 'undefined') zoteroSearchReplaceScope.Cc = Cc;

  globalThis.__zotero_scope__ = zoteroSearchReplaceScope;

  Services.scriptloader.loadSubScript(
    rootURI + 'content/scripts/zotero-search-replace-bundled.js',
    zoteroSearchReplaceScope,
    'UTF-8',
  );
  log('bundled.js loaded.');

  if (zoteroSearchReplaceScope.ZoteroSearchReplace) {
    // Expose to both globalThis and Zotero namespace for test framework compatibility
    globalThis.ZoteroSearchReplace = zoteroSearchReplaceScope.ZoteroSearchReplace;
    if (typeof Zotero !== 'undefined') {
      Zotero.SearchReplace = zoteroSearchReplaceScope.ZoteroSearchReplace;
    }
    log('ZoteroSearchReplace exposed globally and to Zotero.SearchReplace.');
    if (globalThis.ZoteroSearchReplace.hooks && globalThis.ZoteroSearchReplace.hooks.onStartup) {
      globalThis.ZoteroSearchReplace.hooks.onStartup();
    }
  } else {
    log('ERROR: ZoteroSearchReplace NOT found in scope!');
  }

  // Register window listeners for menu injection
  registerWindowListeners(reason);

  // Load tests if in test mode
  if (Zotero.Prefs.get('extensions.zotero-search-replace.testMode')) {
    try {
      Services.scriptloader.loadSubScript(
        rootURI + 'tests/zotero-framework/test/tests/zotero-search-replace.spec.js',
        globalThis,
        'UTF-8'
      );
      log('Test: Loaded Mocha test file');
    } catch (e) {
      log('Test: Could not load test file: ' + e.message);
    }
  }
}

async function onMainWindowLoad({ window }, _reason) {
  log('onMainWindowLoad called for window: ' + (window ? window.location.href : 'unknown'));

  try {
    // Load zotero-search-replace.js into the window's scope
    Services.scriptloader.loadSubScript(
      registeredRootURI + 'content/scripts/zotero-search-replace.js',
      window,
      'UTF-8',
    );
    log('Loaded zotero-search-replace.js into window');

    // Update Zotero.SearchReplace to point to the window-level object
    // which has addUIElements, showDialog, etc.
    if (window.Zotero && window.Zotero.SearchReplace) {
      Zotero.SearchReplace = window.Zotero.SearchReplace;
      log('Updated Zotero.SearchReplace to window-level object');
    } else {
      log('window.Zotero.SearchReplace not found, checking window.Zotero: ' + !!(window.Zotero));
      log('window.Zotero.SearchReplace: ' + window.Zotero?.SearchReplace);
      // Try to get from global
      if (Zotero.SearchReplace) {
        log('Zotero.SearchReplace exists globally, keys: ' + Object.keys(Zotero.SearchReplace).join(', '));
      }
    }

    // Call onMainWindowLoad hook if available
    if (window.Zotero && window.Zotero.SearchReplace && window.Zotero.SearchReplace.hooks && window.Zotero.SearchReplace.hooks.onMainWindowLoad) {
      window.Zotero.SearchReplace.hooks.onMainWindowLoad(window);
    }
  } catch (e) {
    log('Error in onMainWindowLoad: ' + e.message);
  }
}

async function onMainWindowUnload({ window }, _reason) {
  log('onMainWindowUnload called for window: ' + (window ? window.location.href : 'unknown'));

  if (window.Zotero && window.Zotero.SearchReplace && window.Zotero.SearchReplace.hooks && window.Zotero.SearchReplace.hooks.onMainWindowUnload) {
    window.Zotero.SearchReplace.hooks.onMainWindowUnload(window);
  }

  // Clean up injected properties
  delete window.ZoteroSearchReplace;
  delete window.Zotero.__zoteroSearchReplaceInjected;
}

function shutdown(data, reason) {
  if (reason === APP_SHUTDOWN) {
    return;
  }

  // Remove window listener
  if (windowListener) {
    Services.wm.removeListener(windowListener);
    windowListener = null;
  }

  // Clean up chrome registration
  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }

  // Clean up main window menu items
  const enumerator = Services.wm.getEnumerator('navigator:browser');
  while (enumerator.hasMoreElements()) {
    const win = enumerator.getNext();
    if (isZoteroMainWindow(win)) {
      onMainWindowUnload({ window: win }, reason);
    }
  }

  // Clean up global scope
  if (globalThis.ZoteroSearchReplace) globalThis.ZoteroSearchReplace = null;
  if (globalThis.__zotero_scope__) globalThis.__zotero_scope__ = null;
  if (typeof Zotero !== 'undefined' && Zotero.SearchReplace) Zotero.SearchReplace = null;

  zoteroSearchReplaceScope = null;
  registeredRootURI = null;

  log('shutdown complete');
}

function uninstall(_data, _reason) {}

function registerWindowListeners(reason) {
  if (!windowListener) {
    windowListener = {
      onOpenWindow(xulWindow) {
        const domWindow = getDOMWindowFromXUL(xulWindow);
        if (!domWindow) {
          return;
        }

        const onLoad = () => {
          domWindow.removeEventListener('load', onLoad);
          if (isZoteroMainWindow(domWindow)) {
            onMainWindowLoad({ window: domWindow }, reason);
          }
        };

        if (domWindow.document?.readyState === 'complete') {
          onLoad();
        } else {
          domWindow.addEventListener('load', onLoad, { once: true });
        }
      },
      onCloseWindow(xulWindow) {
        const domWindow = getDOMWindowFromXUL(xulWindow);
        if (domWindow && isZoteroMainWindow(domWindow)) {
          onMainWindowUnload({ window: domWindow }, reason);
        }
      },
      onWindowTitleChange() {},
    };
  }

  Services.wm.addListener(windowListener);

  // Handle already open Zotero windows
  const enumerator = Services.wm.getEnumerator('navigator:browser');
  while (enumerator.hasMoreElements()) {
    const win = enumerator.getNext();
    if (!isZoteroMainWindow(win)) {
      continue;
    }

    if (win.document?.readyState === 'complete') {
      onMainWindowLoad({ window: win }, reason);
    } else {
      win.addEventListener(
        'load',
        function onLoad() {
          win.removeEventListener('load', onLoad);
          onMainWindowLoad({ window: win }, reason);
        },
        { once: true },
      );
    }
  }
}

function getDOMWindowFromXUL(xulWindow) {
  try {
    return xulWindow
      .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
      .getInterface(Components.interfaces.nsIDOMWindow);
  } catch (err) {
    log('Failed to resolve DOM window - ' + err);
    return null;
  }
}

function isZoteroMainWindow(win) {
  if (!win || !win.document) {
    return false;
  }

  const windowType = win.document.documentElement.getAttribute('windowtype');
  return windowType === 'navigator:browser' || windowType === 'zotero:browser';
}
