module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js', '**/?(*.)+(spec|test).js'],
  collectCoverageFrom: [
    'main/**/*.js',
    '!main/**/*.test.js',
    '!main/**/*.spec.js',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
};
