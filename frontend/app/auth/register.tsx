import * as React from 'react';
import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity, Image, Modal, Pressable, FlatList } from 'react-native';
import axios from 'axios';
import { useRouter } from 'expo-router';

const API_URL = 'http://your-server-ip:5000';
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

  // 학교 이메일 형식 체크 함수
  const isValidSchoolEmail = (email: string) => {
    return /^\d{8}@vision\.hoseo\.edu$/.test(email);
  };

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
    setLoading(true);
    try {
      await axios.post(`${API_URL}/users/register`, { email, nickname, password, university: school });
      Alert.alert('회원가입 완료!', '', [
        { text: '확인', onPress: () => router.push('/auth/login') }
      ]);
    } catch (e: any) {
      Alert.alert('회원가입 실패', e?.response?.data?.detail || '오류가 발생했습니다.');
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {step === 1 && (
        <>
          <Image source={require('../../assets/images/camsaw_Logo.png')} style={styles.logo} />
          <Text style={styles.title}>캠봤다</Text>
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
            style={[styles.button, loading && { opacity: 0.6 }]}
            onPress={sendCode}
            disabled={loading}
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
          <Image source={require('../../assets/images/camsaw_Logo.png')} style={styles.logo} />
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
          <Image source={require('../../assets/images/camsaw_Logo.png')} style={styles.logo} />
          <Text style={styles.title}>캠봤다</Text>
          <Text style={styles.guide}>닉네임과 비밀번호를 설정해주세요.</Text>
          <Text style={styles.label}>닉네임</Text>
          <TextInput
            style={styles.emailInput}
            placeholder="닉네임"
            value={nickname}
            onChangeText={setNickname}
            placeholderTextColor="#888"
          />
          <Text style={styles.label}>비밀번호</Text>
          <TextInput
            style={styles.emailInput}
            placeholder="비밀번호"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor="#888"
          />
          <TouchableOpacity
            style={[styles.button, loading && { opacity: 0.6 }]}
            onPress={register}
            disabled={loading}
          >
            <Text style={styles.buttonText}>회원가입</Text>
          </TouchableOpacity>
        </>
      )}
      {/* 하단 로그인 이동 */}
      <TouchableOpacity onPress={() => router.push('/auth/login')} style={{ marginTop: 32, alignItems: 'center' }}>
        <Text style={{ color: '#007AFF', fontSize: 16 }}>이미 계정이 있으신가요? 로그인하기</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 24 },
  logo: { width: 140, height: 140, marginBottom: 16, resizeMode: 'contain' },
  title: { fontSize: 36, fontWeight: 'bold', marginBottom: 32, color: '#222' },
  guide: { fontSize: 15, color: '#6A7BA2', marginBottom: 12, alignSelf: 'flex-start' },
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
    color: '#222',
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
    fontSize: 18, fontWeight: 'bold', color: '#222',
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
    color: '#222',
  },
  button: {
    width: '100%',
    backgroundColor: '#A9CBFA',
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
  label: { fontSize: 16, marginBottom: 8, alignSelf: 'flex-start' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 12, marginBottom: 16, width: '100%' },
}); 