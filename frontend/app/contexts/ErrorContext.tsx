import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Platform, LogBox } from 'react-native';
import { useAuth } from './AuthContext';

type GlobalError = {
  message: string;
  detail?: unknown;
  source?: 'console' | 'global' | 'manual';
  timestamp: number;
};

type ErrorContextValue = {
  lastError: GlobalError | null;
  setError: (err: Omit<GlobalError, 'timestamp'>) => void;
  clearError: () => void;
};

const ErrorContext = createContext<ErrorContextValue | undefined>(undefined);

export const useError = (): ErrorContextValue => {
  const ctx = useContext(ErrorContext);
  if (!ctx) throw new Error('useError must be used within ErrorProvider');
  return ctx;
};

export const ErrorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const { user } = useAuth();
  const [lastError, setLastError] = useState<GlobalError | null>(null);
  const cooldownRef = useRef<number>(0);
  const originalConsoleErrorRef = useRef<typeof console.error | null>(null);

  const navigateToErrorOnce = (err: GlobalError) => {
    const now = Date.now();
    if (now - cooldownRef.current < 4000) {
      return; // 4초 쿨다운으로 과도한 전환 방지
    }
    cooldownRef.current = now;
    // 관리자 외에는 민감한 상세정보를 제거
    const isAdmin = !!user?.is_admin;
    const sanitized: GlobalError = isAdmin
      ? err
      : { message: '오류가 발생했습니다', source: err.source, timestamp: err.timestamp };
    setLastError(sanitized);
    try {
      router.push('/pages/error');
    } catch (_) {
      // 라우팅 실패는 조용히 무시
    }
  };

  const setError = (err: Omit<GlobalError, 'timestamp'>) => {
    navigateToErrorOnce({ ...err, timestamp: Date.now() });
  };

  const clearError = () => setLastError(null);

  useEffect(() => {
    // RN LogBox 토스트 전역 비활성화
    try {
      LogBox.ignoreAllLogs(true);
    } catch {}

    // console.error 후킹
    if (!originalConsoleErrorRef.current) {
      originalConsoleErrorRef.current = console.error.bind(console);
      console.error = (...args: unknown[]) => {
        // 원본 error 호출을 막아 RN 토스트 방지
        // 필요시 일반 로그로만 남김
        try { console.log('[captured error]', ...args); } catch {}

        // 로그인 실패 계열은 전역 에러 페이지로 이동하지 않음
        try {
          const first = args?.[0];
          if (typeof first === 'string') {
            const msg = first.toLowerCase();
            if (
              msg.includes('로그인 실패') ||
              msg.includes('로그인 오류') ||
              msg.includes('/users/login') ||
              msg.includes('login')
            ) {
              return;
            }
          }
        } catch {}
        navigateToErrorOnce({
          message: '오류가 발생했습니다',
          detail: args,
          source: 'console',
          timestamp: Date.now(),
        });
      };
    }

    // 글로벌 예외/미처리 리젝션
    const onError = (e: any) => {
      navigateToErrorOnce({
        message: e?.message || '오류가 발생했습니다',
        detail: e,
        source: 'global',
        timestamp: Date.now(),
      });
      return true;
    };

    const onUnhandledRejection = (e: any) => {
      navigateToErrorOnce({
        message: e?.reason?.message || '오류가 발생했습니다',
        detail: e?.reason || e,
        source: 'global',
        timestamp: Date.now(),
      });
    };

    // @ts-ignore React Native 환경의 전역 핸들러
    const prevHandler = global.ErrorUtils?.getGlobalHandler?.();
    // @ts-ignore
    global.ErrorUtils?.setGlobalHandler?.((error: any, isFatal?: boolean) => {
      navigateToErrorOnce({
        message: error?.message || '오류가 발생했습니다',
        detail: { error, isFatal },
        source: 'global',
        timestamp: Date.now(),
      });
      // 기본 핸들러 호출을 생략하여 RN 레드박스/토스트 표시 방지
    });

    // 브라우저/웹 환경에서만 window 이벤트 사용
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // @ts-ignore
      if (typeof window.addEventListener === 'function') {
        // @ts-ignore
        window.addEventListener('error', onError);
        // @ts-ignore
        window.addEventListener('unhandledrejection', onUnhandledRejection);
      }
    }

    return () => {
      // cleanup은 console.error 원복은 하지 않음(앱 생애주기 동안 유지)
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        // @ts-ignore
        if (typeof window.removeEventListener === 'function') {
          // @ts-ignore
          window.removeEventListener('error', onError);
          // @ts-ignore
          window.removeEventListener('unhandledrejection', onUnhandledRejection);
        }
      }
    };
  }, []);

  const value = useMemo(() => ({ lastError, setError, clearError }), [lastError]);

  return (
    <ErrorContext.Provider value={value}>
      {children}
    </ErrorContext.Provider>
  );
};


