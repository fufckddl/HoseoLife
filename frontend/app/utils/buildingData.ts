export interface Building {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number; // 각 건물의 반경 (미터 단위)
  polygon?: { latitude: number; longitude: number }[]; // 다각형 형태의 건물을 위한 좌표 배열
  rectangle?: { latitude: number; longitude: number }[]; // 사각형 형태의 건물을 위한 4개 좌표 배열
  description?: string;
}

// Point-in-Polygon 알고리즘 (Ray Casting Algorithm)
export const isPointInPolygon = (
  point: { latitude: number; longitude: number },
  polygon: { latitude: number; longitude: number }[]
): boolean => {
  const { latitude: lat, longitude: lng } = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const { latitude: lati, longitude: lngi } = polygon[i];
    const { latitude: latj, longitude: lngj } = polygon[j];

    if (((lati > lat) !== (latj > lat)) && 
        (lng < (lngj - lngi) * (lat - lati) / (latj - lati) + lngi)) {
      inside = !inside;
    }
  }

  return inside;
};

// Point-in-Rectangle 알고리즘 (사각형 내부 판단)
export const isPointInRectangle = (
  point: { latitude: number; longitude: number },
  rectangle: { latitude: number; longitude: number }[]
): boolean => {
  if (rectangle.length !== 4) {
    return false; // 사각형은 정확히 4개의 점이 필요
  }

  // 사각형을 다각형으로 변환해서 Point-in-Polygon 알고리즘 사용
  const polygon = rectangleToPolygon(rectangle);
  return isPointInPolygon(point, polygon);
};

// 사각형 좌표를 다각형으로 변환하는 헬퍼 함수
export const rectangleToPolygon = (
  rectangle: { latitude: number; longitude: number }[]
): { latitude: number; longitude: number }[] => {
  if (rectangle.length !== 4) {
    return [];
  }

  // 사각형을 시계방향으로 다각형으로 변환
  return [
    rectangle[0], // 첫 번째 점
    rectangle[1], // 두 번째 점
    rectangle[2], // 세 번째 점
    rectangle[3], // 네 번째 점
    rectangle[0]  // 첫 번째 점으로 돌아옴 (폐곡선)
  ];
};

// 호서대학교 건물 데이터 (위도, 경도, 반경, 다각형, 사각형)
export const hoseoBuildings: Building[] = [
  {
    id: 'kangseokgyu',
    name: '강석규 교육관',
    latitude: 36.735770,
    longitude: 127.074795,
    radius: 150, // 150m 반경
    description: '호서대학교 강석규 교육관'
  },
  {
    id: 'library',
    name: '중앙도서관',
    latitude: 36.737241,
    longitude: 127.076292,
    radius: 200, // 200m 반경
    description: '호서대학교 중앙도서관'
  },
  {
    id: 'student_center',
    name: '학생회관',
    latitude: 36.739452,
    longitude: 127.074209,
    radius: 180, // 180m 반경
    description: '동아리실 및 학생회관'
  },
  {
    id: 'arts_new',
    name: '예술관 신관',
    latitude: 36.734204,
    longitude: 127.075162,
    radius: 140, // 140m 반경
    description: '예술관 신 건물'
  },
  {
    id: 'changryeol house',
    name: '집',
    latitude: 36.741124,
    longitude: 127.074468,
    radius: 140, // 140m 반경
    description: '집'
  },
  {
    id: 'arts_old',
    name: '예술관 구관',
    latitude: 36.735026,
    longitude: 127.075265,
    radius: 140, // 140m 반경
    description: '예술관 구 건물'
  },
  {
    id: 'science',
    name: '자연과학관',
    latitude: 36.736454,
    longitude: 127.072263,
    radius: 170, // 170m 반경
    description: '자연과학관 건물'
  },
  {
    id: 'gym',
    name: '체육관',
    latitude: 36.737587,
    longitude: 127.072550,
    radius: 200, // 200m 반경
    description: '체육 시설'
  },
  {
    id: 'dormitory_a',
    name: '기숙사 a동',
    latitude: 36.7800,
    longitude: 127.2860,
    radius: 250, // 250m 반경
    description: '학생 기숙사 a동'
  },
  {
    id: 'architecture',
    name: '조형과학관',
    latitude: 36.735020,
    longitude: 127.074301,
    radius: 150, // 150m 반경
    description: '조형과학관 건물'
  },
  {
    id: 'golf',
    name: '골프장',
    latitude: 36.735237,
    longitude: 127.072235,
    radius: 300, // 300m 반경
    description: '골프장'
  },
  {
    id: 'sanhak_1',
    name: '산학협동관 1',
    latitude: 36.735237,
    longitude: 127.072235, 
    radius: 180, // 180m 반경
    description: '산학협동 1호관'
  },
  {
    id: 'sanhak_2',
    name: '산학협동관 2',
    latitude: 36.735977,
    longitude: 127.076349, 
    radius: 180, // 180m 반경
    description: '산학협동 2호관'
  },
  // 예시: ㄱ자 형태의 건물 (실제 좌표는 정확한 측정 필요)
  {
    id: 'example_l_shape',
    name: 'ㄱ자 건물 예시',
    latitude: 36.735000,
    longitude: 127.075000,
    radius: 200, // 기본 반경 (fallback용)
    polygon: [
      { latitude: 36.735000, longitude: 127.075000 }, // 시작점
      { latitude: 36.735500, longitude: 127.075000 }, // 오른쪽
      { latitude: 36.735500, longitude: 127.075500 }, // 위쪽
      { latitude: 36.736000, longitude: 127.075500 }, // 더 위쪽
      { latitude: 36.736000, longitude: 127.076000 }, // 오른쪽
      { latitude: 36.735000, longitude: 127.076000 }, // 아래쪽
      { latitude: 36.735000, longitude: 127.075000 }  // 시작점으로 돌아옴
    ],
    description: 'ㄱ자 형태의 건물 예시'
  },
  // 예시: 사각형 형태의 건물 (실제 좌표는 정확한 측정 필요)
  {
    id: 'engineering_2',
    name: '제2공학관',
    latitude: 36.736469,
    longitude: 127.073149,
    radius: 200, // 기본 반경 (fallback용)
    rectangle: [
      { latitude: 36.736228, longitude: 127.072625 }, // 좌하단
      { latitude: 36.736033, longitude: 127.073216 }, // 우하단
      { latitude: 36.736811, longitude: 127.073570 }, // 우상단
      { latitude: 36.736933, longitude: 127.073287 }  // 좌상단
    ],
    description: '제2공학관 건물'
  },
  {
    id: 'engineering_1',
    name: '제1공학관',
    latitude: 36.736469,
    longitude: 127.073149,
    radius: 200, // 기본 반경 (fallback용)
    rectangle: [
      { latitude: 36.735939, longitude: 127.074072 }, // 좌하단
      { latitude: 36.736131, longitude: 127.073545 }, // 우하단
      { latitude: 36.737168, longitude: 127.074957 }, // 우상단
      { latitude: 36.737470, longitude: 127.074093 }  // 좌상단
    ],
    description: '제1공학관 건물'
  },
  {
    id: 'kangseokgyu',
    name: '강석규 교육관',
    latitude: 36.735770,
    longitude: 127.074795,
    radius: 200, // 기본 반경 (fallback용)
    rectangle: [
      { latitude: 36.735820 , longitude: 127.074191 }, // 좌하단
      { latitude: 36.736063, longitude: 127.074359 }, // 우하단
      { latitude: 36.735669, longitude: 127.074957 }, // 우상단
      { latitude: 36.735385, longitude: 127.075173 }  // 좌상단
    ],
    description: '호서대학교 강석규 교육관'
  },
  
  //기숙사 a,b,c,d,e,f,g 동, 행복기숙사, 보건과학관, 교회, 세출호, 나래호, 본관, 운동장, 잔디광장
  //발야구장 추가해야됨

  //추후~~~~~~ 에 술집 추가할거면 하든가 추가해야됨
];

// 디버깅용: 사각형 좌표 테스트 함수
export const testRectangleCoordinates = (
  testPoint: { latitude: number; longitude: number },
  buildingId: string
): void => {
  const building = hoseoBuildings.find(b => b.id === buildingId);
  if (!building || !building.rectangle) {
    console.log(`Building ${buildingId} not found or has no rectangle`);
    return;
  }

  console.log(`Testing point: ${testPoint.latitude}, ${testPoint.longitude}`);
  console.log(`Building: ${building.name}`);
  console.log('Rectangle coordinates:');
  building.rectangle.forEach((coord, index) => {
    console.log(`  Point ${index}: ${coord.latitude}, ${coord.longitude}`);
  });

  const isInside = isPointInRectangle(testPoint, building.rectangle);
  console.log(`Result: ${isInside ? 'INSIDE' : 'OUTSIDE'}`);
  
  // 경계 박스 확인
  const minLat = Math.min(...building.rectangle.map(p => p.latitude));
  const maxLat = Math.max(...building.rectangle.map(p => p.latitude));
  const minLng = Math.min(...building.rectangle.map(p => p.longitude));
  const maxLng = Math.max(...building.rectangle.map(p => p.longitude));
  
  console.log(`Bounding box: ${minLat} to ${maxLat}, ${minLng} to ${maxLng}`);
  console.log(`Point in bounding box: ${testPoint.latitude >= minLat && testPoint.latitude <= maxLat && testPoint.longitude >= minLng && testPoint.longitude <= maxLng}`);
};

// 두 지점 간의 거리를 계산하는 함수 (Haversine 공식)
export const calculateDistance = (
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number => {
  const R = 6371; // 지구의 반지름 (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // km 단위
  return distance * 1000; // m 단위로 변환
};

// 호서대학교 캠퍼스 중심점 (호서대 정문 기준)
const HOSEO_CAMPUS_CENTER = {
  latitude: 36.738782,
  longitude: 127.076800
};

// 캠퍼스 반경 (미터 단위) - 필요에 따라 조정
const CAMPUS_RADIUS = 1000; // 1km

// 사용자가 어느 건물의 반경 내에 있는지 확인하는 함수 (다각형, 사각형 지원)
export const findBuildingAtLocation = (
  userLatitude: number, 
  userLongitude: number
): Building | null => {
  for (const building of hoseoBuildings) {
    // 사각형이 정의된 경우, Point-in-Rectangle 알고리즘 사용
    if (building.rectangle && building.rectangle.length === 4) {
      const isInside = isPointInRectangle(
        { latitude: userLatitude, longitude: userLongitude },
        building.rectangle
      );
      
      if (isInside) {
        return building;
      }
    }
    // 다각형이 정의된 경우, Point-in-Polygon 알고리즘 사용
    else if (building.polygon && building.polygon.length > 0) {
      const isInside = isPointInPolygon(
        { latitude: userLatitude, longitude: userLongitude },
        building.polygon
      );
      
      if (isInside) {
        return building;
      }
    } else {
      // 기존 원형 반경 방식 사용
      const distance = calculateDistance(
        userLatitude,
        userLongitude,
        building.latitude,
        building.longitude
      );
      
      if (distance <= building.radius) {
        return building;
      }
    }
  }
  
  return null; // 어떤 건물의 반경 내에도 없으면 null 반환
};

// 사용자가 캠퍼스 내에 있는지 확인하는 함수 (기존 함수 유지)
export const isWithinHoseoCampus = (
  userLatitude: number, 
  userLongitude: number
): boolean => {
  // 어느 건물의 반경 내에라도 있으면 캠퍼스 내로 간주
  return findBuildingAtLocation(userLatitude, userLongitude) !== null;
};

// 사용자 위치에서 가장 가까운 건물을 찾는 함수 (기존 함수 유지)
export const findNearestBuilding = (
  userLatitude: number, 
  userLongitude: number
): Building | null => {
  // 먼저 캠퍼스 내에 있는지 확인
  if (!isWithinHoseoCampus(userLatitude, userLongitude)) {
    return null; // 캠퍼스 밖이면 null 반환
  }

  let nearestBuilding = hoseoBuildings[0];
  let minDistance = calculateDistance(
    userLatitude, 
    userLongitude, 
    nearestBuilding.latitude, 
    nearestBuilding.longitude
  );

  for (const building of hoseoBuildings) {
    const distance = calculateDistance(
      userLatitude, 
      userLongitude, 
      building.latitude, 
      building.longitude
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestBuilding = building;
    }
  }

  return nearestBuilding;
};

// 특정 반경 내의 건물들을 찾는 함수
export const findBuildingsInRadius = (
  userLatitude: number, 
  userLongitude: number, 
  radiusInMeters: number = 500
): Building[] => {
  return hoseoBuildings.filter(building => {
    const distance = calculateDistance(
      userLatitude, 
      userLongitude, 
      building.latitude, 
      building.longitude
    );
    return distance <= radiusInMeters;
  });
}; 