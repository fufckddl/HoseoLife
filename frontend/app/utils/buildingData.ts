import { buildingService, Building } from '../services/buildingService';

// 기존 Building 인터페이스는 buildingService에서 import
export type { Building } from '../services/buildingService';

// 기존 LocationCoords 타입 정의
export interface LocationCoords {
  latitude: number;
  longitude: number;
}

// 건물 데이터를 동적으로 가져오는 함수들
let cachedBuildings: Building[] = [];
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5분 캐시

/**
 * 건물 데이터를 가져오는 함수 (캐시 적용)
 */
export async function getBuildings(): Promise<Building[]> {
  const now = Date.now();
  
  // 캐시가 유효한 경우 캐시된 데이터 반환
  if (cachedBuildings.length > 0 && (now - lastFetchTime) < CACHE_DURATION) {
    return cachedBuildings;
  }
  
  try {
    // API에서 건물 데이터 가져오기
    const apiBuildings = await buildingService.getAllBuildings();
    // 하드코딩된 건물과 API 건물 병합
    const allBuildings = [...hoseoBuildings, ...apiBuildings];
    
    // 중복 ID 제거 (나중에 온 것 우선)
    const uniqueBuildings = Array.from(
      new Map(allBuildings.map(b => [b.id, b])).values()
    );
    
    cachedBuildings = uniqueBuildings;
    lastFetchTime = now;
    return uniqueBuildings;
  } catch (error) {
    console.error('건물 데이터 가져오기 실패:', error);
    // API 실패 시에도 하드코딩된 건물은 반환
    return hoseoBuildings;
  }
}

/**
 * 캠퍼스별 건물 데이터를 가져오는 함수
 */
export async function getBuildingsByCampus(campus: 'asan' | 'cheonan'): Promise<Building[]> {
  try {
    return await buildingService.getBuildingsByCampus(campus);
  } catch (error) {
    console.error(`${campus} 캠퍼스 건물 데이터 가져오기 실패:`, error);
    return [];
  }
}

/**
 * 특정 건물 데이터를 가져오는 함수
 */
export async function getBuilding(campus: 'asan' | 'cheonan', buildingId: string): Promise<Building | null> {
  try {
    return await buildingService.getBuilding(campus, buildingId);
  } catch (error) {
    console.error(`건물 데이터 가져오기 실패:`, error);
    return null;
  }
}

/**
 * 캐시 무효화 함수
 */
export function invalidateBuildingCache(): void {
  cachedBuildings = [];
  lastFetchTime = 0;
}

// 기존 유틸리티 함수들은 그대로 유지
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // 지구 반지름 (미터)
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function isPointInRectangle(
  point: LocationCoords,
  rectangle: LocationCoords[]
): boolean {
  if (rectangle.length !== 4) return false;
  
  const { latitude, longitude } = point;
  const [p1, p2, p3, p4] = rectangle;
  
  // 사각형의 경계 확인
  const minLat = Math.min(p1.latitude, p2.latitude, p3.latitude, p4.latitude);
  const maxLat = Math.max(p1.latitude, p2.latitude, p3.latitude, p4.latitude);
  const minLon = Math.min(p1.longitude, p2.longitude, p3.longitude, p4.longitude);
  const maxLon = Math.max(p1.longitude, p2.longitude, p3.longitude, p4.longitude);
  
  return latitude >= minLat && latitude <= maxLat && 
         longitude >= minLon && longitude <= maxLon;
}

export function isPointInPolygon(
  point: LocationCoords,
  polygon: LocationCoords[]
): boolean {
  if (polygon.length < 3) return false;
  
  const { latitude, longitude } = point;
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].longitude;
    const yi = polygon[i].latitude;
    const xj = polygon[j].longitude;
    const yj = polygon[j].latitude;
    
    if (((yi > latitude) !== (yj > latitude)) &&
        (longitude < (xj - xi) * (latitude - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

export async function findBuildingAtLocation(latitude: number, longitude: number): Promise<Building | null> {
  try {
    const buildings = await getBuildings();
    
    // 하드코딩된 건물과 API 건물 병합
    const allBuildings = [...hoseoBuildings, ...buildings];
    
    for (const building of allBuildings) {
      if (building.building_type === 'rectangle') {
        if (isPointInRectangle({ latitude, longitude }, building.coordinates)) {
          return building;
        }
      } else if (building.building_type === 'polygon') {
        if (isPointInPolygon({ latitude, longitude }, building.coordinates)) {
          return building;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('위치 기반 건물 찾기 실패:', error);
    return null;
  }
}

export async function isWithinHoseoCampus(latitude: number, longitude: number): Promise<boolean> {
  try {
    const buildings = await getBuildings();
    
    // 하드코딩된 건물과 API 건물 병합
    const allBuildings = [...hoseoBuildings, ...buildings];
    
    // 모든 건물의 반지름 내에 있는지 확인
    for (const building of allBuildings) {
      const distance = calculateDistance(latitude, longitude, building.latitude, building.longitude);
      if (distance <= building.radius) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('캠퍼스 내 위치 확인 실패:', error);
    return false;
  }
}

// 기존 정적 데이터는 하위 호환성을 위해 유지 (점진적 제거 예정)
export const hoseoBuildings: Building[] = [
  {
    id: "hardcoded-custom-location-1",
    name: "커스텀 위치",
    description: "사용자 지정 위치 영역",
    campus: "cheonan",
    latitude: 36.741242,
    longitude: 127.074263,
    building_type: "rectangle",
    coordinates: [
      { latitude: 36.741242, longitude: 127.074263 },
      { latitude: 36.741425, longitude: 127.074691 },
      { latitude: 36.741159, longitude: 127.075026 },
      { latitude: 36.740936, longitude: 127.074534 }
    ],
    radius: 50,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

// 초기 데이터 로드
export async function initializeBuildingData(): Promise<void> {
  try {
    const buildings = await getBuildings();
    hoseoBuildings.length = 0; // 배열 초기화
    hoseoBuildings.push(...buildings);
  } catch (error) {
    console.error('건물 데이터 초기화 실패:', error);
  }
}

// 앱 시작 시 자동으로 데이터 로드
initializeBuildingData(); 