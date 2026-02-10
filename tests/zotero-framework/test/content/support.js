/**
 * Test Support Utilities for Zotero Search & Replace
 * Provides additional assert helpers that chai doesn't have
 */

// Extend window.assert with additional helpers
if (typeof window !== 'undefined' && window.assert) {
    // Add missing chai-like assertions
    window.assert.isDefined = function(val, msg) {
        window.assert.ok(val !== undefined, msg || 'Expected defined value');
    };

    window.assert.isNotDefined = function(val, msg) {
        window.assert.ok(val === undefined, msg || 'Expected undefined value');
    };

    window.assert.isTrue = function(val, msg) {
        window.assert.strictEqual(val, true, msg);
    };

    window.assert.isFalse = function(val, msg) {
        window.assert.strictEqual(val, false, msg);
    };

    window.assert.isAtLeast = function(val, min, msg) {
        window.assert.ok(val >= min, msg || 'Expected ' + val + ' >= ' + min);
    };

    window.assert.isAtMost = function(val, max, msg) {
        window.assert.ok(val <= max, msg || 'Expected ' + val + ' <= ' + max);
    };

    window.assert.include = function(arr, val, msg) {
        window.assert.ok(arr.indexOf(val) !== -1, msg || 'Expected array to include ' + val);
    };

    window.assert.lengthOf = function(arr, len, msg) {
        window.assert.strictEqual(arr.length, len, msg);
    };
}
