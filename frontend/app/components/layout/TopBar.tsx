import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface TopBarProps {
  title?: string;
  showBackButton?: boolean;
  showRefreshButton?: boolean;
  showSearchButton?: boolean;
  showLogo?: boolean; // 🆕 로고 표시 여부
  onBackPress?: () => void;
  onRefreshPress?: () => void;
  onSearchPress?: () => void;
  rightIcon?: string;
  onRightIconPress?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  title,
  showBackButton = false,
  showRefreshButton = false,
  showSearchButton = false,
  showLogo = true, // 🆕 기본값은 true (기존 동작 유지)
  onBackPress,
  onRefreshPress,
  onSearchPress,
  rightIcon,
  onRightIconPress,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  const handleRefreshPress = () => {
    if (onRefreshPress) {
      onRefreshPress();
    }
  };

  const handleSearchPress = () => {
    if (onSearchPress) {
      onSearchPress();
    } else {
      router.push('/pages/search');
    }
  };

  const handleRightIconPress = () => {
    if (onRightIconPress) {
      onRightIconPress();
    }
  };

  return (
    <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
      {/* 왼쪽: 뒤로가기 버튼 또는 로고 */}
      <View style={styles.leftContainer}>
        {showBackButton ? (
          <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
            <Ionicons name="arrow-back" size={24} color="#000000" />
          </TouchableOpacity>
        ) : showLogo ? (
          <View style={styles.logoContainer}>
            <Image 
              source={require('../../../assets/images/logo_hoseolife.png')} 
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        ) : (
          <View style={styles.emptyContainer} />
        )}
      </View>

      {/* 가운데: 타이틀 - flex로 중앙 정렬 */}
      <View style={styles.titleContainer}>
        {title && <Text style={styles.titleText} numberOfLines={1} ellipsizeMode="tail">{title}</Text>}
      </View>

      {/* 오른쪽: 버튼들 */}
      <View style={styles.rightContainer}>
        <View style={styles.rightButtonsContainer}>
          {showSearchButton && (
            <TouchableOpacity style={styles.iconButton} onPress={handleSearchPress}>
              <Ionicons name="search" size={24} color="#000000" />
            </TouchableOpacity>
          )}
          {showRefreshButton && (
            <TouchableOpacity style={styles.iconButton} onPress={handleRefreshPress}>
              <Ionicons name="refresh" size={24} color="#000000" />
            </TouchableOpacity>
          )}
          {rightIcon && (
            <TouchableOpacity style={styles.iconButton} onPress={handleRightIconPress}>
              <Ionicons name={rightIcon as any} size={24} color="#000000" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    minHeight: 44, // 최소 높이 보장
  },
  leftContainer: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0, // 축소 방지
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: 32,
    height: 32,
  },
  emptyContainer: {
    width: 44,
    height: 44,
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8, // 좌우 여백 추가
  },
  titleText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'GmarketSans',
    textAlign: 'center',
    maxWidth: '100%', // 최대 너비 제한
  },
  rightContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0, // 축소 방지
    minWidth: 44, // 최소 너비 보장
  },
  rightButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
