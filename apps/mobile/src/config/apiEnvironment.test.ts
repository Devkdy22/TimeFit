import { resolveApiBaseUrl } from './apiEnvironment';

describe('API environment safety', () => {
  const mutableEnv = process.env as unknown as Record<string, string | undefined>;
  const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
  const originalApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalApiEnv = process.env.EXPO_PUBLIC_API_ENV;

  afterEach(() => {
    if (originalApiUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
    if (originalApiBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalApiBaseUrl;
    mutableEnv.NODE_ENV = originalNodeEnv;
    if (originalApiEnv === undefined) delete process.env.EXPO_PUBLIC_API_ENV;
    else process.env.EXPO_PUBLIC_API_ENV = originalApiEnv;
  });

  it('rejects the production fallback when test API URL is missing', () => {
    mutableEnv.NODE_ENV = 'test';
    delete process.env.EXPO_PUBLIC_API_URL;
    delete process.env.EXPO_PUBLIC_API_BASE_URL;

    expect(() => resolveApiBaseUrl()).toThrow('required in temporary-e2e environment');
  });

  it('accepts an explicitly configured test or QA API URL', () => {
    mutableEnv.NODE_ENV = 'test';
    process.env.EXPO_PUBLIC_API_URL = 'https://timefit-qa.example.test/';
    delete process.env.EXPO_PUBLIC_API_BASE_URL;

    expect(resolveApiBaseUrl()).toBe('https://timefit-qa.example.test');
  });

  it('rejects malformed API URLs in test environment', () => {
    mutableEnv.NODE_ENV = 'test';
    process.env.EXPO_PUBLIC_API_URL = 'not-a-url';
    delete process.env.EXPO_PUBLIC_API_BASE_URL;

    expect(() => resolveApiBaseUrl()).toThrow('valid absolute URL');
  });

  it('rejects a missing URL in QA environment instead of using production', () => {
    mutableEnv.NODE_ENV = 'production';
    process.env.EXPO_PUBLIC_API_ENV = 'qa';
    delete process.env.EXPO_PUBLIC_API_URL;
    delete process.env.EXPO_PUBLIC_API_BASE_URL;

    expect(() => resolveApiBaseUrl()).toThrow('required in qa environment');
  });

  it('rejects the production API URL in QA', () => {
    process.env.EXPO_PUBLIC_API_ENV = 'qa';
    process.env.EXPO_PUBLIC_API_URL = 'https://timefit-api.onrender.com';

    expect(() => resolveApiBaseUrl()).toThrow('QA environment cannot use the production API URL');
  });

  it('rejects a non-HTTPS URL in QA', () => {
    process.env.EXPO_PUBLIC_API_ENV = 'qa';
    process.env.EXPO_PUBLIC_API_URL = 'http://qa-api.example.test';

    expect(() => resolveApiBaseUrl()).toThrow('QA environment requires an HTTPS API URL');
  });
});
