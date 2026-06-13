/** Engine-only tests: pure TS, node env, isolated from RN/babel. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/soil'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      isolatedModules: true,
      tsconfig: {
        strict: true,
        rootDir: './src/soil',
        ignoreDeprecations: '5.0',
      },
    }],
  },
};
