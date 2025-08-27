import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useError } from '../contexts/ErrorContext';

export default function ErrorPage() {
  const router = useRouter();
  const { lastError, clearError } = useError();

  const message = lastError?.message || '오류가 발생했습니다';
  const detail = lastError?.detail;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>문제가 발생했어요</Text>
      <Text style={styles.message}>{message}</Text>

      {detail ? (
        <ScrollView style={styles.detailBox}>
          <Text style={styles.detailText}>{safeStringify(detail)}</Text>
        </ScrollView>
      ) : null}

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => {
          clearError();
          router.back();
        }}
      >
        <Text style={styles.primaryText}>돌아가기</Text>
      </TouchableOpacity>
    </View>
  );
}

function safeStringify(v: unknown) {
  try {
    return typeof v === 'string' ? v : JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FF3B30',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  detailBox: {
    maxHeight: 260,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  detailText: {
    color: '#666',
    fontFamily: 'Courier',
    fontSize: 12,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});


