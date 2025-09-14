const API_BASE_URL = 'https://hoseolife.kro.kr';

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface Building {
  id: string;
  name: string;
  campus: 'asan' | 'cheonan';
  latitude: number;
  longitude: number;
  radius: number;
  building_type: 'rectangle' | 'polygon';
  coordinates: Coordinate[];
  description: string;
  created_at: string;
  updated_at: string;
}

export interface BuildingCreate {
  id: string;
  name: string;
  campus: 'asan' | 'cheonan';
  latitude: number;
  longitude: number;
  radius: number;
  building_type: 'rectangle' | 'polygon';
  coordinates: Coordinate[];
  description?: string;
}

export interface BuildingUpdate {
  name?: string;
  campus?: 'asan' | 'cheonan';
  latitude?: number;
  longitude?: number;
  radius?: number;
  building_type?: 'rectangle' | 'polygon';
  coordinates?: Coordinate[];
  description?: string;
}

class BuildingService {
  private baseUrl = `${API_BASE_URL}/buildings`;

  /**
   * 모든 건물 정보 조회
   */
  async getAllBuildings(): Promise<Building[]> {
    try {
      const response = await fetch(this.baseUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('건물 정보 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 캠퍼스별 건물 정보 조회
   */
  async getBuildingsByCampus(campus: 'asan' | 'cheonan'): Promise<Building[]> {
    try {
      const response = await fetch(`${this.baseUrl}/${campus}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`${campus} 캠퍼스 건물 정보 조회 실패:`, error);
      throw error;
    }
  }

  /**
   * 특정 건물 정보 조회
   */
  async getBuilding(campus: 'asan' | 'cheonan', buildingId: string): Promise<Building> {
    try {
      const response = await fetch(`${this.baseUrl}/${campus}/${buildingId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`건물 정보 조회 실패:`, error);
      throw error;
    }
  }

  /**
   * 새 건물 추가 (관리자만)
   */
  async createBuilding(building: BuildingCreate, token: string): Promise<Building> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(building),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('건물 추가 실패:', error);
      throw error;
    }
  }

  /**
   * 건물 정보 수정 (관리자만)
   */
  async updateBuilding(buildingId: string, updates: BuildingUpdate, token: string): Promise<Building> {
    try {
      const response = await fetch(`${this.baseUrl}/${buildingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('건물 정보 수정 실패:', error);
      throw error;
    }
  }

  /**
   * 건물 삭제 (관리자만)
   */
  async deleteBuilding(buildingId: string, token: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/${buildingId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('건물 삭제 실패:', error);
      throw error;
    }
  }

  /**
   * 건물 데이터를 기존 buildingData.ts 형식으로 변환
   */
  convertToLegacyFormat(buildings: Building[]) {
    return buildings.map(building => ({
      id: building.id,
      name: building.name,
      campus: building.campus,
      latitude: building.latitude,
      longitude: building.longitude,
      radius: building.radius,
      polygon: building.building_type === 'polygon' ? building.coordinates : undefined,
      rectangle: building.building_type === 'rectangle' ? building.coordinates : undefined,
      description: building.description,
    }));
  }
}

export const buildingService = new BuildingService();
export default buildingService;
