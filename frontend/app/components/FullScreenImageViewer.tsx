import React from 'react';
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Text,
  Dimensions,
  ScrollView,
  StatusBar,
} from 'react-native';

interface FullScreenImageViewerProps {
  visible: boolean;
  images: string[];
  initialIndex: number;
  onClose: () => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const FullScreenImageViewer: React.FC<FullScreenImageViewerProps> = ({
  visible,
  images,
  initialIndex,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = React.useState(initialIndex);

  React.useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      
      {/* 상단 닫기 버튼 */}
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeButtonText}>✕</Text>
      </TouchableOpacity>

      {/* 이미지 인디케이터 */}
      {images.length > 1 && (
        <View style={styles.indicatorContainer}>
          <Text style={styles.indicatorText}>
            {currentIndex + 1} / {images.length}
          </Text>
        </View>
      )}

      {/* 이미지 스크롤 뷰 */}
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const newIndex = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
          setCurrentIndex(newIndex);
        }}
        style={styles.scrollView}
      >
        {images.map((imageUrl, index) => (
          <View key={index} style={styles.imageContainer}>
            <Image
              source={{ uri: imageUrl }}
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          </View>
        ))}
      </ScrollView>

      {/* 하단 닫기 버튼 */}
      <TouchableOpacity style={styles.bottomCloseButton} onPress={onClose}>
        <Text style={styles.bottomCloseButtonText}>닫기</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    zIndex: 1000,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1001,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  indicatorContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    zIndex: 1001,
  },
  indicatorText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    width: screenWidth,
    height: screenHeight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: screenWidth,
    height: screenHeight,
  },
  bottomCloseButton: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: 'center',
    zIndex: 1001,
  },
  bottomCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
}); 