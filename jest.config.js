/**
 * Jest configuration for Zotero Search & Replace Plugin
 */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  moduleFileExtensions: ['js', 'json'],
  testMatch: ['**/tests/unit/**/*.spec.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.spec.js'
  ],
  coverageDirectory: 'coverage',
  verbose: true
};
