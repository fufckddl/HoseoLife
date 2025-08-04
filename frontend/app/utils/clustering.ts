export interface PostMarker {
  id: number;
  latitude: number;
  longitude: number;
  title: string;
  category: string;
  building_name?: string;
  author_nickname: string;
  created_at: string;
  view_count?: number;
  heart_count?: number;
  comment_count?: number;
}

export interface Cluster {
  latitude: number;
  longitude: number;
  posts: PostMarker[];
  count: number;
}

export interface ClusteredMarkers {
  clusters: Cluster[];
  individualMarkers: PostMarker[];
}

/**
 * 지도 마커를 클러스터링하는 함수
 * @param posts 게시글 목록
 * @param zoomLevel 현재 줌 레벨
 * @param clusterRadius 클러스터링 반경 (픽셀 단위)
 * @returns 클러스터링된 마커들
 */
export function clusterMarkers(
  posts: PostMarker[],
  zoomLevel: number = 15,
  clusterRadius: number = 50
): ClusteredMarkers {
  if (posts.length === 0) {
    return { clusters: [], individualMarkers: [] };
  }

  // 줌 레벨에 따른 클러스터링 반경 조정
  const adjustedRadius = clusterRadius / Math.pow(2, zoomLevel - 10);
  
  const clusters: Cluster[] = [];
  const usedPosts = new Set<number>();

  // 각 게시글에 대해 클러스터 찾기 또는 새 클러스터 생성
  posts.forEach(post => {
    if (usedPosts.has(post.id)) return;

    // 기존 클러스터 중에서 가까운 클러스터 찾기
    let foundCluster = false;
    for (const cluster of clusters) {
      const distance = calculateDistance(
        cluster.latitude,
        cluster.longitude,
        post.latitude,
        post.longitude
      );

      if (distance <= adjustedRadius) {
        // 기존 클러스터에 추가
        cluster.posts.push(post);
        cluster.count++;
        usedPosts.add(post.id);
        foundCluster = true;
        break;
      }
    }

    // 가까운 클러스터가 없으면 새 클러스터 생성
    if (!foundCluster) {
      clusters.push({
        latitude: post.latitude,
        longitude: post.longitude,
        posts: [post],
        count: 1
      });
      usedPosts.add(post.id);
    }
  });

  // 클러스터가 1개인 경우 개별 마커로 처리
  const individualMarkers: PostMarker[] = [];
  const finalClusters: Cluster[] = [];

  clusters.forEach(cluster => {
    if (cluster.count === 1) {
      individualMarkers.push(cluster.posts[0]);
    } else {
      // 클러스터 중심점 계산
      const centerLat = cluster.posts.reduce((sum, post) => sum + post.latitude, 0) / cluster.count;
      const centerLng = cluster.posts.reduce((sum, post) => sum + post.longitude, 0) / cluster.count;
      
      finalClusters.push({
        latitude: centerLat,
        longitude: centerLng,
        posts: cluster.posts,
        count: cluster.count
      });
    }
  });

  return {
    clusters: finalClusters,
    individualMarkers
  };
}

/**
 * 두 지점 간의 거리를 계산하는 함수 (미터 단위)
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3; // 지구 반지름 (미터)
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * 클러스터 색상을 결정하는 함수
 */
export function getClusterColor(count: number): string {
  return '#2D3A4A'; // 모든 클러스터에 동일한 색상 적용
}

/**
 * 클러스터 크기를 결정하는 함수
 */
export function getClusterSize(count: number): number {
  if (count >= 10) return 60;
  if (count >= 5) return 55;
  if (count >= 3) return 50;
  return 45;
} 