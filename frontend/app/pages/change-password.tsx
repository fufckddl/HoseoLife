import * as React from 'react';
import { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  Alert, 
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { userService } from '../services/userService';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<{
    score: number;
    label: string;
    color: string;
    description: string;
  }>({ score: 0, label: '', color: '#E0E0E0', description: '' });

  const calculatePasswordStrength = (password: string) => {
    let score = 0;
    let description = '';

    // 길이 체크
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    
    // 문자 종류 체크
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    // 연속된 문자나 반복된 문자 체크 (점수 감점)
    if (/(.)\1{2,}/.test(password)) score -= 1; // 3개 이상 반복
    if (/abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i.test(password)) score -= 1;
    if (/123|234|345|456|567|678|789|890|012/i.test(password)) score -= 1;

    // 최소 점수 보장
    score = Math.max(0, Math.min(5, score));

    let label, color;
    switch (score) {
      case 0:
      case 1:
        label = '매우 약함';
        color = '#FF4444';
        description = '비밀번호가 너무 약합니다. 더 복잡하게 만들어주세요.';
        break;
      case 2:
        label = '약함';
        color = '#FF8800';
        description = '비밀번호가 약합니다. 영문, 숫자, 특수문자를 추가해주세요.';
        break;
      case 3:
        label = '보통';
        color = '#FFCC00';
        description = '비밀번호가 보통입니다. 더 강화할 수 있습니다.';
        break;
      case 4:
        label = '강함';
        color = '#00CC00';
        description = '비밀번호가 강합니다.';
        break;
      case 5:
        label = '매우 강함';
        color = '#008800';
        description = '비밀번호가 매우 강합니다!';
        break;
      default:
        label = '';
        color = '#E0E0E0';
        description = '';
    }

    return { score, label, color, description };
  };

  const validatePassword = (password: string) => {
    // 최소 8자, 영문/숫자/특수문자 조합
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  };

  const handleSubmit = async () => {
    // 입력 검증
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      Alert.alert('입력 오류', '모든 필드를 입력해주세요.');
      return;
    }

    if (passwordStrength.score < 3) {
      Alert.alert(
        '비밀번호 강도 부족', 
        '비밀번호가 너무 약합니다.\n더 강한 비밀번호를 사용해주세요.'
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('비밀번호 불일치', '새 비밀번호와 확인 비밀번호가 일치하지 않습니다.');
      return;
    }

    if (currentPassword === newPassword) {
      Alert.alert('비밀번호 오류', '새 비밀번호는 현재 비밀번호와 달라야 합니다.');
      return;
    }

    setLoading(true);
    try {
      // 실제 API 호출
      await userService.changePassword(currentPassword, newPassword);
      
      Alert.alert(
        '비밀번호 변경 완료',
        '비밀번호가 성공적으로 변경되었습니다.',
        [
          {
            text: '확인',
            onPress: () => router.back()
          }
        ]
      );
    } catch (error) {
      console.error('비밀번호 변경 실패:', error);
      const errorMessage = error instanceof Error ? error.message : '비밀번호 변경에 실패했습니다.';
      Alert.alert('오류', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = (type: 'current' | 'new' | 'confirm') => {
    switch (type) {
      case 'current':
        setShowCurrentPassword(!showCurrentPassword);
        break;
      case 'new':
        setShowNewPassword(!showNewPassword);
        break;
      case 'confirm':
        setShowConfirmPassword(!showConfirmPassword);
        break;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 상단 바 */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>비밀번호 변경</Text>
        <View style={styles.placeholder} />
      </View>

      {/* 메인 콘텐츠 */}
      <KeyboardAvoidingView 
        style={styles.content} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* 안내 메시지 */}
          <View style={styles.infoContainer}>
            <Text style={styles.infoTitle}>안전한 비밀번호로 변경하세요</Text>
            <Text style={styles.infoText}>
              • 최소 8자 이상{'\n'}
              • 영문, 숫자, 특수문자 조합{'\n'}
              • 현재 비밀번호와 다른 비밀번호
            </Text>
          </View>

          {/* 비밀번호 변경 폼 */}
          <View style={styles.formContainer}>
            {/* 현재 비밀번호 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>현재 비밀번호 *</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="현재 비밀번호를 입력하세요"
                  placeholderTextColor="#999999"
                  secureTextEntry={!showCurrentPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity 
                  style={styles.eyeButton}
                  onPress={() => togglePasswordVisibility('current')}
                >
                  <Text style={styles.eyeIcon}>
                    {showCurrentPassword ? '👁️' : '👁️‍🗨️'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 새 비밀번호 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>새 비밀번호 *</Text>
              <View style={styles.passwordContainer}>
                                 <TextInput
                   style={styles.passwordInput}
                   value={newPassword}
                   onChangeText={(text) => {
                     setNewPassword(text);
                     setPasswordStrength(calculatePasswordStrength(text));
                   }}
                   placeholder="새 비밀번호를 입력하세요"
                   placeholderTextColor="#999999"
                   secureTextEntry={!showNewPassword}
                   autoCapitalize="none"
                 />
                <TouchableOpacity 
                  style={styles.eyeButton}
                  onPress={() => togglePasswordVisibility('new')}
                >
                  <Text style={styles.eyeIcon}>
                    {showNewPassword ? '👁️' : '👁️‍🗨️'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 비밀번호 강도 표시 */}
            {newPassword && (
              <View style={styles.strengthContainer}>
                <Text style={styles.strengthLabel}>비밀번호 강도:</Text>
                <View style={styles.strengthBar}>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <View
                      key={level}
                      style={[
                        styles.strengthSegment,
                        {
                          backgroundColor: passwordStrength.score >= level ? passwordStrength.color : '#E0E0E0'
                        }
                      ]}
                    />
                  ))}
                </View>
                <Text style={[styles.strengthText, { color: passwordStrength.color }]}>
                  {passwordStrength.label}
                </Text>
                {passwordStrength.description && (
                  <Text style={styles.strengthDescription}>
                    {passwordStrength.description}
                  </Text>
                )}
              </View>
            )}

            {/* 새 비밀번호 확인 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>새 비밀번호 확인 *</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="새 비밀번호를 다시 입력하세요"
                  placeholderTextColor="#999999"
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity 
                  style={styles.eyeButton}
                  onPress={() => togglePasswordVisibility('confirm')}
                >
                  <Text style={styles.eyeIcon}>
                    {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 비밀번호 일치 여부 표시 */}
            {newPassword && confirmPassword && (
              <View style={styles.matchIndicator}>
                <Text style={[
                  styles.matchText,
                  { color: newPassword === confirmPassword ? '#4CAF50' : '#F44336' }
                ]}>
                  {newPassword === confirmPassword ? '✓ 비밀번호가 일치합니다' : '✗ 비밀번호가 일치하지 않습니다'}
                </Text>
              </View>
            )}
          </View>

          {/* 변경 버튼 */}
          <TouchableOpacity 
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? '변경 중...' : '비밀번호 변경'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2D3A4A',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2D3A4A',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    padding: 8,
  },
  backIcon: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'GmarketSans',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  infoContainer: {
    backgroundColor: '#F5F5F5',
    margin: 20,
    padding: 20,
    borderRadius: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 12,
    fontFamily: 'GmarketSans',
  },
  infoText: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    fontFamily: 'GmarketSans',
  },
  formContainer: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
    fontFamily: 'GmarketSans',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333333',
    fontFamily: 'GmarketSans',
  },
  eyeButton: {
    padding: 12,
  },
  eyeIcon: {
    fontSize: 20,
  },
  matchIndicator: {
    marginTop: 8,
    paddingHorizontal: 16,
  },
  matchText: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'GmarketSans',
  },
  strengthContainer: {
    marginTop: 16,
    marginBottom: 20,
  },
  strengthLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
    fontFamily: 'GmarketSans',
  },
  strengthBar: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  strengthSegment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  strengthText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
    fontFamily: 'GmarketSans',
  },
  strengthDescription: {
    fontSize: 12,
    color: '#666666',
    fontFamily: 'GmarketSans',
  },
  submitButton: {
    backgroundColor: '#2D3A4A',
    marginHorizontal: 20,
    marginBottom: 30,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#999999',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
}); 