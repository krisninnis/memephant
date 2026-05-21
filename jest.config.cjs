const path = require('path');

module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/tests/setupTests.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      path.resolve(__dirname, 'node_modules/ts-jest'),
      {
        tsconfig: {
          module: 'commonjs',
          esModuleInterop: true,
          jsx: 'react-jsx',
        },
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@tauri-apps/(.*)$': '<rootDir>/src/tests/__mocks__/tauri.ts',
    '\\.(css|less|scss|sass)$': '<rootDir>/src/tests/__mocks__/styles.ts',
    '\\.(png|jpg|jpeg|gif|svg|webp|avif)$': '<rootDir>/src/tests/__mocks__/file.ts',
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    'src/tests/e2e/auth-logout-mobile.test.ts',
  ],
  clearMocks: true,
};
