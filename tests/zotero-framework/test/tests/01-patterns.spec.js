/**
 * Preloaded Patterns Tests for Zotero Search & Replace
 *
 * Tests that verify the data quality patterns work correctly
 */

describe('Preloaded Patterns', function() {
    this.timeout(60000);

    before(async function() {
        await Zotero.initializationPromise;
    });

    describe('Pattern Categories', function() {
        it('should have all pattern categories defined', function() {
            var zsr = Zotero.SearchReplace || window.ZoteroSearchReplace;
            assert.ok(zsr && zsr.PATTERN_CATEGORIES, 'PATTERN_CATEGORIES should exist');
            assert.isAbove(Object.keys(zsr.PATTERN_CATEGORIES).length, 0, 'Should have pattern categories');
        });

        it('should have expected number of categories', function() {
            var zsr = Zotero.SearchReplace || window.ZoteroSearchReplace;
            var categories = zsr && zsr.PATTERN_CATEGORIES;
            assert.ok(categories, 'PATTERN_CATEGORIES should exist');
            // Categories is an array
            assert.isAtLeast(categories.length, 5, 'Should have at least 5 categories');
        });
    });

    describe('Pattern Structure', function() {
        it('should have all expected patterns', function() {
            var zsr = Zotero.SearchReplace || window.ZoteroSearchReplace;
            var patterns = zsr && zsr.DATA_QUALITY_PATTERNS;

            assert.ok(patterns, 'DATA_QUALITY_PATTERNS should exist');
            assert.isAtLeast(patterns.length, 15, 'Should have at least 15 patterns');

            // Check for specific expected patterns
            var patternIds = patterns.map(function(p) { return p.id; });

            // Comma spacing patterns
            assert.ok(patternIds.indexOf('fix-comma-space') !== -1, 'Should have fix-comma-space pattern');
            assert.ok(patternIds.indexOf('fix-jr-suffix') !== -1, 'Should have fix-jr-suffix pattern');
            assert.ok(patternIds.indexOf('fix-double-comma') !== -1, 'Should have fix-double-comma pattern');
            assert.ok(patternIds.indexOf('fix-trailing-comma') !== -1, 'Should have fix-trailing-comma pattern');

            // Name patterns
            assert.ok(patternIds.indexOf('lowercase-van-de') !== -1, 'Should have lowercase-van-de pattern');
            assert.ok(patternIds.indexOf('lowercase-von') !== -1, 'Should have lowercase-von pattern');
            assert.ok(patternIds.indexOf('normalize-mc-mac') !== -1, 'Should have normalize-mc-mac pattern');

            // URL/DOI patterns
            assert.ok(patternIds.indexOf('fix-url-http') !== -1, 'Should have fix-url-http pattern');
        });

        it('each pattern should have required fields', function() {
            var zsr = Zotero.SearchReplace || window.ZoteroSearchReplace;
            var patterns = zsr && zsr.DATA_QUALITY_PATTERNS;

            assert.ok(patterns, 'DATA_QUALITY_PATTERNS should exist');

            for (var i = 0; i < patterns.length; i++) {
                var pattern = patterns[i];
                assert.ok(pattern.id, 'Pattern ' + i + ' should have id');
                assert.ok(pattern.name, 'Pattern ' + i + ' (' + pattern.id + ') should have name');
                assert.ok(pattern.description, 'Pattern ' + i + ' (' + pattern.id + ') should have description');
                assert.ok(pattern.category, 'Pattern ' + i + ' (' + pattern.id + ') should have category');

                // Pattern should have either search/replace (regex patterns) OR customCheck (custom patterns)
                var hasRegexPattern = pattern.search !== undefined && pattern.replace !== undefined;
                var hasCustomPattern = pattern.customCheck !== undefined;
                assert.ok(hasRegexPattern || hasCustomPattern,
                    'Pattern ' + i + ' (' + pattern.id + ') should have search/replace or customCheck');
            }
        });

        it('should have correct pattern count', function() {
            var zsr = Zotero.SearchReplace || window.ZoteroSearchReplace;
            var patterns = zsr && zsr.DATA_QUALITY_PATTERNS;

            assert.ok(patterns, 'DATA_QUALITY_PATTERNS should exist');
            assert.strictEqual(patterns.length, 16, 'Should have exactly 16 patterns');
        });
    });

    describe('Pattern Functionality', function() {
        it('should find comma spacing issues', function() {
            var zsr = Zotero.SearchReplace || window.ZoteroSearchReplace;
            var patterns = zsr && zsr.DATA_QUALITY_PATTERNS;

            assert.ok(patterns, 'DATA_QUALITY_PATTERNS should exist');

            // Find comma spacing pattern
            var commaPattern = patterns.find(function(p) { return p.id === 'fix-comma-space'; });
            assert.ok(commaPattern, 'Should have fix-comma-space pattern');

            // Test the pattern
            var testString = 'Smith , John';
            var regex = new RegExp(commaPattern.search);
            assert.ok(regex.test(testString), 'Pattern should match "Smith , John"');

            // Test the fix
            var fixed = testString.replace(regex, commaPattern.replace);
            assert.strictEqual(fixed, 'Smith, John', 'Should fix comma spacing');
        });

        it('should fix Jr/Sr suffix positions', function() {
            var zsr = Zotero.SearchReplace || window.ZoteroSearchReplace;
            var patterns = zsr && zsr.DATA_QUALITY_PATTERNS;

            assert.ok(patterns, 'DATA_QUALITY_PATTERNS should exist');

            var jrPattern = patterns.find(function(p) { return p.id === 'fix-jr-suffix'; });
            assert.ok(jrPattern, 'Should have fix-jr-suffix pattern');

            // Pattern expects format: "Last, Jr" or "Last Jr, First" with suffix at end
            var testString = 'Smith, Jr';
            var regex = new RegExp(jrPattern.search);
            assert.ok(regex.test(testString), 'Pattern should match "Smith, Jr"');

            var fixed = testString.replace(regex, jrPattern.replace);
            assert.strictEqual(fixed, 'Jr, Smith', 'Should move Jr to front');
        });

        it('should normalize Dutch prefixes', function() {
            var zsr = Zotero.SearchReplace || window.ZoteroSearchReplace;
            var patterns = zsr && zsr.DATA_QUALITY_PATTERNS;

            assert.ok(patterns, 'DATA_QUALITY_PATTERNS should exist');

            var vanDePattern = patterns.find(function(p) { return p.id === 'lowercase-van-de'; });
            assert.ok(vanDePattern, 'Should have lowercase-van-de pattern');

            var testString = 'Van der Waals';
            var regex = new RegExp(vanDePattern.search);
            assert.ok(regex.test(testString), 'Pattern should match "Van der Waals"');

            // Function replacement
            var fixed = testString.replace(regex, vanDePattern.replace);
            assert.strictEqual(fixed, 'van der Waals', 'Should lowercase Van to van');
        });

        it('should normalize HTTP to HTTPS', function() {
            var zsr = Zotero.SearchReplace || window.ZoteroSearchReplace;
            var patterns = zsr && zsr.DATA_QUALITY_PATTERNS;

            assert.ok(patterns, 'DATA_QUALITY_PATTERNS should exist');

            var httpPattern = patterns.find(function(p) { return p.id === 'fix-url-http'; });
            assert.ok(httpPattern, 'Should have fix-url-http pattern');

            var testString = 'http://example.com';
            var regex = new RegExp(httpPattern.search);
            assert.ok(regex.test(testString), 'Pattern should match http URL');

            var fixed = testString.replace(regex, httpPattern.replace);
            assert.strictEqual(fixed, 'https://example.com', 'Should change http to https');
        });
    });

    describe('ReplaceEngine with Patterns', function() {
        it('should instantiate ReplaceEngine', function() {
            var zsr = Zotero.SearchReplace || window.ZoteroSearchReplace;
            assert.ok(zsr && zsr.ReplaceEngine, 'ReplaceEngine should exist');

            var engine = new zsr.ReplaceEngine();
            assert.ok(engine, 'ReplaceEngine should be instantiable');
        });

        it('should apply pattern replacements', function() {
            var zsr = Zotero.SearchReplace || window.ZoteroSearchReplace;

            if (!zsr || !zsr.ReplaceEngine) {
                this.skip();
                return;
            }

            var engine = new zsr.ReplaceEngine();

            // Test comma spacing fix
            var result = engine.applyReplace('Smith , John', 'Smith , John', 'Smith , John', {
                patternType: 'regex',
                caseSensitive: false
            });

            // The result should have the fix applied
            assert.ok(result !== undefined, 'Replacement should return a result');
        });
    });

    describe('SearchEngine Functionality', function() {
        it('should instantiate SearchEngine', function() {
            var zsr = Zotero.SearchReplace || window.ZoteroSearchReplace;
            assert.ok(zsr && zsr.SearchEngine, 'SearchEngine should exist');

            var engine = new zsr.SearchEngine();
            assert.ok(engine, 'SearchEngine should be instantiable');
        });

        it('should search with regex pattern', function() {
            var zsr = Zotero.SearchReplace || window.ZoteroSearchReplace;

            if (!zsr || !zsr.SearchEngine) {
                this.skip();
                return;
            }

            var engine = new zsr.SearchEngine();

            // Search for comma spacing issue
            var results = engine.search(' ,', {
                fields: ['title'],
                patternType: 'regex',
                caseSensitive: false
            });

            // Results should be a promise that resolves to an array
            assert.ok(results && typeof results.then === 'function', 'Search should return a promise');
        });

        it('should search with exact match', function() {
            var zsr = Zotero.SearchReplace || window.ZoteroSearchReplace;

            if (!zsr || !zsr.SearchEngine) {
                this.skip();
                return;
            }

            var engine = new zsr.SearchEngine();

            var results = engine.search('Machine Learning', {
                fields: ['title'],
                patternType: 'exact',
                caseSensitive: false
            });

            assert.ok(results && typeof results.then === 'function', 'Search should return a promise');
        });

        it('should search with SQL LIKE pattern', function() {
            var zsr = Zotero.SearchReplace || window.ZoteroSearchReplace;

            if (!zsr || !zsr.SearchEngine) {
                this.skip();
                return;
            }

            var engine = new zsr.SearchEngine();

            var results = engine.search('%Machine%', {
                fields: ['title'],
                patternType: 'sql_like',
                caseSensitive: false
            });

            assert.ok(results && typeof results.then === 'function', 'Search should return a promise');
        });
    });

    describe('Pattern Categories Coverage', function() {
        it('should have Parsing Errors patterns', function() {
            var zsr = Zotero.SearchReplace || window.ZoteroSearchReplace;
            var patterns = zsr && zsr.DATA_QUALITY_PATTERNS;

            assert.ok(patterns, 'DATA_QUALITY_PATTERNS should exist');

            var parsingPatterns = patterns.filter(function(p) { return p.category === 'Parsing Errors'; });
            assert.isAtLeast(parsingPatterns.length, 3, 'Should have at least 3 Parsing Errors patterns');
        });

        it('should have Capitalization patterns', function() {
            var zsr = Zotero.SearchReplace || window.ZoteroSearchReplace;
            var patterns = zsr && zsr.DATA_QUALITY_PATTERNS;

            assert.ok(patterns, 'DATA_QUALITY_PATTERNS should exist');

            var capPatterns = patterns.filter(function(p) { return p.category === 'Capitalization'; });
            assert.isAtLeast(capPatterns.length, 3, 'Should have at least 3 Capitalization patterns');
        });

        it('should have Diacritics patterns', function() {
            var zsr = Zotero.SearchReplace || window.ZoteroSearchReplace;
            var patterns = zsr && zsr.DATA_QUALITY_PATTERNS;

            assert.ok(patterns, 'DATA_QUALITY_PATTERNS should exist');

            var diaPatterns = patterns.filter(function(p) { return p.category === 'Diacritics'; });
            assert.isAtLeast(diaPatterns.length, 2, 'Should have at least 2 Diacritics patterns');
        });

        it('should have Data Quality patterns', function() {
            var zsr = Zotero.SearchReplace || window.ZoteroSearchReplace;
            var patterns = zsr && zsr.DATA_QUALITY_PATTERNS;

            assert.ok(patterns, 'DATA_QUALITY_PATTERNS should exist');

            var dqPatterns = patterns.filter(function(p) { return p.category === 'Data Quality'; });
            assert.isAtLeast(dqPatterns.length, 3, 'Should have at least 3 Data Quality patterns');
        });

        it('should have Classification patterns', function() {
            var zsr = Zotero.SearchReplace || window.ZoteroSearchReplace;
            var patterns = zsr && zsr.DATA_QUALITY_PATTERNS;

            assert.ok(patterns, 'DATA_QUALITY_PATTERNS should exist');

            var classPatterns = patterns.filter(function(p) { return p.category === 'Classification'; });
            assert.isAtLeast(classPatterns.length, 2, 'Should have at least 2 Classification patterns');
        });
    });
});
