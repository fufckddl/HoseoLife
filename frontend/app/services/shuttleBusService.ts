import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = "https://hoseolife.kro.kr";

export interface ShuttleBusStop {
  [key: string]: string;
}

export interface ShuttleBus {
  id: number;
  name: string;
  route: string;
  time: string;
  description?: string;
  stops?: string[];
  schedule?: ShuttleBusStop[];
  saturday_schedule?: ShuttleBusStop[];
  sunday_schedule?: ShuttleBusStop[];
  type: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface ShuttleBusListResponse {
  items: ShuttleBus[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface ShuttleBusCreate {
  name: string;
  route: string;
  time: string;
  description?: string;
  stops?: string[];
  schedule?: ShuttleBusStop[];
  saturday_schedule?: ShuttleBusStop[];
  sunday_schedule?: ShuttleBusStop[];
  type?: string;
  is_active?: boolean;
}

export interface ShuttleBusUpdate {
  name?: string;
  route?: string;
  time?: string;
  description?: string;
  stops?: string[];
  schedule?: ShuttleBusStop[];
  saturday_schedule?: ShuttleBusStop[];
  sunday_schedule?: ShuttleBusStop[];
  type?: string;
  is_active?: boolean;
}

class ShuttleBusService {
  private async getAuthToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('access_token');
    } catch (error) {
      console.error('토큰 가져오기 실패:', error);
      return null;
    }
  }

  private async makeRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.getAuthToken();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response;
  }

  async getShuttleBuses(
    skip: number = 0,
    limit: number = 100,
    type?: string,
    is_active: boolean = true
  ): Promise<ShuttleBusListResponse> {
    const params = new URLSearchParams({
      skip: skip.toString(),
      limit: limit.toString(),
      is_active: is_active.toString(),
    });
    
    if (type) {
      params.append('type', type);
    }

    const response = await this.makeRequest(`/shuttle-buses/?${params.toString()}`);
    return response.json();
  }

  async getShuttleBus(id: number): Promise<ShuttleBus> {
    const response = await this.makeRequest(`/shuttle-buses/${id}`);
    return response.json();
  }

  async createShuttleBus(data: ShuttleBusCreate): Promise<ShuttleBus> {
    const response = await this.makeRequest('/shuttle-buses/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async updateShuttleBus(id: number, data: ShuttleBusUpdate): Promise<ShuttleBus> {
    const response = await this.makeRequest(`/shuttle-buses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async deleteShuttleBus(id: number): Promise<{ message: string }> {
    const response = await this.makeRequest(`/shuttle-buses/${id}`, {
      method: 'DELETE',
    });
    return response.json();
  }
}

export const shuttleBusService = new ShuttleBusService();
