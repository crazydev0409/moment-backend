module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/'
  ],
  testPathIgnorePatterns: ['/node_modules/'],
  verbose: true,
  transformIgnorePatterns: [
    '/node_modules/'
  ],
  globals: {
    'ts-jest': {
      isolatedModules: true
    }
  },
  // Force Jest to exit after tests complete
  forceExit: true,
  // Set a timeout to prevent hanging
  testTimeout: 10000
}; 