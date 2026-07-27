(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Tests must never inherit the mobile client's production API fallback.
if (!process.env.EXPO_PUBLIC_API_URL && !process.env.EXPO_PUBLIC_API_BASE_URL) {
  process.env.EXPO_PUBLIC_API_URL = 'http://127.0.0.1:3000';
}
