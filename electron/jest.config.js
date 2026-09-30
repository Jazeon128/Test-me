module.exports = {
  testEnvironment: 'node',
  // Keep filesystem-heavy suites from distorting the performance assertions.
  maxWorkers: 2,
  testMatch: ['**/__tests__/**/*.test.js', '**/?(*.)+(spec|test).js'],
  collectCoverageFrom: [
    'main/**/*.js',
    '!main/**/*.test.js',
    '!main/**/*.spec.js',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
};
