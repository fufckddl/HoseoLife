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
    <View style={[styles.topBar, { paddingTop: insets.top + 15 }]}>
      {/* 왼쪽: 뒤로가기 버튼 또는 로고 */}
      <View style={styles.leftContainer}>
        {showBackButton ? (
          <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
            <Ionicons name="arrow-back" size={24} color="#000000" />
          </TouchableOpacity>
        ) : (
          <View style={styles.logoContainer}>
            <Image 
              source={require('../../../assets/images/hoseolife_logo.png')} 
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        )}
      </View>

      {/* 가운데: 타이틀 */}
      <View style={styles.titleContainer}>
        {title && <Text style={styles.titleText}>{title}</Text>}
      </View>

      {/* 오른쪽: 버튼들 */}
      <View style={styles.rightContainer}>
        <View style={styles.rightButtonsContainer}>
          {showSearchButton && (
            <TouchableOpacity style={styles.searchButton} onPress={handleSearchPress}>
              <Ionicons name="search" size={24} color="#000000" />
            </TouchableOpacity>
          )}
          {showRefreshButton && (
            <TouchableOpacity style={styles.refreshButton} onPress={handleRefreshPress}>
              <Ionicons name="refresh" size={24} color="#000000" />
            </TouchableOpacity>
          )}
          {rightIcon && (
            <TouchableOpacity style={styles.rightIconButton} onPress={handleRightIconPress}>
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
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  leftContainer: {
    width: 60,
    height: 50,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backButton: {
    padding: 5,
  },
  logoContainer: {
    width: 60,
    height: 50,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  logoImage: {
    width: 40,
    height: 40,
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: 50,
    marginLeft: 20,
  },
  titleText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'GmarketSans',
  },
  rightContainer: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  rightButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshButton: {
    padding: 5,
    marginLeft: 8,
  },
  searchButton: {
    padding: 5,
    marginLeft: 8,
  },
  rightIconButton: {
    padding: 5,
    marginLeft: 8,
  },
  placeholder: {
    width: 34,
  },
});
