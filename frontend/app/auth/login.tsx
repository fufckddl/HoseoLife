import * as React from 'react';
import { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, Image, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';



const validateEmail = (email: string) => {
  return /\S+@\S+\.\S+/.test(email);
};

export default function LoginScreen() {
  const router = useRouter();
  const { login: authLogin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!validateEmail(email)) {
      Alert.alert('이메일 형식이 올바르지 않습니다.');
      return;
    }
    
    setLoading(true);
    try {
      await authLogin(email, password);
      Alert.alert('로그인 성공!', '', [
        { text: '확인', onPress: () => router.push('/tabs/home') }
      ]);
    } catch (error: any) {
      // 민감한 서버/HTML 응답 숨김, 사용자에게는 단일 문구만 표시
      Alert.alert('로그인 실패', '로그인에 실패했습니다.');
    } finally {
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
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.push('/auth/register')}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Image source={require('../../assets/images/logo_hoseolife.png')} style={styles.logo} />
        <Text style={styles.title}>HoseoLife : 호서라이프</Text>
        <Text style={styles.label}>이메일</Text>
        <TextInput
          style={styles.input}
          placeholder="********@vision.hoseo.edu"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholderTextColor="#888"
        />
        <Text style={styles.label}>비밀번호</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="**********"
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
          style={[styles.button, loading && { opacity: 0.6 }]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>로그인</Text>
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
  backIcon: { fontSize: 36, color: '#A9CBFA', fontWeight: 'bold' },
  logo: { width: 140, height: 140, marginBottom: 16, resizeMode: 'contain', marginTop: 32 },
  title: { fontSize: 36, fontWeight: 'bold', marginBottom: 32, color: '#000000' },
  label: { fontSize: 15, color: '#000000', marginBottom: 8, alignSelf: 'flex-start', fontWeight: 'bold' },
  input: {
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
}); 