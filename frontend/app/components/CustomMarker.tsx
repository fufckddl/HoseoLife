import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
// import { Marker } from 'react-native-maps';
import { PostMarker, Cluster, getClusterColor, getClusterSize } from '../utils/clustering';

interface CustomMarkerProps {
  post: PostMarker;
  onPress: (post: PostMarker) => void;
}

interface ClusterMarkerProps {
  cluster: Cluster;
  onPress: (cluster: Cluster) => void;
}

// 개별 게시글 마커
export const CustomMarker: React.FC<CustomMarkerProps> = ({ post, onPress }) => {
  const getCategoryColor = (category: string) => {
    switch (category) {
      case '일상':
        return '#4CAF50';
      case '사람':
        return '#2196F3';
      case '질문':
        return '#FF9800';
      case '행사':
        return '#E91E63';
      default:
        return '#2D3A4A';
    }
  };

  // 게시글 개수에 따른 크기 계산 (최대 40px로 제한)
  const getMarkerSize = (count: number) => {
    const baseSize = 20;
    const maxSize = 40;
    const sizeIncrement = Math.min(count * 2, maxSize - baseSize);
    return baseSize + sizeIncrement;
  };

  // 개별 마커의 경우 comment_count를 사용하거나 기본값 1
  const markerCount = post.comment_count || 1;
  const markerSize = getMarkerSize(markerCount);

  return (
    <View style={styles.individualMarkerContainer}>
      <TouchableOpacity
        style={styles.individualMarkerContainer}
        onPress={() => onPress(post)}
      >
        <View style={[
          styles.individualMarkerDot,
          { 
            backgroundColor: getCategoryColor(post.category),
            width: markerSize,
            height: markerSize,
            borderRadius: markerSize / 2,
          }
        ]}>
          <Text style={[
            styles.individualMarkerText,
            { fontSize: markerSize * 0.4 }
          ]}>
            {markerCount}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

// 클러스터 마커
export const ClusterMarker: React.FC<ClusterMarkerProps> = ({ cluster, onPress }) => {
  const size = getClusterSize(cluster.count);
  const color = getClusterColor(cluster.count);

  return (
    <TouchableOpacity
      style={[
        styles.clusterMarker,
        {
          width: size,
          height: size,
          backgroundColor: color,
        },
      ]}
      onPress={() => onPress(cluster)}
    >
      <Text style={styles.clusterText}>{cluster.count}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // 개별 마커 스타일
  individualMarkerContainer: {
    alignItems: 'center',
  },
  individualMarkerDot: {
    width: 20,
    height: 20,
    backgroundColor: '#2D3A4A',
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  individualMarkerText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
  },

  // 클러스터 마커 스타일
  clusterMarker: {
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  clusterText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
}); 