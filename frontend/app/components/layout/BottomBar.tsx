import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface BottomBarProps {
  activeTab?: 'posts' | 'location' | 'home' | 'chat' | 'profile';
  showFloatingButton?: boolean;
  floatingButtonIcon?: string;
  onFloatingButtonPress?: () => void;
}

export const BottomBar: React.FC<BottomBarProps> = ({
  activeTab,
  showFloatingButton = false,
  floatingButtonIcon = 'add',
  onFloatingButtonPress,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleFloatingButtonPress = () => {
    if (onFloatingButtonPress) {
      onFloatingButtonPress();
    } else {
      router.push('/pages/create-post');
    }
  };

  return (
    <View style={styles.container}>
      {/* 플로팅 액션 버튼 */}
      {showFloatingButton && (
        <TouchableOpacity 
          style={styles.floatingButton} 
          onPress={handleFloatingButtonPress}
        >
          <Ionicons name={floatingButtonIcon as any} size={25}/>
        </TouchableOpacity>
      )}
      
      {/* 하단 바 */}
      <View style={[styles.bottomBar, { paddingBottom: 10 + insets.bottom }]}>
        <TouchableOpacity 
          style={styles.bottomIcon} 
          onPress={() => {
            if (activeTab !== 'posts') {
              router.push('/tabs/post-list');
            }
          }}
        >
          <Ionicons 
            name="list" 
            size={25} 
            color={activeTab === 'posts' ? '#2D3A4A' : '#000000'}
          />
          <Text style={[
            styles.bottomIconText,
            activeTab === 'posts' && styles.activeBottomIconText
          ]}>
            게시글
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.bottomIcon} 
          onPress={() => {
            if (activeTab !== 'location') {
              router.push('/tabs/location');
            }
          }}
        >
          <Ionicons 
            name="location" 
            size={25} 
            color={activeTab === 'location' ? '#2D3A4A' : '#000000'}
          />
          <Text style={[
            styles.bottomIconText,
            activeTab === 'location' && styles.activeBottomIconText
          ]}>
            위치
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.bottomIcon} 
          onPress={() => {
            if (activeTab !== 'home') {
              router.push('/tabs/home');
            }
          }}
        >
          <Ionicons 
            name="home" 
            size={25} 
            color={activeTab === 'home' ? '#2D3A4A' : '#000000'}
          />
          <Text style={[
            styles.bottomIconText,
            activeTab === 'home' && styles.activeBottomIconText
          ]}>
            홈
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.bottomIcon} 
          onPress={() => {
            if (activeTab !== 'chat') {
              router.push('/pages/my-chats');
            }
          }}
        >
          <Ionicons 
            name="chatbox" 
            size={25} 
            color={activeTab === 'chat' ? '#2D3A4A' : '#000000'}
          />
          <Text style={[
            styles.bottomIconText,
            activeTab === 'chat' && styles.activeBottomIconText
          ]}>
            채팅
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.bottomIcon} 
          onPress={() => {
            if (activeTab !== 'profile') {
              router.push('/tabs/profile');
            }
          }}
        >
          <Ionicons 
            name="person" 
            size={25} 
            color={activeTab === 'profile' ? '#2D3A4A' : '#000000'}
          />
          <Text style={[
            styles.bottomIconText,
            activeTab === 'profile' && styles.activeBottomIconText
          ]}>
            프로필
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'space-between',
    color: '#000000',
  },
  bottomIcon: { 
    flex: 1,
    alignItems: 'center', 
    justifyContent: 'center',
    paddingVertical: 5,
  },
  bottomIconText: {
    fontSize: 10,
    color: '#000000',
    marginTop: 2,
    fontWeight: '500',
  },
  activeBottomIconText: {
    color: '#2D3A4A',
    fontWeight: 'bold',
  },
  floatingButton: {
    position: 'absolute',
    bottom: 110,
    left: 20,
    width: 55,
    height: 55,
    borderRadius: 30,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1,
  },
});
