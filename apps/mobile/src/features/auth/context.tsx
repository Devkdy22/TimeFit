import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type SocialProvider = 'google' | 'kakao' | 'naver';

export interface PendingRoutineSeed {
  originName: string;
  destinationName: string;
  targetTime?: string;
}

interface AuthContextValue {
  isLoggedIn: boolean;
  isLoginLoading: boolean;
  pendingRoutineSeed: PendingRoutineSeed | null;
  login: (provider: SocialProvider) => Promise<void>;
  logout: () => void;
  setPendingRoutineSeed: (seed: PendingRoutineSeed | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setLoggedIn] = useState(false);
  const [isLoginLoading, setLoginLoading] = useState(false);
  const [pendingRoutineSeed, setPendingRoutineSeed] = useState<PendingRoutineSeed | null>(null);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoggedIn,
      isLoginLoading,
      pendingRoutineSeed,
      login: async () => {
        setLoginLoading(true);
        await new Promise((resolve) => setTimeout(resolve, 700));
        setLoggedIn(true);
        setLoginLoading(false);
      },
      logout: () => setLoggedIn(false),
      setPendingRoutineSeed,
    }),
    [isLoggedIn, isLoginLoading, pendingRoutineSeed],
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
