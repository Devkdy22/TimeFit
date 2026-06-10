import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/hooks/__tests__', '<rootDir>/src/features/moving/hooks/__tests__'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  clearMocks: true,
  restoreMocks: true,
  setupFilesAfterEnv: ['<rootDir>/src/hooks/__tests__/jest.setup.ts'],
  modulePathIgnorePatterns: ['<rootDir>/ios', '<rootDir>/android'],
};

export default config;
