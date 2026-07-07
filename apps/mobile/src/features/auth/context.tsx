import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  abortPendingAuthRefresh,
  buildOAuthStartUrl,
  checkOAuthServerHealth,
  configureAuthSessionBridge,
  getMyAuthProfile,
  logoutAuthSession,
  redeemOAuthLoginTicket,
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

export type OAuthWarmupStatus = 'checking' | 'ready' | 'error';

export interface OAuthWarmupState {
  visible: boolean;
  provider: SocialProvider | null;
  status: OAuthWarmupStatus;
  elapsedMs: number;
  progress: number;
  message: string;
  errorMessage: string | null;
}

interface AuthContextValue {
  authState: AuthSessionState;
  isAuthHydrating: boolean;
  isLoggedIn: boolean;
  isLoginLoading: boolean;
  oauthWarmup: OAuthWarmupState;
  accessToken: string | null;
  profile: AuthProfile | null;
  pendingRoutineSeed: PendingRoutineSeed | null;
  getSessionGeneration: () => number;
  login: (provider: SocialProvider) => Promise<void>;
  cancelOAuthWarmup: () => void;
  redeemOAuthCallback: (input: OAuthCallbackInput) => Promise<OAuthCallbackRedeemResult>;
  logout: () => void;
  setPendingRoutineSeed: (seed: PendingRoutineSeed | null) => void;
}

export interface OAuthCallbackInput {
  ticket?: string;
  error?: string;
  state?: string;
  provider?: SocialProvider;
  source?: 'auth_session_result' | 'auth_route';
}

export type OAuthCallbackRedeemResult = 'redeemed' | 'already_processed';

const AuthContext = createContext<AuthContextValue | null>(null);

const OAUTH_WARMUP_TIMEOUT_MS = 60_000;
const OAUTH_WARMUP_INTERVAL_MS = 2_000;
const OAUTH_HEALTH_REQUEST_TIMEOUT_MS = 4_000;
const OAUTH_WARMUP_TIMEOUT_MESSAGE = '서버가 아직 준비되지 않았어요. 잠시 후 다시 시도해주세요.';
const OAUTH_WARMUP_CANCELLED_MESSAGE = 'oauth_warmup_cancelled';
const OAUTH_IN_PROGRESS_MESSAGE = 'oauth_in_progress';

export function shouldSuppressLoginAlert(error: unknown) {
  return (
    error instanceof Error &&
    (error.message === OAUTH_WARMUP_TIMEOUT_MESSAGE ||
      error.message === OAUTH_WARMUP_CANCELLED_MESSAGE ||
      error.message === OAUTH_IN_PROGRESS_MESSAGE)
  );
}

const initialOAuthWarmupState: OAuthWarmupState = {
  visible: false,
  provider: null,
  status: 'checking',
  elapsedMs: 0,
  progress: 0,
  message: '서버 상태를 확인하고 있어요',
  errorMessage: null,
};

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
    hasTicket: Boolean(callback.ticket),
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
      error: params.get('error') ?? undefined,
      state: params.get('state') ?? undefined,
      ticket: params.get('ticket') ?? undefined,
      idToken: params.get('id_token') ?? undefined,
    };
  } catch {
    return {};
  }
}

function readCallbackProvider(callbackUrl: string): SocialProvider | undefined {
  try {
    const parsed = new URL(callbackUrl);
    const provider = parsed.searchParams.get('provider');
    if (provider === 'google' || provider === 'kakao' || provider === 'naver') {
      return provider;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function logOAuthCallback(event: string, url: string | null) {
  if (!url?.startsWith('timefit://auth')) {
    return;
  }
  const params = readCallbackParams(url);
  console.info('[Auth][OAuth]', {
    event,
    provider: readCallbackProvider(url),
    hasCode: Boolean(params.code),
    hasTicket: Boolean(params.ticket),
    hasState: Boolean(params.state),
    redirectUri: 'timefit://auth',
    runtime: getRuntimeDescriptor(),
  });
}

function getOAuthWarmupMessage(elapsedMs: number) {
  if (elapsedMs >= 50_000) {
    return '준비가 조금 늦어지고 있어요';
  }
  if (elapsedMs >= 30_000) {
    return '거의 다 왔어요. 조금만 더 기다려주세요';
  }
  if (elapsedMs >= 10_000) {
    return '타임이가 서버를 깨우고 있어요';
  }
  return '서버 상태를 확인하고 있어요';
}

function sleep(ms: number, signal?: AbortSignal | null) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error(OAUTH_WARMUP_CANCELLED_MESSAGE));
      return;
    }

    const onResolve = () => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    };
    const onAbort = () => {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', onAbort);
      reject(new Error(OAUTH_WARMUP_CANCELLED_MESSAGE));
    };
    const timeoutId = setTimeout(onResolve, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function mergeWarmupSignals(signals: Array<AbortSignal | null | undefined>) {
  const active = signals.filter((signal): signal is AbortSignal => Boolean(signal));
  if (active.length === 0) {
    return undefined;
  }
  const aborted = active.find((signal) => signal.aborted);
  if (aborted) {
    return aborted;
  }

  const controller = new AbortController();
  const onAbort = () => {
    controller.abort();
    for (const signal of active) {
      signal.removeEventListener('abort', onAbort);
    }
  };
  for (const signal of active) {
    signal.addEventListener('abort', onAbort);
  }
  return controller.signal;
}

async function requestOAuthHealth(attempt: number, signal?: AbortSignal | null) {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => {
    timeoutController.abort();
  }, OAUTH_HEALTH_REQUEST_TIMEOUT_MS);

  try {
    const response = await checkOAuthServerHealth(mergeWarmupSignals([signal, timeoutController.signal]));
    if (response.ok) {
      return true;
    }
    console.info(`[Auth][OAuthWarmup] health_check_failed attempt=${attempt} status=${response.status}`);
    return false;
  } catch (error) {
    if (signal?.aborted) {
      throw new Error(OAUTH_WARMUP_CANCELLED_MESSAGE);
    }
    const reason = error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network_error';
    console.info(`[Auth][OAuthWarmup] health_check_failed attempt=${attempt} status=${reason}`);
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthSessionState>('hydrating');
  const [isLoggedIn, setLoggedIn] = useState(false);
  const [isLoginLoading, setLoginLoading] = useState(false);
  const [oauthWarmup, setOAuthWarmup] = useState<OAuthWarmupState>(initialOAuthWarmupState);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [accessExpiresAt, setAccessExpiresAt] = useState<number | null>(null);
  const [pendingRoutineSeed, setPendingRoutineSeed] = useState<PendingRoutineSeed | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  const refreshTokenRef = useRef<string | null>(null);
  const sessionGenerationRef = useRef(0);
  const logoutInFlightRef = useRef(false);
  const oauthInFlightRef = useRef(false);
  const oauthWarmupAbortRef = useRef<AbortController | null>(null);
  const oauthTicketPromisesRef = useRef(new Map<string, Promise<void>>());
  const processedOAuthTicketsRef = useRef(new Set<string>());

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
    let isMounted = true;
    void Linking.getInitialURL().then((url) => {
      if (isMounted) {
        logOAuthCallback('oauth_deep_link_initial_url', url);
      }
    });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      logOAuthCallback('oauth_deep_link_url_event', url);
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
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

  const redeemOAuthCallback = useCallback(
    async (input: OAuthCallbackInput): Promise<OAuthCallbackRedeemResult> => {
      if (input.error) {
        throw toAuthResultError(input.provider ?? 'google', 'provider_error', input.error);
      }
      if (!input.ticket) {
        throw toAuthResultError(input.provider ?? 'google', 'success_missing_ticket', '로그인 티켓이 없습니다.');
      }

      const ticket = input.ticket;
      if (processedOAuthTicketsRef.current.has(ticket)) {
        console.info('[Auth][OAuth]', {
          event: 'oauth_ticket_redeem_skipped',
          provider: input.provider,
          source: input.source,
          reason: 'already_processed',
          hasState: Boolean(input.state),
        });
        return 'already_processed';
      }

      const existing = oauthTicketPromisesRef.current.get(ticket);
      if (existing) {
        console.info('[Auth][OAuth]', {
          event: 'oauth_ticket_redeem_joined',
          provider: input.provider,
          source: input.source,
          hasState: Boolean(input.state),
        });
        await existing;
        return 'already_processed';
      }

      const redeemPromise = (async () => {
        console.info('[Auth][OAuth]', {
          event: 'oauth_ticket_redeem_start',
          provider: input.provider,
          source: input.source,
          hasState: Boolean(input.state),
        });
        const authTokens = await redeemOAuthLoginTicket(ticket);

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
        processedOAuthTicketsRef.current.add(ticket);
        console.info('[Auth][OAuth]', {
          event: 'oauth_ticket_redeem_success',
          provider: input.provider,
          source: input.source,
        });
      })();

      oauthTicketPromisesRef.current.set(ticket, redeemPromise);
      try {
        await redeemPromise;
        return 'redeemed';
      } finally {
        oauthTicketPromisesRef.current.delete(ticket);
      }
    },
    [hydrateProfile],
  );

  const waitForOAuthServerReady = useCallback(
    async (provider: SocialProvider, signal: AbortSignal) => {
      const startedAt = Date.now();
      let attempt = 0;

      while (Date.now() - startedAt < OAUTH_WARMUP_TIMEOUT_MS) {
        const attemptStartedAt = Date.now();
        const elapsedMs = Date.now() - startedAt;
        setOAuthWarmup((current) => ({
          ...current,
          visible: true,
          provider,
          status: 'checking',
          elapsedMs,
          progress: Math.min(0.9, elapsedMs / OAUTH_WARMUP_TIMEOUT_MS),
          message: getOAuthWarmupMessage(elapsedMs),
          errorMessage: null,
        }));

        attempt += 1;
        console.info(`[Auth][OAuthWarmup] health_check_attempt attempt=${attempt}`);
        const ready = await requestOAuthHealth(attempt, signal);
        if (ready) {
          const readyElapsedMs = Date.now() - startedAt;
          console.info(`[Auth][OAuthWarmup] health_check_success elapsedMs=${readyElapsedMs}`);
          setOAuthWarmup((current) => ({
            ...current,
            visible: true,
            provider,
            status: 'ready',
            elapsedMs: readyElapsedMs,
            progress: 1,
            message: '로그인 화면으로 이동할게요',
            errorMessage: null,
          }));
          return;
        }

        const attemptElapsedMs = Date.now() - attemptStartedAt;
        const remainingMs = OAUTH_WARMUP_TIMEOUT_MS - (Date.now() - startedAt);
        if (remainingMs <= 0) {
          break;
        }
        await sleep(Math.min(Math.max(0, OAUTH_WARMUP_INTERVAL_MS - attemptElapsedMs), remainingMs), signal);
      }

      const elapsedMs = Date.now() - startedAt;
      console.info(`[Auth][OAuthWarmup] warmup_timeout elapsedMs=${elapsedMs}`);
      setOAuthWarmup((current) => ({
        ...current,
        visible: true,
        provider,
        status: 'error',
        elapsedMs,
        progress: 1,
        message: OAUTH_WARMUP_TIMEOUT_MESSAGE,
        errorMessage: OAUTH_WARMUP_TIMEOUT_MESSAGE,
      }));
      throw new Error(OAUTH_WARMUP_TIMEOUT_MESSAGE);
    },
    [],
  );

  const cancelOAuthWarmup = useCallback(() => {
    console.info('[Auth][OAuthWarmup] warmup_cancelled');
    oauthWarmupAbortRef.current?.abort();
    oauthWarmupAbortRef.current = null;
    oauthInFlightRef.current = false;
    setLoginLoading(false);
    setOAuthWarmup(initialOAuthWarmupState);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      authState,
      isAuthHydrating: authState === 'hydrating',
      isLoggedIn,
      isLoginLoading,
      oauthWarmup,
      accessToken,
      profile,
      pendingRoutineSeed,
      getSessionGeneration: () => sessionGenerationRef.current,
      login: async (provider) => {
        if (oauthInFlightRef.current) {
          throw new Error(OAUTH_IN_PROGRESS_MESSAGE);
        }
        oauthInFlightRef.current = true;
        setLoginLoading(true);
        const warmupAbortController = new AbortController();
        oauthWarmupAbortRef.current = warmupAbortController;
        let keepWarmupErrorVisible = false;
        try {
          console.info(`[Auth][OAuthWarmup] warmup_start provider=${provider}`);
          setOAuthWarmup({
            visible: true,
            provider,
            status: 'checking',
            elapsedMs: 0,
            progress: 0,
            message: '서버 상태를 확인하고 있어요',
            errorMessage: null,
          });
          await waitForOAuthServerReady(provider, warmupAbortController.signal);
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
          const authUrl = buildOAuthStartUrl(provider, redirectUri);
          console.info('[Auth][OAuth]', {
            event: 'oauth_open_auth_session',
            provider,
            redirectUri,
            authUrl: summarizeAuthUrl(authUrl),
          });
          console.info(`[Auth][OAuthWarmup] open_auth_session_after_ready provider=${provider}`);
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
          const { error, ticket, state } = readCallbackParams(result.url);
          await redeemOAuthCallback({
            error,
            ticket,
            state,
            provider: readCallbackProvider(result.url) ?? provider,
            source: 'auth_session_result',
          });
        } catch (error) {
          if (error instanceof Error && error.message === OAUTH_WARMUP_TIMEOUT_MESSAGE) {
            keepWarmupErrorVisible = true;
          }
          if (error instanceof Error) {
            throw error;
          }
          throw new Error('로그인 처리 중 알 수 없는 오류가 발생했습니다.');
        } finally {
          oauthInFlightRef.current = false;
          if (oauthWarmupAbortRef.current === warmupAbortController) {
            oauthWarmupAbortRef.current = null;
          }
          setLoginLoading(false);
          if (!keepWarmupErrorVisible) {
            setOAuthWarmup(initialOAuthWarmupState);
          }
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
      redeemOAuthCallback,
      cancelOAuthWarmup,
      setPendingRoutineSeed,
    }),
    [
      accessToken,
      authState,
      cancelOAuthWarmup,
      clearLocalSession,
      hydrateProfile,
      isLoggedIn,
      isLoginLoading,
      oauthWarmup,
      pendingRoutineSeed,
      profile,
      redeemOAuthCallback,
      refreshToken,
      waitForOAuthServerReady,
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
