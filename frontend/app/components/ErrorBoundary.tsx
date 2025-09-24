import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorCount: number; // 오류 발생 횟수 추가
  lastErrorTime: number; // 마지막 오류 발생 시간 추가
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorCount: 0, 
      lastErrorTime: 0 
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // 기본적으로 오류 상태만 설정하고, 카운터는 componentDidCatch에서 처리
    return { 
      hasError: true, 
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 ErrorBoundary caught an error:');
    console.error('🚨 Error:', error);
    console.error('🚨 Error message:', error.message);
    console.error('🚨 Error stack:', error.stack);
    console.error('🚨 Component stack:', errorInfo.componentStack);
    console.error('🚨 Error boundary info:', errorInfo);
    
    // 오류 카운터 증가 및 시간 기록
    const currentTime = Date.now();
    const timeSinceLastError = currentTime - this.state.lastErrorTime;
    
    // 5초 이내에 발생한 오류는 연속 오류로 간주
    const isConsecutiveError = timeSinceLastError < 5000;
    const newErrorCount = isConsecutiveError ? this.state.errorCount + 1 : 1;
    
    console.warn(`🔄 ErrorBoundary 오류 카운트: ${newErrorCount}, 마지막 오류로부터 ${timeSinceLastError}ms 경과`);
    
    // 상태 업데이트
    this.setState({
      errorCount: newErrorCount,
      lastErrorTime: currentTime
    });
    
    // 무한 루프 감지
    if (newErrorCount >= 3) {
      console.error('🚨 ErrorBoundary 무한 루프 감지! 앱 재시작 필요');
    }
    
    // 오류를 더 자세히 분석
    if (error.message.includes('getFCMToken')) {
      console.error('🔔 FCM 토큰 관련 오류 감지');
    }
    if (error.message.includes('setupNotificationListeners')) {
      console.error('🔔 알림 리스너 관련 오류 감지');
    }
    if (error.message.includes('useAuth')) {
      console.error('🔐 인증 컨텍스트 관련 오류 감지');
    }
  }

  handleRestart = () => {
    // 오류 카운트가 3 이상인 경우 앱을 완전히 새로고침
    if (this.state.errorCount >= 3) {
      console.warn('🔄 ErrorBoundary 무한 루프 감지, 앱 완전 새로고침');
      // React Native에서는 앱 재시작을 직접할 수 없으므로 상태만 초기화
      this.setState({ 
        hasError: false, 
        error: null, 
        errorCount: 0, 
        lastErrorTime: 0 
      });
    } else {
      this.setState({ hasError: false, error: null });
    }
  };

  render() {
    if (this.state.hasError) {
      // 무한 루프 감지 시 더 간단한 fallback UI 표시
      if (this.state.errorCount >= 3) {
        return (
          <View style={styles.container}>
            <Text style={styles.criticalTitle}>심각한 오류 발생</Text>
            <Text style={styles.criticalMessage}>
              앱에서 반복적인 오류가 발생했습니다.{'\n'}
              앱을 완전히 종료 후 다시 실행해주세요.
            </Text>
            <Text style={styles.criticalSubMessage}>
              문제가 지속되면 앱을 재설치해주세요.
            </Text>
          </View>
        );
      }

      // 일반적인 오류 UI
      return (
        <View style={styles.container}>
          <Text style={styles.title}>앱 오류가 발생했습니다</Text>
          <Text style={styles.message}>
            {this.state.error?.message || '알 수 없는 오류가 발생했습니다.'}
          </Text>
          
          {/* 오류 횟수 표시 (개발 모드) */}
          {__DEV__ && (
            <Text style={styles.errorCountInfo}>
              오류 발생 횟수: {this.state.errorCount}/3
            </Text>
          )}
          
          {/* 🔧 개발 모드에서 더 자세한 정보 표시 */}
          {__DEV__ && this.state.error?.stack && (
            <Text style={styles.debugInfo}>
              디버그 정보: {this.state.error.stack.substring(0, 200)}...
            </Text>
          )}
          
          <TouchableOpacity style={styles.button} onPress={this.handleRestart}>
            <Text style={styles.buttonText}>
              {this.state.errorCount >= 2 ? '마지막 시도' : '다시 시도'}
            </Text>
          </TouchableOpacity>
          
          {/* 🔧 로그인 후 오류인 경우 추가 안내 */}
          {this.state.error?.message?.includes('getFCMToken') && (
            <Text style={styles.helpText}>
              알림 권한 문제일 수 있습니다. 설정에서 알림을 허용해주세요.
            </Text>
          )}

          {/* 반복 오류 경고 */}
          {this.state.errorCount >= 2 && (
            <Text style={styles.warningText}>
              ⚠️ 반복적인 오류가 발생하고 있습니다.{'\n'}
              한 번 더 오류가 발생하면 앱을 재시작해주세요.
            </Text>
          )}
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F2F2F7',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  debugInfo: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'monospace',
    backgroundColor: '#F0F0F0',
    padding: 10,
    borderRadius: 4,
  },
  helpText: {
    fontSize: 14,
    color: '#FF9500',
    textAlign: 'center',
    marginTop: 15,
    fontStyle: 'italic',
  },
  // 무한 루프 감지 시 표시할 스타일들
  criticalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FF0000',
    marginBottom: 15,
    textAlign: 'center',
  },
  criticalMessage: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
    fontWeight: '600',
  },
  criticalSubMessage: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  // 오류 횟수 표시 스타일
  errorCountInfo: {
    fontSize: 12,
    color: '#FF9500',
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: 'bold',
    backgroundColor: '#FFF3CD',
    padding: 5,
    borderRadius: 4,
  },
  // 반복 오류 경고 스타일
  warningText: {
    fontSize: 13,
    color: '#FF6B35',
    textAlign: 'center',
    marginTop: 15,
    lineHeight: 18,
    backgroundColor: '#FFF3CD',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFE066',
  },
});

export default ErrorBoundary;
