import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  abortPendingAuthRefresh,
  configureAuthSessionBridge,
  getMyAuthProfile,
  loginWithSocialProvider,
  logoutAuthSession,
  refreshAuthSession,
  type AuthProfile,
  type SocialProvider as ApiSocialProvider,
} from '../../services/api/client';

export type SocialProvider = ApiSocialProvider;

export interface PendingRoutineSeed {
  originName: string;
  destinationName: string;
  targetTime?: string;
}

export type AuthSessionState = 'hydrating' | 'authenticated' | 'logged_out';

interface AuthContextValue {
  authState: AuthSessionState;
  isAuthHydrating: boolean;
  isLoggedIn: boolean;
  isLoginLoading: boolean;
  accessToken: string | null;
  profile: AuthProfile | null;
  pendingRoutineSeed: PendingRoutineSeed | null;
  getSessionGeneration: () => number;
  login: (provider: SocialProvider) => Promise<void>;
  logout: () => void;
  setPendingRoutineSeed: (seed: PendingRoutineSeed | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function makeOAuthState(provider: SocialProvider) {
  return `${provider}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function getGoogleClientId() {
  return process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
}

function getKakaoClientId() {
  return process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY ?? '';
}

function getNaverClientId() {
  return process.env.EXPO_PUBLIC_NAVER_CLIENT_ID ?? '';
}

type AuthSessionModule = {
  makeRedirectUri: (options?: {
    scheme?: string;
    path?: string;
    useProxy?: boolean;
  }) => string;
};

type RedirectResolution = {
  redirectUri: string;
  runtime: 'expo-go' | 'dev-build-or-standalone' | 'web';
};

function resolveRedirectUri(authSession: AuthSessionModule): RedirectResolution {
  if (Platform.OS === 'web') {
    return {
      redirectUri: authSession.makeRedirectUri(),
      runtime: 'web',
    };
  }

  // Expo Go uses the auth.expo.io proxy redirect.
  const appOwnership = Constants.appOwnership ?? null;
  const executionEnvironment = Constants.executionEnvironment ?? null;
  if (appOwnership === 'expo' || executionEnvironment === 'storeClient') {
    const owner = process.env.EXPO_PUBLIC_EXPO_OWNER ?? 'devkdy';
    const slug = process.env.EXPO_PUBLIC_EXPO_SLUG ?? 'timefit-mobile';
    return {
      redirectUri: `https://auth.expo.io/@${owner}/${slug}`,
      runtime: 'expo-go',
    };
  }

  // Development Build / EAS Build / Standalone app. Must match app.json scheme.
  return {
    redirectUri: 'timefit://auth',
    runtime: 'dev-build-or-standalone',
  };
}

function getRuntimeDescriptor() {
  return {
    platform: Platform.OS,
    appOwnership: Constants.appOwnership ?? null,
    executionEnvironment: Constants.executionEnvironment ?? null,
  };
}

function summarizeAuthUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const keys = [...parsed.searchParams.keys()];
    return `${parsed.origin}${parsed.pathname}?keys=${keys.join(',')}`;
  } catch {
    return 'invalid_auth_url';
  }
}

function buildAuthResultLog(result: Record<string, unknown>) {
  const urlValue = typeof result.url === 'string' ? result.url : null;
  const callback = urlValue ? readCallbackParams(urlValue) : {};
  return {
    type: typeof result.type === 'string' ? result.type : 'unknown',
    hasUrl: Boolean(urlValue),
    hasCode: Boolean(callback.code),
    hasState: Boolean(callback.state),
    errorCode:
      typeof result.errorCode === 'string'
        ? result.errorCode
        : typeof result.error === 'string'
          ? result.error
          : undefined,
    params:
      result.params && typeof result.params === 'object'
        ? Object.keys(result.params as Record<string, unknown>)
        : undefined,
  };
}

function toAuthResultError(provider: SocialProvider, resultType: string, reason?: string) {
  const labels: Record<SocialProvider, string> = {
    google: 'Google',
    kakao: 'Kakao',
    naver: 'Naver',
  };
  if (reason) {
    return new Error(`${labels[provider]} 로그인 실패(${resultType}): ${reason}`);
  }
  return new Error(`${labels[provider]} 로그인 실패(${resultType})`);
}

function validateStateMatch(
  provider: SocialProvider,
  expectedState: string,
  actualState: string | undefined,
) {
  if (actualState && actualState === expectedState) {
    return;
  }
  throw toAuthResultError(provider, 'state_mismatch', 'state 검증에 실패했습니다.');
}

function classifyAuthResultFailure(
  provider: SocialProvider,
  result: Record<string, unknown>,
): Error {
  const type = typeof result.type === 'string' ? result.type : 'unknown';
  if (type === 'cancel') {
    return toAuthResultError(provider, type, '사용자가 로그인을 취소했습니다.');
  }
  if (type === 'dismiss') {
    return toAuthResultError(provider, type, '로그인 화면이 닫혔습니다.');
  }
  if (type === 'locked') {
    return toAuthResultError(provider, type, '인증 세션이 잠긴 상태입니다.');
  }
  if (type === 'error') {
    const errorCode =
      typeof result.errorCode === 'string'
        ? result.errorCode
        : typeof result.error === 'string'
          ? result.error
          : 'unknown';
    return toAuthResultError(provider, type, `errorCode=${errorCode}`);
  }
  return toAuthResultError(provider, type, '알 수 없는 인증 실패');
}

async function loadAuthSessionModules() {
  try {
    const authSessionModuleName = 'expo-auth-session';
    const webBrowserModuleName = 'expo-web-browser';
    const authSession = await import(authSessionModuleName);
    const webBrowser = await import(webBrowserModuleName);
    webBrowser.maybeCompleteAuthSession();
    return { authSession, webBrowser };
  } catch {
    throw new Error(
      'expo-auth-session/expo-web-browser가 설치되지 않았습니다. `apps/mobile`에서 의존성을 설치해주세요.',
    );
  }
}

function readCallbackParams(callbackUrl: string) {
  const normalized = callbackUrl.replace('#', '?');
  try {
    const parsed = new URL(normalized);
    const params = new URLSearchParams(parsed.search);
    return {
      code: params.get('code') ?? undefined,
      state: params.get('state') ?? undefined,
      idToken: params.get('id_token') ?? undefined,
    };
  } catch {
    return {};
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthSessionState>('hydrating');
  const [isLoggedIn, setLoggedIn] = useState(false);
  const [isLoginLoading, setLoginLoading] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [accessExpiresAt, setAccessExpiresAt] = useState<number | null>(null);
  const [pendingRoutineSeed, setPendingRoutineSeed] = useState<PendingRoutineSeed | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  const refreshTokenRef = useRef<string | null>(null);
  const sessionGenerationRef = useRef(0);
  const logoutInFlightRef = useRef(false);

  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  useEffect(() => {
    refreshTokenRef.current = refreshToken;
  }, [refreshToken]);

  const hydrateProfile = useCallback(async (token: string) => {
    const nextProfile = await getMyAuthProfile(token);
    setProfile(nextProfile);
  }, []);

  const clearLocalSession = useCallback(async () => {
    if (logoutInFlightRef.current) {
      return;
    }
    logoutInFlightRef.current = true;
    sessionGenerationRef.current += 1;
    abortPendingAuthRefresh();
    accessTokenRef.current = null;
    refreshTokenRef.current = null;
    setLoggedIn(false);
    setAccessToken(null);
    setProfile(null);
    setRefreshToken(null);
    setAccessExpiresAt(null);
    setAuthState('logged_out');
    try {
      await AsyncStorage.multiRemove(['auth.accessToken', 'auth.refreshToken']);
    } finally {
      logoutInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const storedRefresh = await AsyncStorage.getItem('auth.refreshToken');
      if (!storedRefresh) {
        setAuthState('logged_out');
        return;
      }
      try {
        const hydrationGeneration = sessionGenerationRef.current;
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => {
          timeoutController.abort();
        }, 10_000);
        try {
          const refreshed = await refreshAuthSession(storedRefresh, timeoutController.signal);
          if (sessionGenerationRef.current !== hydrationGeneration) {
            return;
          }
          accessTokenRef.current = refreshed.accessToken;
          refreshTokenRef.current = refreshed.refreshToken;
          setAccessToken(refreshed.accessToken);
          setRefreshToken(refreshed.refreshToken);
          setAccessExpiresAt(Date.now() + refreshed.expiresIn * 1000);
          await hydrateProfile(refreshed.accessToken);
          setLoggedIn(true);
          setAuthState('authenticated');
          await AsyncStorage.multiSet([
            ['auth.accessToken', refreshed.accessToken],
            ['auth.refreshToken', refreshed.refreshToken],
          ]);
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.warn('[Auth] hydration refresh timeout');
        }
        await clearLocalSession();
      }
    })();
  }, [clearLocalSession, hydrateProfile]);

  useEffect(() => {
    if (!refreshToken || !accessExpiresAt) {
      return;
    }

    const refreshInMs = Math.max(3_000, accessExpiresAt - Date.now() - 45_000);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const refreshGeneration = sessionGenerationRef.current;
          const refreshed = await refreshAuthSession(refreshToken);
          if (sessionGenerationRef.current !== refreshGeneration) {
            return;
          }
          accessTokenRef.current = refreshed.accessToken;
          refreshTokenRef.current = refreshed.refreshToken;
          setAccessToken(refreshed.accessToken);
          setRefreshToken(refreshed.refreshToken);
          setAccessExpiresAt(Date.now() + refreshed.expiresIn * 1000);
          await hydrateProfile(refreshed.accessToken);
          setLoggedIn(true);
          setAuthState('authenticated');
          await AsyncStorage.multiSet([
            ['auth.accessToken', refreshed.accessToken],
            ['auth.refreshToken', refreshed.refreshToken],
          ]);
        } catch {
          await clearLocalSession();
        }
      })();
    }, refreshInMs);

    return () => clearTimeout(timer);
  }, [accessExpiresAt, clearLocalSession, hydrateProfile, refreshToken]);

  useEffect(() => {
    configureAuthSessionBridge({
      getAccessToken: () => accessTokenRef.current,
      getSessionGeneration: () => sessionGenerationRef.current,
      refreshSession: async (signal, generation) => {
        if (sessionGenerationRef.current !== generation) {
          return false;
        }
        const currentRefresh = refreshTokenRef.current;
        if (!currentRefresh) {
          throw new Error('refresh_token_missing');
        }
        const refreshed = await refreshAuthSession(currentRefresh, signal);
        if (sessionGenerationRef.current !== generation) {
          return false;
        }
        // Keep refs in sync before state commit so retry immediately uses fresh tokens.
        accessTokenRef.current = refreshed.accessToken;
        refreshTokenRef.current = refreshed.refreshToken;
        setAccessToken(refreshed.accessToken);
        setRefreshToken(refreshed.refreshToken);
        setAccessExpiresAt(Date.now() + refreshed.expiresIn * 1000);
        await hydrateProfile(refreshed.accessToken);
        setLoggedIn(true);
        setAuthState('authenticated');
        await AsyncStorage.multiSet([
          ['auth.accessToken', refreshed.accessToken],
          ['auth.refreshToken', refreshed.refreshToken],
        ]);
        return true;
      },
      onAuthFailure: (reason) => {
        if (reason === 'REFRESH_TIMEOUT') {
          console.warn('[Auth] authorizedFetch refresh timeout');
        }
        void clearLocalSession();
      },
      onRefreshTimeout: (scope) => {
        console.warn('[Auth] refresh timeout', { scope });
      },
    });
    return () => {
      configureAuthSessionBridge(null);
    };
  }, [clearLocalSession, hydrateProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      authState,
      isAuthHydrating: authState === 'hydrating',
      isLoggedIn,
      isLoginLoading,
      accessToken,
      profile,
      pendingRoutineSeed,
      getSessionGeneration: () => sessionGenerationRef.current,
      login: async (provider) => {
        setLoginLoading(true);
        try {
          const { authSession, webBrowser: WebBrowser } = await loadAuthSessionModules();
          const redirectResolution = resolveRedirectUri(authSession as AuthSessionModule);
          const redirectUri = redirectResolution.redirectUri;
          console.info('[Auth][OAuth]', {
            event: 'oauth_login_start',
            provider,
            redirectUri,
            redirectRuntime: redirectResolution.runtime,
            runtime: getRuntimeDescriptor(),
          });
          let authTokens;
          if (provider === 'google') {
            const clientId = getGoogleClientId();
            if (!clientId) {
              throw new Error('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is missing.');
            }
            const state = makeOAuthState('google');
            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
              client_id: clientId,
              redirect_uri: redirectUri,
              response_type: 'code',
              scope: 'openid profile email',
              access_type: 'offline',
              state,
            }).toString()}`;

            console.info('[Auth][OAuth]', {
              event: 'oauth_open_auth_session',
              provider,
              redirectUri,
              authUrl: summarizeAuthUrl(authUrl),
            });
            const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
            const resultLog = buildAuthResultLog(result as Record<string, unknown>);
            console.info('[Auth][OAuth]', {
              event: 'oauth_auth_session_result',
              provider,
              redirectUri,
              authUrl: summarizeAuthUrl(authUrl),
              ...resultLog,
            });
            if (result.type !== 'success') {
              throw classifyAuthResultFailure(provider, result as Record<string, unknown>);
            }
            if (!result.url) {
              throw toAuthResultError(provider, 'success_missing_url', '콜백 URL이 없습니다.');
            }
            const { code: authorizationCode } = readCallbackParams(result.url);
            if (!authorizationCode) {
              throw toAuthResultError(provider, 'success_missing_code', 'authorization code가 없습니다.');
            }
            validateStateMatch(provider, state, readCallbackParams(result.url).state);
            authTokens = await loginWithSocialProvider({
              provider: 'google',
              authorizationCode,
              redirectUri,
              state,
            });
          } else if (provider === 'kakao') {
            const clientId = getKakaoClientId();
            if (!clientId) {
              throw new Error('EXPO_PUBLIC_KAKAO_REST_API_KEY is missing.');
            }
            const state = makeOAuthState('kakao');
            const authUrl = `https://kauth.kakao.com/oauth/authorize?${new URLSearchParams({
              client_id: clientId,
              redirect_uri: redirectUri,
              response_type: 'code',
              state,
            }).toString()}`;

            console.info('[Auth][OAuth]', {
              event: 'oauth_open_auth_session',
              provider,
              redirectUri,
              authUrl: summarizeAuthUrl(authUrl),
            });
            const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
            const resultLog = buildAuthResultLog(result as Record<string, unknown>);
            console.info('[Auth][OAuth]', {
              event: 'oauth_auth_session_result',
              provider,
              redirectUri,
              authUrl: summarizeAuthUrl(authUrl),
              ...resultLog,
            });
            if (result.type !== 'success') {
              throw classifyAuthResultFailure(provider, result as Record<string, unknown>);
            }
            if (!result.url) {
              throw toAuthResultError(provider, 'success_missing_url', '콜백 URL이 없습니다.');
            }
            const { code: authorizationCode } = readCallbackParams(result.url);
            if (!authorizationCode) {
              throw toAuthResultError(provider, 'success_missing_code', 'authorization code가 없습니다.');
            }
            validateStateMatch(provider, state, readCallbackParams(result.url).state);
            authTokens = await loginWithSocialProvider({
              provider: 'kakao',
              authorizationCode,
              redirectUri,
            });
          } else {
            const clientId = getNaverClientId();
            if (!clientId) {
              throw new Error('EXPO_PUBLIC_NAVER_CLIENT_ID is missing.');
            }
            const state = makeOAuthState('naver');
            const authUrl = `https://nid.naver.com/oauth2.0/authorize?${new URLSearchParams({
              response_type: 'code',
              client_id: clientId,
              redirect_uri: redirectUri,
              state,
            }).toString()}`;

            console.info('[Auth][OAuth]', {
              event: 'oauth_open_auth_session',
              provider,
              redirectUri,
              authUrl: summarizeAuthUrl(authUrl),
            });
            const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
            const resultLog = buildAuthResultLog(result as Record<string, unknown>);
            console.info('[Auth][OAuth]', {
              event: 'oauth_auth_session_result',
              provider,
              redirectUri,
              authUrl: summarizeAuthUrl(authUrl),
              ...resultLog,
            });
            if (result.type !== 'success') {
              throw classifyAuthResultFailure(provider, result as Record<string, unknown>);
            }
            if (!result.url) {
              throw toAuthResultError(provider, 'success_missing_url', '콜백 URL이 없습니다.');
            }
            const { code: authorizationCode, state: responseState } = readCallbackParams(
              result.url,
            );
            if (!authorizationCode) {
              throw toAuthResultError(provider, 'success_missing_code', 'authorization code가 없습니다.');
            }
            validateStateMatch(provider, state, responseState);
            authTokens = await loginWithSocialProvider({
              provider: 'naver',
              authorizationCode,
              redirectUri,
              state,
            });
          }

          logoutInFlightRef.current = false;
          sessionGenerationRef.current += 1;
          accessTokenRef.current = authTokens.accessToken;
          refreshTokenRef.current = authTokens.refreshToken;
          setAccessToken(authTokens.accessToken);
          setRefreshToken(authTokens.refreshToken);
          setAccessExpiresAt(Date.now() + authTokens.expiresIn * 1000);
          await hydrateProfile(authTokens.accessToken);
          setLoggedIn(true);
          setAuthState('authenticated');
          await AsyncStorage.multiSet([
            ['auth.accessToken', authTokens.accessToken],
            ['auth.refreshToken', authTokens.refreshToken],
          ]);
        } catch (error) {
          if (error instanceof Error) {
            throw error;
          }
          throw new Error('로그인 처리 중 알 수 없는 오류가 발생했습니다.');
        } finally {
          setLoginLoading(false);
        }
      },
      logout: () => {
        const currentRefresh = refreshToken;
        const currentAccess = accessToken;
        void clearLocalSession();
        if (currentRefresh) {
          void logoutAuthSession(currentRefresh, currentAccess ?? undefined);
        }
      },
      setPendingRoutineSeed,
    }),
    [
      accessToken,
      authState,
      clearLocalSession,
      hydrateProfile,
      isLoggedIn,
      isLoginLoading,
      pendingRoutineSeed,
      profile,
      refreshToken,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
