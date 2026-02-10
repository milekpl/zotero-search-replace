import { defineConfig } from "zotero-plugin-scaffold";
import path from "path";
import pkg from "./package.json";
import fs from "fs";

const projectRoot = path.resolve(__dirname);

// Custom post-build hook to copy bundled script to source directory for development
function setupDevEnvironment() {
  const sourceBundledPath = path.join(projectRoot, 'content', 'scripts', 'zotero-search-replace-bundled.js');
  const buildBundledPath = path.join(projectRoot, 'build', 'addon', 'content', 'scripts', 'zotero-search-replace-bundled.js');

  if (fs.existsSync(buildBundledPath)) {
    fs.copyFileSync(buildBundledPath, sourceBundledPath);
    console.log('Copied bundled script to content/scripts for development');
  }
}

export default defineConfig({
  source: ["src"],
  dist: "build",
  name: pkg.description,
  id: "zotero-search-replace@marcinmilkowski.pl",
  namespace: "ZoteroSearchReplace",
  binary: "/opt/zotero/zotero",

  build: {
    assets: [
      "bootstrap.js",
      "manifest.json",
      "content/**/*",
      "_locales/**/*"
    ],
    define: {
      author: pkg.author,
      description: pkg.description,
      homepage: "https://github.com/milekpl/zotero-search-replace",
      buildVersion: pkg.version,
      buildTime: "{{buildTime}}",
    },
    prefs: {
      prefix: "extensions.zotero-search-replace",
    },
    esbuildOptions: [
      {
        entryPoints: ["src/index.js"],
        define: {
          __env__: `"${process.env.NODE_ENV || 'development'}"`,
        },
        bundle: true,
        target: "firefox115",
        outfile: "addon/content/scripts/zotero-search-replace-bundled.js",
        banner: {
          js: `// Console polyfill for Zotero 8
if (typeof console === 'undefined') {
  globalThis.console = {
    log: function() { if (typeof Zotero !== 'undefined' && Zotero.debug) Zotero.debug('SearchReplace: ' + Array.prototype.join.call(arguments, ' ')); },
    warn: function() { if (typeof Zotero !== 'undefined' && Zotero.debug) Zotero.debug('SearchReplace WARN: ' + Array.prototype.join.call(arguments, ' ')); },
    error: function() { if (typeof Zotero !== 'undefined' && Zotero.debug) Zotero.debug('SearchReplace ERROR: ' + Array.prototype.join.call(arguments, ' ')); },
    info: function() { if (typeof Zotero !== 'undefined' && Zotero.debug) Zotero.debug('SearchReplace INFO: ' + Array.prototype.join.call(arguments, ' ')); },
    debug: function() { if (typeof Zotero !== 'undefined' && Zotero.debug) Zotero.debug('SearchReplace DEBUG: ' + Array.prototype.join.call(arguments, ' ')); }
  };
}
`,
        },
        footer: {
          js: `
// Export ZoteroSearchReplace to scope for loadSubScript
var ZoteroSearchReplaceRef = typeof ZoteroSearchReplace !== 'undefined'
  ? ZoteroSearchReplace
  : (typeof window !== 'undefined' ? window.ZoteroSearchReplace : null) ||
    (typeof globalThis !== 'undefined' ? globalThis.ZoteroSearchReplace : null);

if (ZoteroSearchReplaceRef) {
  var targetScope = (typeof __zotero_scope__ !== 'undefined' && __zotero_scope__)
    ? __zotero_scope__
    : (typeof globalThis !== 'undefined' ? globalThis.__zotero_scope__ : null);
  if (targetScope) {
    targetScope.ZoteroSearchReplace = ZoteroSearchReplaceRef;
    // Also set Zotero.SearchReplace if Zotero exists in scope
    if (targetScope.Zotero) {
      targetScope.Zotero.SearchReplace = ZoteroSearchReplaceRef;
    }
  }
  if (typeof window !== 'undefined') window.ZoteroSearchReplace = ZoteroSearchReplaceRef;
  if (typeof globalThis !== 'undefined') globalThis.ZoteroSearchReplace = ZoteroSearchReplaceRef;
  // Also set Zotero.SearchReplace globally if Zotero exists
  if (typeof Zotero !== 'undefined' && Zotero) {
    Zotero.SearchReplace = ZoteroSearchReplaceRef;
  }
}
`,
        },
      },
    ],
    async onAfterBuild() {
      setupDevEnvironment();
    },
  },

  server: {
    asProxy: true,
  },

  test: {
    entries: ["tests/zotero-framework/test/tests"],
    waitForPlugin: "() => typeof Zotero !== 'undefined' && typeof Zotero.SearchReplace !== 'undefined' && Zotero.SearchReplace.initialized",
    mocha: {
      timeout: 60000,
    },
    watch: false,
  },
});
