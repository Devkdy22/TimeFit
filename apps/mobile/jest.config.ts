import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: [
    '<rootDir>/src/hooks/__tests__',
    '<rootDir>/src/features/moving/hooks/__tests__',
    '<rootDir>/src/features/moving/screen/live',
    '<rootDir>/src/features/map',
    '<rootDir>/src/features/notifications',
    '<rootDir>/src/features/routine',
    '<rootDir>/src/config',
    '<rootDir>/src/components/timey',
    '<rootDir>/src/screens/settings',
    '<rootDir>/src/domain',
  ],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  clearMocks: true,
  restoreMocks: true,
  setupFilesAfterEnv: ['<rootDir>/src/hooks/__tests__/jest.setup.ts'],
  modulePathIgnorePatterns: ['<rootDir>/ios', '<rootDir>/android'],
};

export default config;
