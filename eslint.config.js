// @ts-check

/**
 * @type {import('eslint').Linter.Config}
 */
export default [
  {
    ignores: [
      'build/**',
      'node_modules/**',
      '.history/**',
      '.scaffold/**',
      '.qodo/**',
      '.zencoder/**',
      '.zenflow/**',
      'coverage/**',
      '**/*.json',
      'content/scripts/zotero-search-replace-bundled.js',
      'tests/zotero-framework/**',
    ],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        alert: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        localStorage: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        // Node.js globals
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        TextEncoder: 'readonly',
        // Zotero globals
        Zotero: 'readonly',
        ZoteroSearchReplace: 'readonly',
        ZoteroPane: 'readonly',
        Services: 'readonly',
        Components: 'readonly',
        // Test globals
        jest: 'readonly',
        describe: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        global: 'readonly',
        it: 'readonly',
        before: 'readonly',
        after: 'readonly',
        assert: 'readonly',
      },
    },
    rules: {
      'indent': 'off',
      'linebreak-style': 'off',
      'quotes': 'off',
      'semi': 'off',
      'no-unused-vars': 'warn',
      'no-undef': 'error',
      'no-console': 'off',
      'no-empty': 'warn',
    },
  },
];
