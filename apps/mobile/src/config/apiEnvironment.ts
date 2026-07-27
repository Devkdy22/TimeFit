export function resolveApiBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL ?? process.env.EXPO_PUBLIC_API_BASE_URL;
  const environment = process.env.EXPO_PUBLIC_API_ENV ?? inferMobileEnvironment();
  if (!configured && environment !== 'production') {
    throw new Error(`EXPO_PUBLIC_API_URL or EXPO_PUBLIC_API_BASE_URL is required in ${environment} environment.`);
  }

  const raw = configured ?? 'https://timefit-api.onrender.com';

  let parsed: URL;
  try {
    parsed = new URL(raw);
    const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';

    // Android emulator cannot reach host machine via localhost.
    if (process.env.EXPO_PUBLIC_PLATFORM === 'android' && isLocalhost) {
      parsed.hostname = '10.0.2.2';
    }

  } catch {
    if (environment !== 'production') {
      throw new Error(`Configured API URL must be a valid absolute URL in ${environment} environment.`);
    }
    return 'https://timefit-api.onrender.com';
  }

  if (environment === 'qa' && parsed.hostname === 'timefit-api.onrender.com') {
    throw new Error('QA environment cannot use the production API URL.');
  }
  if (environment === 'qa' && parsed.protocol !== 'https:') {
    throw new Error('QA environment requires an HTTPS API URL.');
  }

  return parsed.toString().replace(/\/$/, '');
}

function inferMobileEnvironment(): 'local' | 'temporary-e2e' | 'qa' | 'production' {
  if (process.env.NODE_ENV === 'test') return 'temporary-e2e';
  if (process.env.NODE_ENV === 'production') return 'production';
  return 'local';
}
