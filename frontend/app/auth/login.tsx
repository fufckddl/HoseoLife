import * as React from 'react';
import { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';



const validateEmail = (email: string) => {
  return /\S+@\S+\.\S+/.test(email);
};

export default function LoginScreen() {
  const router = useRouter();
  const { login: authLogin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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
      Alert.alert('로그인 실패', error?.message || '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => router.push('/auth/register')}
      >
        <Text style={styles.backIcon}>{'<'}</Text>
      </TouchableOpacity>
      <Image source={require('../../assets/images/camsaw_Logo.png')} style={styles.logo} />
      <Text style={styles.title}>캠봤다</Text>
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
      <TextInput
        style={styles.input}
        placeholder="**********"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholderTextColor="#888"
      />
      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.6 }]}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.buttonText}>로그인</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 24 },
  backBtn: { position: 'absolute', top: 48, left: 16, zIndex: 10 },
  backIcon: { fontSize: 36, color: '#A9CBFA', fontWeight: 'bold' },
  logo: { width: 140, height: 140, marginBottom: 16, resizeMode: 'contain', marginTop: 32 },
  title: { fontSize: 36, fontWeight: 'bold', marginBottom: 32, color: '#222' },
  label: { fontSize: 15, color: '#6A7BA2', marginBottom: 8, alignSelf: 'flex-start', fontWeight: 'bold' },
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
}); 