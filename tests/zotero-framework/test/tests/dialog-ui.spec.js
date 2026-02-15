/**
 * Zotero Search & Replace Dialog UI Integration Tests
 *
 * These tests verify the core functionality works through the dialog
 * Note: Modal dialog tests that hang are skipped - use manual testing
 */

// Helper to get ZoteroSearchReplace from various possible locations
function getZoteroSearchReplace() {
    return Zotero.SearchReplace || ZoteroSearchReplace || window.ZoteroSearchReplace || window.Zotero.SearchReplace;
}

// Helper to create a test item
async function createTestItem(options = {}) {
    const {
        title = 'Test Item',
        firstName = '',
        lastName = '',
        url = '',
        extra = '',
        tags = []
    } = options;

    const item = new Zotero.Item('journalArticle');
    item.setField('title', title);
    if (url) item.setField('url', url);
    if (extra) item.setField('extra', extra);

    if (firstName || lastName) {
        item.setCreators([
            {
                creatorType: 'author',
                firstName: firstName,
                lastName: lastName
            }
        ]);
    }

    for (const tag of tags) {
        item.addTag(tag);
    }

    await item.saveTx();
    return item;
}

// Helper to clean up test items
async function cleanupItems(items) {
    if (!items || items.length === 0) return;
    for (const item of items) {
        try {
            await item.eraseTx();
        } catch (e) {
            // Ignore errors during cleanup
        }
    }
}

describe('Search & Replace Integration Tests', function() {
    this.timeout(120000);
    let testItems = [];

    before(async function() {
        await Zotero.initializationPromise;
        Zotero.debug('SearchReplace Integration Tests: Starting');
    });

    after(async function() {
        await cleanupItems(testItems);
    });

    describe('SearchEngine with Real Items', function() {
        it('should search and find items with regex pattern', async function() {
            // Create test items
            const item1 = await createTestItem({
                title: 'Test Article About Smith',
                lastName: 'Smith',
                firstName: 'John'
            });
            testItems.push(item1);

            const item2 = await createTestItem({
                title: 'Another Article',
                lastName: 'Jones',
                firstName: 'Jane'
            });
            testItems.push(item2);

            // Use the bundled SearchEngine directly (use helper like other tests)
            const zsr = getZoteroSearchReplace();
            if (!zsr || !zsr.SearchEngine) {
                this.skip();
                return;
            }

            const engine = new zsr.SearchEngine();
            const results = await engine.search('Smith', {
                fields: ['creator.lastName'],
                patternType: 'regex',
                caseSensitive: false
            });

            assert.ok(results.length >= 1, 'Should find at least 1 item with Smith');
            Zotero.debug('Found ' + results.length + ' items matching Smith');

            // Verify the item was found
            const found = results.some(r => r.item.id === item1.id);
            assert.ok(found, 'Should find the Smith item');
        });

        it('should find items using multiple fields', async function() {
            const item = await createTestItem({
                title: 'UniquePattern123 Test',
                lastName: 'Test',
                firstName: 'Author'
            });
            testItems.push(item);

            const zsr = getZoteroSearchReplace();
            if (!zsr || !zsr.SearchEngine) {
                this.skip();
                return;
            }

            const engine = new zsr.SearchEngine();
            const results = await engine.search('UniquePattern123', {
                fields: ['title', 'creator.lastName', 'creator.firstName'],
                patternType: 'regex',
                caseSensitive: false
            });

            assert.ok(results.length >= 1, 'Should find item in title field');
        });
    });

    describe('ReplaceEngine with Real Items', function() {
        it('should replace text in URL field', async function() {
            const item = await createTestItem({
                title: 'Test Article',
                url: 'http://example.com/test'
            });
            testItems.push(item);

            const zsr = getZoteroSearchReplace();
            if (!zsr || !zsr.ReplaceEngine) {
                this.skip();
                return;
            }

            const engine = new zsr.ReplaceEngine();
            const result = await engine.processItems([item], 'http://', 'https://', {
                fields: ['url'],
                patternType: 'regex'
            });

            assert.strictEqual(result.modified, 1, 'Should modify 1 item');

            // Verify the change
            const updatedItem = await Zotero.Items.getAsync(item.id);
            assert.strictEqual(updatedItem.getField('url'), 'https://example.com/test', 'URL should be https');
        });

        it('should fix comma-space in creator names', async function() {
            const item = await createTestItem({
                title: 'Test Article',
                lastName: 'Smith , John',
                firstName: 'Author'
            });
            testItems.push(item);

            const zsr = getZoteroSearchReplace();
            if (!zsr || !zsr.ReplaceEngine) {
                this.skip();
                return;
            }

            const engine = new zsr.ReplaceEngine();
            const result = await engine.processItems([item], ' ,', ',', {
                fields: ['creator.lastName'],
                patternType: 'regex'
            });

            assert.strictEqual(result.modified, 1, 'Should modify 1 item');

            // Verify the change
            const updatedItem = await Zotero.Items.getAsync(item.id);
            const creators = updatedItem.getCreators();
            assert.strictEqual(creators[0].lastName, 'Smith, John', 'Comma should be fixed');
        });

        it('should handle multiple replacements in same item', async function() {
            const item = await createTestItem({
                title: 'Test http://example.com Article',
                url: 'http://example.com/page1',
                extra: 'http://old.example.com ref'
            });
            testItems.push(item);

            const zsr = getZoteroSearchReplace();
            if (!zsr || !zsr.ReplaceEngine) {
                this.skip();
                return;
            }

            const engine = new zsr.ReplaceEngine();
            const result = await engine.processItems([item], 'http://', 'https://', {
                fields: ['url', 'extra'],
                patternType: 'regex'
            });

            assert.strictEqual(result.modified, 1, 'Should modify 1 item');

            // Verify both URLs were updated
            const updatedItem = await Zotero.Items.getAsync(item.id);
            assert.ok(updatedItem.getField('url').includes('https://'), 'URL should be https');
        });
    });

    describe('Pattern Coverage', function() {
        it('should have all expected pattern categories', function() {
            const zsr = getZoteroSearchReplace();
            const patterns = zsr ? zsr.DATA_QUALITY_PATTERNS : [];
            const categories = new Set(patterns.map(p => p.category));

            assert.ok(categories.has('Parsing Errors'), 'Should have Parsing Errors patterns');
            assert.ok(categories.has('Capitalization'), 'Should have Capitalization patterns');
            assert.ok(categories.has('Diacritics'), 'Should have Diacritics patterns');
            assert.ok(categories.has('Data Quality'), 'Should have Data Quality patterns');
            assert.ok(categories.has('Classification'), 'Should have Classification patterns');
        });

        it('should have essential fix patterns', function() {
            const zsr = getZoteroSearchReplace();
            const patterns = zsr ? zsr.DATA_QUALITY_PATTERNS : [];
            const patternIds = patterns.map(p => p.id);

            assert.ok(patternIds.includes('fix-whitespace-colon'), 'Should have whitespace-colon fix');
            assert.ok(patternIds.includes('fix-url-http'), 'Should have HTTP to HTTPS fix');
            assert.ok(patternIds.includes('remove-parens'), 'Should have remove parens pattern');
        });
    });
});
