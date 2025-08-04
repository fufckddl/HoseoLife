import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from './contexts/AuthContext';
import { LoadingScreen } from './components/LoadingScreen';

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  
  useEffect(() => {
    if (!loading) {
      // 약간의 지연을 두어 Root Layout이 완전히 마운트된 후 네비게이션 실행
      const timer = setTimeout(() => {
        if (isAuthenticated) {
          console.log('인증된 사용자, 홈 화면으로 이동');
          router.replace('/tabs/home');
        } else {
          console.log('인증되지 않은 사용자, 로그인 화면으로 이동');
          router.replace('/auth/register');
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, loading, router]);

  // 로딩 중일 때는 로딩 화면 표시
  if (loading) {
    return <LoadingScreen message="자동 로그인 확인 중..." />;
  }

  return null;
}
