import * as React from 'react';
import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity, Image, Modal, Pressable, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const API_URL = 'https://hoseolife.kro.kr';
const SCHOOLS = [
  { label: '호서대학교 아산캠퍼스', value: 'hoseo_asan' },
  { label: '호서대학교 천안캠퍼스', value: 'hoseo_cheonan' },
];

export default function RegisterScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [school, setSchool] = useState('');
  const [schoolModal, setSchoolModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // 🆕 닉네임 유효성 검사 상태
  const [nicknameChecking, setNicknameChecking] = useState(false);
  const [nicknameValid, setNicknameValid] = useState<boolean | null>(null);
  const [nicknameMessage, setNicknameMessage] = useState('');
  
  // 🆕 이용약관 동의 상태
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);

  // 학교 이메일 형식 체크 함수
  const isValidSchoolEmail = (email: string) => {
    return /^\d{8}@vision\.hoseo\.edu$/.test(email);
  };

  // 🆕 닉네임 중복 체크 함수
  const checkNicknameAvailability = async (nicknameToCheck: string) => {
    if (!nicknameToCheck.trim()) {
      setNicknameValid(null);
      setNicknameMessage('');
      return;
    }

    // 기본 유효성 검사 (길이, 특수문자)
    if (nicknameToCheck.length < 2 || nicknameToCheck.length > 20) {
      setNicknameValid(false);
      setNicknameMessage('닉네임은 2-20자 사이여야 합니다.');
      return;
    }

    const koreanEnglishNumberRegex = /^[가-힣a-zA-Z0-9]+$/;
    if (!koreanEnglishNumberRegex.test(nicknameToCheck)) {
      setNicknameValid(false);
      setNicknameMessage('닉네임은 한글, 영문, 숫자만 사용 가능합니다.');
      return;
    }

    try {
      setNicknameChecking(true);
      console.log('🔍 닉네임 중복 체크:', nicknameToCheck);
      
      const response = await axios.get(`${API_URL}/users/check-nickname/${encodeURIComponent(nicknameToCheck)}`);
      const result = response.data;
      
      setNicknameValid(result.available);
      setNicknameMessage(result.message);
      
      console.log('✅ 닉네임 체크 결과:', result);
    } catch (error: any) {
      console.error('❌ 닉네임 체크 실패:', error);
      setNicknameValid(false);
      setNicknameMessage('닉네임 확인 중 오류가 발생했습니다.');
    } finally {
      setNicknameChecking(false);
    }
  };

  // 🆕 닉네임 입력 핸들러 (디바운싱 적용)
  const handleNicknameChange = (text: string) => {
    setNickname(text);
    setNicknameValid(null);
    setNicknameMessage('');
    
    // 디바운싱: 500ms 후에 중복 체크 실행
    if (nicknameTimeoutRef.current) {
      clearTimeout(nicknameTimeoutRef.current);
    }
    
    nicknameTimeoutRef.current = setTimeout(() => {
      checkNicknameAvailability(text);
    }, 500);
  };

  // 🆕 닉네임 체크 타이머 ref
  const nicknameTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // 🆕 컴포넌트 언마운트 시 타이머 정리
  React.useEffect(() => {
    return () => {
      if (nicknameTimeoutRef.current) {
        clearTimeout(nicknameTimeoutRef.current);
      }
    };
  }, []);

  // 이메일 인증코드 발송
  const sendCode = async () => {
    if (!school) {
      Alert.alert('학교를 선택해주세요.');
      return;
    }
    if (!isValidSchoolEmail(email)) {
      Alert.alert('올바른 학교 이메일을 입력해주세요.');
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API_URL}/email/send`, { email });
      Alert.alert('인증코드가 발송되었습니다.');
      setStep(2);
    } catch (e: any) {
      const msg = e?.response?.data?.detail;
      if (msg && (msg.includes('이미 가입된 이메일') || msg.includes('이미 계정이 존재'))) {
        Alert.alert('이미 계정이 존재합니다.');
      } else {
        Alert.alert('인증코드 발송 실패', msg || '오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  // 인증코드 확인
  const verifyCode = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_URL}/email/verify`, { email, code });
      Alert.alert('이메일 인증 완료!');
      setStep(3);
    } catch (e: any) {
      Alert.alert('인증 실패', e?.response?.data?.detail || '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 회원가입 요청
  const register = async () => {
    // 🔧 이용약관 동의 확인
    if (!agreedToTerms || !agreedToPrivacy) {
      Alert.alert('알림', '이용약관 및 개인정보 처리방침에 모두 동의해주세요.');
      return;
    }
    
    // 🔧 닉네임 유효성 최종 확인
    if (!nickname.trim()) {
      Alert.alert('닉네임을 입력해주세요.');
      return;
    }
    
    if (nicknameValid !== true) {
      Alert.alert('유효하지 않은 닉네임', nicknameMessage || '닉네임을 다시 확인해주세요.');
      return;
    }
    
    if (!password.trim()) {
      Alert.alert('비밀번호를 입력해주세요.');
      return;
    }
    
    if (password.length < 6) {
      Alert.alert('비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    setLoading(true);
    try {
      console.log('🚀 회원가입 요청:', { email, nickname, university: school });
      await axios.post(`${API_URL}/users/register`, { 
        email, 
        nickname, 
        password, 
        university: school 
      });
      
      Alert.alert('회원가입 완료!', '로그인 페이지로 이동합니다.', [
        { text: '확인', onPress: () => router.push('/auth/login') }
      ]);
    } catch (e: any) {
      console.error('❌ 회원가입 실패:', e);
      const errorMessage = e?.response?.data?.detail || '오류가 발생했습니다.';
      Alert.alert('회원가입 실패', errorMessage);
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
      {step === 1 && (
        <>
          <Image source={require('../../assets/images/logo_hoseolife.png')} style={styles.logo} />
          <Text style={styles.title}>HoseoLife : 호서라이프</Text>
          
          {/* 🆕 Step 1: 이용약관 동의 */}
          <Text style={styles.guide}>회원가입을 위해 약관에 동의해주세요.</Text>
          
          <View style={styles.termsContainer}>
            <TouchableOpacity 
              style={styles.checkboxRow}
              onPress={() => setAgreedToTerms(!agreedToTerms)}
            >
              <Ionicons 
                name={agreedToTerms ? "checkbox" : "square-outline"} 
                size={24} 
                color={agreedToTerms ? "#007AFF" : "#888"} 
              />
              <Text style={styles.checkboxText}>
                <Text style={styles.linkText} onPress={() => router.push('/pages/terms-of-service')}>
                  이용약관
                </Text>
                에 동의합니다 (필수)
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.checkboxRow}
              onPress={() => setAgreedToPrivacy(!agreedToPrivacy)}
            >
              <Ionicons 
                name={agreedToPrivacy ? "checkbox" : "square-outline"} 
                size={24} 
                color={agreedToPrivacy ? "#007AFF" : "#888"} 
              />
              <Text style={styles.checkboxText}>
                <Text style={styles.linkText} onPress={() => router.push('/pages/privacy-policy')}>
                  개인정보 처리방침
                </Text>
                에 동의합니다 (필수)
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* 학교 선택 입력란 */}
          <TouchableOpacity style={styles.schoolInput} onPress={() => setSchoolModal(true)}>
            <Text style={[styles.schoolInputText, !school && { color: '#888' }]}> {school ? SCHOOLS.find(s => s.value === school)?.label : '학교 선택하기'} </Text>
          </TouchableOpacity>
          <Text style={styles.guide}>학교 이메일을 입력해주세요.</Text>
          <TextInput
            style={styles.emailInput}
            placeholder="********@vision.hoseo.edu"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor="#888"
          />
          <TouchableOpacity
            style={[styles.button, (loading || !agreedToTerms || !agreedToPrivacy) && { opacity: 0.6 }]}
            onPress={sendCode}
            disabled={loading || !agreedToTerms || !agreedToPrivacy}
          >
            <Text style={styles.buttonText}>학교 인증하기</Text>
          </TouchableOpacity>
          {/* 학교 선택 모달 */}
          <Modal visible={schoolModal} transparent animationType="fade">
            <Pressable style={styles.modalBg} onPress={() => setSchoolModal(false)} />
            <View style={styles.modalSheet}>
              <FlatList
                data={SCHOOLS}
                keyExtractor={item => item.value}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.schoolOption}
                    onPress={() => {
                      setSchool(item.value);
                      setSchoolModal(false);
                    }}
                  >
                    <View style={styles.dot} />
                    <Text style={styles.schoolLabel}>{item.label}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </Modal>
        </>
      )}
      {step === 2 && (
        <>
          <Image source={require('../../assets/images/logo_hoseolife.png')} style={styles.logo} />
          <Text style={styles.title}>캠봤다</Text>
          <Text style={styles.guide}>인증번호를 입력해주세요.</Text>
          <TextInput
            style={styles.emailInput}
            placeholder="인증번호"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            placeholderTextColor="#888"
          />
          <TouchableOpacity
            style={[styles.button, loading && { opacity: 0.6 }]}
            onPress={verifyCode}
            disabled={loading}
          >
            <Text style={styles.buttonText}>인증하기</Text>
          </TouchableOpacity>
        </>
      )}
      {step === 3 && (
        <>
          <Image source={require('../../assets/images/logo_hoseolife.png')} style={styles.logo} />
          <Text style={styles.title}>HoseoLife : 호서라이프</Text>
          <Text style={styles.guide}>닉네임과 비밀번호를 설정해주세요.</Text>
          <Text style={styles.label}>닉네임</Text>
          <View style={styles.nicknameContainer}>
            <TextInput
              style={[
                styles.nicknameInput,
                nicknameValid === true && styles.validInput,
                nicknameValid === false && styles.invalidInput
              ]}
              placeholder="닉네임 (2-20자, 한글/영문/숫자)"
              value={nickname}
              onChangeText={handleNicknameChange}
              placeholderTextColor="#888"
              autoCapitalize="none"
            />
            
            {/* 🆕 유효성 검사 아이콘 */}
            <View style={styles.nicknameStatusContainer}>
              {nicknameChecking && (
                <ActivityIndicator size="small" color="#007AFF" />
              )}
              {!nicknameChecking && nicknameValid === true && (
                <Ionicons name="checkmark-circle" size={20} color="#34C759" />
              )}
              {!nicknameChecking && nicknameValid === false && (
                <Ionicons name="close-circle" size={20} color="#FF3B30" />
              )}
            </View>
          </View>
          
          {/* 🆕 닉네임 유효성 메시지 */}
          {nicknameMessage && (
            <Text style={[
              styles.nicknameMessage,
              nicknameValid === true ? styles.validMessage : styles.invalidMessage
            ]}>
              {nicknameMessage}
            </Text>
          )}
          <Text style={styles.label}>비밀번호</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="비밀번호"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholderTextColor="#888"
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons 
                name={showPassword ? "eye-off" : "eye"} 
                size={20} 
                color="#888" 
              />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            style={[
              styles.button, 
              (loading || nicknameValid !== true || !password.trim()) && { opacity: 0.6 }
            ]}
            onPress={register}
            disabled={loading || nicknameValid !== true || !password.trim()}
          >
            <Text style={styles.buttonText}>
              {loading ? '회원가입 중...' : '회원가입'}
            </Text>
          </TouchableOpacity>
        </>
      )}
      {/* 하단 로그인 이동 */}
      <TouchableOpacity onPress={() => router.push('/auth/login')} style={{ marginTop: 32, alignItems: 'center' }}>
        <Text style={{ color: '#000000', fontSize: 16 }}>이미 계정이 있으신가요? 로그인하기</Text>
      </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContainer: { 
    flexGrow: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 24,
    minHeight: '100%'
  },
  backBtn: { position: 'absolute', top: 48, left: 16, zIndex: 10 },
  logo: { width: 140, height: 140, marginBottom: 16, resizeMode: 'contain' },
  title: { fontSize: 36, fontWeight: 'bold', marginBottom: 32, color: '#000000' },
  guide: { fontSize: 15, color: '#000000', marginBottom: 12, alignSelf: 'flex-start' },
  schoolInput: {
    width: '100%',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 16,
    padding: 16,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#222',
  },
  schoolInputText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  modalBg: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  modalSheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  schoolOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  dot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: '#E5E7EB', marginRight: 16,
  },
  schoolLabel: {
    fontSize: 18, fontWeight: 'bold', color: '#000000',
  },
  emailInput: {
    width: '100%',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 16,
    padding: 16,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#000000',
  },
  passwordContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 16,
    marginBottom: 24,
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  eyeIcon: {
    padding: 16,
  },
  button: {
    width: '100%',
    backgroundColor: '#000000',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  label: { fontSize: 16, marginBottom: 8, alignSelf: 'flex-start', color: '#000000' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 12, marginBottom: 16, width: '100%' },
  
  // 🆕 닉네임 관련 스타일들
  nicknameContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 16,
    marginBottom: 8,
  },
  nicknameInput: {
    flex: 1,
    padding: 16,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  validInput: {
    borderColor: '#34C759',
  },
  invalidInput: {
    borderColor: '#FF3B30',
  },
  nicknameStatusContainer: {
    paddingRight: 16,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nicknameMessage: {
    fontSize: 14,
    marginBottom: 16,
    alignSelf: 'flex-start',
    fontWeight: '500',
  },
  validMessage: {
    color: '#34C759',
  },
  invalidMessage: {
    color: '#FF3B30',
  },
  
  // 🆕 이용약관 관련 스타일들
  termsContainer: {
    width: '100%',
    marginBottom: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkboxText: {
    fontSize: 14,
    color: '#000',
    marginLeft: 8,
    flex: 1,
  },
  linkText: {
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
}); 