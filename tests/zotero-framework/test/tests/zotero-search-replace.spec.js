/**
 * Zotero Search & Replace Integration Tests
 *
 * Mocha BDD test suite for Zotero Search & Replace extension
 * This file is bundled by zotero-plugin-scaffold and run in Zotero's test framework
 */

// Helper to get ZoteroSearchReplace from various possible locations
function getZoteroSearchReplace() {
    return Zotero.SearchReplace || ZoteroSearchReplace || window.ZoteroSearchReplace || window.Zotero.SearchReplace;
}

describe('Zotero Search & Replace Extension', function() {
    this.timeout(60000);

    before(async function() {
        await Zotero.initializationPromise;
        Zotero.debug('SearchReplace Test: Zotero initialized, version = ' + Zotero.version);
    });

    describe('Extension Loading', function() {
        it('should have Zotero defined', function() {
            assert.ok(Zotero !== undefined, 'Zotero is defined');
        });

        it('should have ZoteroSearchReplace defined', function() {
            var zsr = getZoteroSearchReplace();
            assert.ok(zsr !== undefined, 'ZoteroSearchReplace is defined');
        });

        it('should have SearchEngine class', function() {
            var zsr = getZoteroSearchReplace();
            assert.ok(zsr && zsr.SearchEngine !== undefined, 'SearchEngine class exists');
        });

        it('should have ReplaceEngine class', function() {
            var zsr = getZoteroSearchReplace();
            assert.ok(zsr && zsr.ReplaceEngine !== undefined, 'ReplaceEngine class exists');
        });

        it('should be initialized', function() {
            var zsr = getZoteroSearchReplace();
            assert.ok(zsr && zsr.initialized, 'Extension is initialized');
        });
    });

    describe('SearchEngine', function() {
        it('should be instantiable', function() {
            var zsr = getZoteroSearchReplace();
            if (!zsr || !zsr.SearchEngine) {
                this.skip();
                return;
            }
            var engine = new zsr.SearchEngine();
            assert.ok(engine !== undefined, 'SearchEngine instance created');
        });
    });

    describe('ReplaceEngine', function() {
        it('should be instantiable', function() {
            var zsr = getZoteroSearchReplace();
            if (!zsr || !zsr.ReplaceEngine) {
                this.skip();
                return;
            }
            var engine = new zsr.ReplaceEngine();
            assert.ok(engine !== undefined, 'ReplaceEngine instance created');
        });
    });

    describe('Preloaded Patterns', function() {
        it('should have all expected patterns loaded', function() {
            var zsr = getZoteroSearchReplace();
            var patterns = zsr && zsr.DATA_QUALITY_PATTERNS;

            if (!patterns) {
                this.skip();
                return;
            }

            assert.ok(patterns.length >= 1, 'Should have patterns');

            var ids = patterns.map(function(p) { return p.id; });
            assert.ok(ids.indexOf('fix-whitespace-colon') !== -1, 'Should have fix-whitespace-colon pattern');
            assert.ok(ids.indexOf('fix-jr-suffix') !== -1, 'Should have fix-jr-suffix pattern');
            assert.ok(ids.indexOf('lowercase-van-de') !== -1, 'Should have lowercase-van-de pattern');
        });
    });

    describe('Menu Integration', function() {
        // The menu integration functions (addUIElements, showDialog, etc.)
        // are defined in content/scripts/zotero-search-replace.js which is loaded
        // by bootstrap.js on each window load. These functions are attached to
        // Zotero.SearchReplace during onMainWindowLoad.

        function debugSearchReplace(testName) {
            var zsr = Zotero.SearchReplace;
            Zotero.debug('=== ' + testName + ' ===');
            Zotero.debug('Zotero.SearchReplace = ' + zsr);
            Zotero.debug('typeof = ' + typeof zsr);
            if (zsr) {
                Zotero.debug('keys = ' + Object.keys(zsr).join(', '));
                Zotero.debug('addUIElements = ' + typeof zsr.addUIElements);
                Zotero.debug('showDialog = ' + typeof zsr.showDialog);
                Zotero.debug('menuItemId = ' + zsr.menuItemId);
                Zotero.debug('init = ' + typeof zsr.init);
                Zotero.debug('hooks = ' + (zsr.hooks ? 'exists' : 'undefined'));
            }
            Zotero.debug('=== END ===');
        }

        it('should have addUIElements function after window load', async function() {
            var mainWindow = Zotero.getMainWindow();
            if (!mainWindow || !mainWindow.document) {
                this.skip();
                return;
            }

            await new Promise(resolve => setTimeout(resolve, 500));

            var zsr = Zotero.SearchReplace;
            // Output debug info as test comment
            if (typeof window !== 'undefined' && window.Test && window.Test.setTestStatus) {
                var keys = zsr ? Object.keys(zsr).join(',') : 'none';
                window.Test.setTestStatus('DEBUG: zsr=' + (zsr ? 'exists' : 'null') + ', keys=' + keys + ', addUIElements=' + typeof zsr?.addUIElements);
            }

            assert.ok(zsr, 'Zotero.SearchReplace should exist, got: ' + typeof zsr);
            assert.strictEqual(typeof zsr.addUIElements, 'function', 'addUIElements should be a function');
        });

        it('should have showDialog function after window load', async function() {
            var mainWindow = Zotero.getMainWindow();
            if (!mainWindow || !mainWindow.document) {
                this.skip();
                return;
            }

            await new Promise(resolve => setTimeout(resolve, 500));

            var zsr = Zotero.SearchReplace;
            debugSearchReplace('SHOW');

            assert.ok(zsr, 'Zotero.SearchReplace should exist');
            assert.strictEqual(typeof zsr.showDialog, 'function', 'showDialog should be a function');
        });

        it('should have menuItemId defined after window load', async function() {
            var mainWindow = Zotero.getMainWindow();
            if (!mainWindow || !mainWindow.document) {
                this.skip();
                return;
            }

            await new Promise(resolve => setTimeout(resolve, 500));

            var zsr = Zotero.SearchReplace;
            debugSearchReplace('MENU');

            assert.ok(zsr, 'Zotero.SearchReplace should exist');
            assert.strictEqual(zsr.menuItemId, 'zotero-search-replace-menu-item', 'menuItemId should be correct');
        });

        it('should have init function', async function() {
            var mainWindow = Zotero.getMainWindow();
            if (!mainWindow || !mainWindow.document) {
                this.skip();
                return;
            }

            await new Promise(resolve => setTimeout(resolve, 500));

            var zsr = Zotero.SearchReplace;
            debugSearchReplace('INIT');

            assert.ok(zsr, 'Zotero.SearchReplace should exist');
            assert.strictEqual(typeof zsr.init, 'function', 'init should be a function');
        });

        it('should have hooks object', async function() {
            var mainWindow = Zotero.getMainWindow();
            if (!mainWindow || !mainWindow.document) {
                this.skip();
                return;
            }

            await new Promise(resolve => setTimeout(resolve, 500));

            var zsr = Zotero.SearchReplace;
            debugSearchReplace('HOOKS');

            assert.ok(zsr, 'Zotero.SearchReplace should exist');
            assert.ok(zsr.hooks, 'hooks should exist');
            assert.strictEqual(typeof zsr.hooks.onMainWindowLoad, 'function', 'hooks.onMainWindowLoad should be a function');
        });

        it('should add menu item to Tools menu', async function() {
            var mainWindow = Zotero.getMainWindow();
            if (!mainWindow || !mainWindow.document) {
                this.skip();
                return;
            }

            var doc = mainWindow.document;

            // Remove any existing menu item first
            var existingItem = doc.getElementById('zotero-search-replace-menu-item');
            if (existingItem && existingItem.parentNode) {
                existingItem.parentNode.removeChild(existingItem);
            }

            var zsr = Zotero.SearchReplace;
            if (!zsr || !zsr.addUIElements) {
                this.skip();
                return;
            }

            // Call addUIElements
            zsr.addUIElements(mainWindow);

            // Wait for async operations (setTimeout retries)
            await new Promise(resolve => setTimeout(resolve, 6000));

            // Check if menu item was added
            var menuItem = doc.getElementById('zotero-search-replace-menu-item');
            assert.ok(menuItem, 'Menu item should be added to the document');
        });
    });
});
